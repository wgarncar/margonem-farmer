
/**
 * Farmer
 * Wymaga:
 * @grant GM_getResourceText
 * @grant unsafeWindow
 * @resource farmerData <adres expowiska.json>
 */

(() => {
  'use strict';

  const game = typeof unsafeWindow !== 'undefined'
    ? unsafeWindow
    : window;

  if (window.Farmer?.destroy) {
    window.Farmer.destroy();
  }

  const CONFIG = {
    tickMs: 600,
    moveRetryMs: 1800,
    attackRetryMs: 3000,
    afterFightMs: 1200,
    maxFightWaitMs: 12000,
    storageKey: 'farmer-expowiska-ids'
  };

  const ROOT_ID = 'farmer-addon-window';
  const STYLE_ID = 'farmer-addon-styles';

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className =
    'c-window border-window transparent farmer-window';

  root.setAttribute('data-opacity-lvl', '3');
  root.setAttribute('size-opt', '1');

  root.style.cssText = `
    touch-action: none;
    position: absolute;
    left: 270px;
    top: 110px;
    display: block;
    z-index: 10000;
  `;

  root.innerHTML = `
    <div class="header-label-positioner">
      <div class="draggable-window-element pointer-draggable-handle farmer-drag-handle"></div>
      <div class="header-label">
        <div class="left-decor"></div>
        <div class="right-decor"></div>
        <div class="text" name="Farmer">Farmer</div>
      </div>
    </div>

    <div class="content content--padding-md">
      <div class="inner-content">
        <div class="farmer-content">

          <label class="farmer-label">
            Wybierz expowiska
          </label>

          <div class="farmer-exp-list" id="farmer-exp-list">
            Ładowanie expowisk...
          </div>

          <div class="farmer-selected-count">
            Wybrano: 0
          </div>

          <div class="farmer-actions">
            <button type="button" class="farmer-button farmer-start">
              Start
            </button>
            <button type="button" class="farmer-button farmer-stop" disabled>
              Stop
            </button>
          </div>

          <div class="farmer-status" role="status">
            Status: Zatrzymany
          </div>
          <div class="farmer-target"></div>
          <div class="farmer-counter">Ataki: 0</div>
        </div>
      </div>
      <div class="window-controlls"></div>
    </div>

    <div class="c-window__bottom-bar">
      <div class="interface-element-bottom-bar-background-stretch"></div>
    </div>

    <div class="close-button-corner-decor">
      <button type="button" class="close-button">
        <div class="ie-icon ie-icon-close"></div>
      </button>
    </div>

    <div class="border-image"></div>
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      width: 258px;
      box-sizing: border-box;
      color: #e5d4b0;
    }

    #${ROOT_ID} .farmer-drag-handle {
      cursor: move;
      touch-action: none;
    }

    #${ROOT_ID} .farmer-content {
      width: 212px;
      min-height: 150px;
      padding: 10px 4px 6px;
      box-sizing: border-box;
    }

    #${ROOT_ID} .farmer-label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
    }

    #${ROOT_ID} .farmer-input {
      box-sizing: border-box;
      width: 100%;
      padding: 6px 8px;
      background: #211b17;
      color: #f7eddb;
      border: 1px solid #8f734b;
      border-radius: 3px;
      font: inherit;
    }

    #${ROOT_ID} .farmer-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    #${ROOT_ID} .farmer-button {
      flex: 1;
      padding: 6px 7px;
      cursor: pointer;
      color: #f7eddb;
      background: linear-gradient(#655035, #3b2c1d);
      border: 1px solid #9a7b50;
      border-radius: 3px;
      font: inherit;
    }

    #${ROOT_ID} .farmer-button:disabled {
      cursor: default;
      opacity: .45;
    }

    #${ROOT_ID} .farmer-status,
    #${ROOT_ID} .farmer-target,
    #${ROOT_ID} .farmer-counter {
      margin-top: 7px;
      font-size: 11px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    #${ROOT_ID} .farmer-counter {
      color: #caa169;
    }

    #farmer-addon-window .farmer-select {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  background: #211b17;
  color: #f7eddb;
  border: 1px solid #8f734b;
  border-radius: 3px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

#farmer-addon-window .farmer-select option {
  background: #211b17;
  color: #f7eddb;
}

#farmer-addon-window .farmer-select:focus {
  outline: 1px solid #caa169;
}

#farmer-addon-window .farmer-exp-list {
  width: 100%;
  max-height: 170px;
  overflow-y: auto;
  background: #211b17;
  border: 1px solid #8f734b;
  border-radius: 3px;
  padding: 5px;
  box-sizing: border-box;
}

#farmer-addon-window .farmer-exp-option {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 3px;
  cursor: pointer;
  font-size: 11px;
  color: #e5d4b0;
}

#farmer-addon-window .farmer-exp-option:hover {
  background: #493724;
}

#farmer-addon-window .farmer-exp-option input {
  accent-color: #b89558;
  margin: 0;
  flex-shrink: 0;
}

#farmer-addon-window .farmer-selected-count {
  font-size: 11px;
  margin-top: 6px;
  color: #caa169;
}
  `;

  document.head.appendChild(style);

  (
    document.querySelector('.game-window-positioner') ||
    document.body
  ).appendChild(root);

  const $ = selector => root.querySelector(selector);

  const expList = $('#farmer-exp-list');
  const selectedCountEl = $('.farmer-selected-count');
  const startBtn = $('.farmer-start');
  const stopBtn = $('.farmer-stop');
  const statusEl = $('.farmer-status');
  const targetEl = $('.farmer-target');
  const counterEl = $('.farmer-counter');

  let running = false;
  let timer = null;
  let selectedIds = [];
  let allowedNames = new Set();
  let allowedMaps = new Set();

  // Nazwa mapy -> numer ostatniej wizyty
  let mapLastVisited = new Map();

  let visitCounter = 0;
  let lastVisitedMapId = null;
  let lastVisitedMapName = null;

  let gatewayTarget = null;
  let lastGatewayAction = 0;
  let gatewayWaitingUntil = 0;
  let gatewayPreviousMap = null;
  let gatewayAttempts = 0;
  let currentTargetId = null;
  let attackCount = 0;
  let lastMove = 0;
  let lastAttack = 0;
  let lastFightEnd = 0;
  let attackPendingUntil = 0;
  let wasFighting = false;
  let autoFightClicked = false;
  let currentMapId = null;
  let lastDestination = null;
  let lastHeroPosition = null;
  let stuckAttempts = 0;
  let isApproachingMonster = false;
  let approachingMonsterId = null;
  let monsterLastSeen = 0;
  let expowiskaCache = [];

  const MONSTER_LOST_TIMEOUT = 5000;

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('pl');
  }

  function setStatus(message) {
    statusEl.textContent = `Status: ${message}`;
  }

  function getEngine() {
    const engine = game.Engine || window.Engine;

    if (!engine?.hero?.d || !engine?.npcs) {
      throw new Error('Nie znaleziono Engine lub postaci.');
    }

    return engine;
  }

  function getNpcs(engine) {
    const source =
      engine.npcs.check?.() ??
      engine.npcs.getAll?.() ??
      engine.npcs.getDrawableList?.();

    if (!source) return [];

    return Object.values(source)
      .map(obj => {
        const d = obj?.d ?? obj;

        if (!d) return null;

        return {
          obj,
          id: d.id,
          nick: d.nick ?? d.name,
          type: Number(d.type),
          wt: d.wt == null ? NaN : Number(d.wt),
          grp: d.grp ?? null,
          lvl: Number(d.lvl),
          x: Number(d.x),
          y: Number(d.y)
        };
      })
      .filter(n =>
        n &&
        n.id != null &&
        Number.isFinite(n.x) &&
        Number.isFinite(n.y)
      );
  }


  function getAllowedMonsters(engine) {
    // Pobieramy WSZYSTKIE NPC na mapie,
    // a nie tylko pasujące do expowiska.
    const allNpcs = getNpcs(engine);

    // Rangi specjalne — nie wybieramy ich do farmienia.
    const isSpecialRank = npc =>
      !Number.isFinite(npc.wt) ||
      npc.wt >= 10;

    // Identyfikatory grup zawierających
    // co najmniej jednego potwora o specjalnej randze.
    const blockedGroups = new Set(
      allNpcs
        .filter(npc =>
          npc.grp !== null &&
          npc.grp !== undefined &&
          npc.grp !== '' &&
          npc.grp !== 0 &&
          npc.grp !== '0' &&
          isSpecialRank(npc)
        )
        .map(npc => String(npc.grp))
    );

    return allNpcs.filter(npc => {
      // Tylko NPC do walki.
      if (npc.type !== 2 && npc.type !== 3) {
        return false;
      }

      // Tylko potwory z wybranych expowisk.
      if (!allowedNames.has(normalize(npc.nick))) {
        return false;
      }

      // Nie atakuj Elit, Elit II ani innych
      // potworów o specjalnej lub nieznanej randze.
      if (isSpecialRank(npc)) {
        return false;
      }

      // Nie atakuj żadnego członka grupy
      // zawierającej potwora o specjalnej randze.
      const groupId = npc.grp;

      if (
        groupId !== null &&
        groupId !== undefined &&
        groupId !== '' &&
        groupId !== 0 &&
        groupId !== '0' &&
        blockedGroups.has(String(groupId))
      ) {
        return false;
      }

      return true;
    });
  }


  function isAdjacent(hero, npc) {
    return (
      Math.abs(Number(hero.x) - npc.x) <= 1 &&
      Math.abs(Number(hero.y) - npc.y) <= 1
    );
  }

  function findNearestTarget(engine, targets) {
    const hero = engine.hero.d;
    const map = engine.map;

    const width = Number(map?.d?.x ?? map?.size?.x);
    const height = Number(map?.d?.y ?? map?.size?.y);

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      typeof map?.col?.check !== 'function'
    ) {
      throw new Error('Brak danych kolizji mapy.');
    }

    const hx = Number(hero.x);
    const hy = Number(hero.y);

    const key = (x, y) => `${x},${y}`;

    const queue = [[hx, hy]];
    const visited = new Set([key(hx, hy)]);
    const previous = new Map();

    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0]
    ];

    const walkable = (x, y) =>
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height &&
      Number(map.col.check(x, y)) === 0;

    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];

      const npc = targets.find(target =>
        Math.abs(target.x - x) <= 1 &&
        Math.abs(target.y - y) <= 1
      );

      if (npc) {
        const path = [];
        let current = [x, y];

        while (key(...current) !== key(hx, hy)) {
          path.unshift({
            x: current[0],
            y: current[1]
          });

          current = previous.get(key(...current));
        }

        return {
          npc,
          destination: { x, y },
          path
        };
      }

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);

        if (visited.has(k) || !walkable(nx, ny)) {
          continue;
        }

        visited.add(k);
        previous.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }

    return null;
  }

  function isFighting(engine) {
    return engine.battle?.show === true;
  }

  function handleFight(engine, now) {
    if (isFighting(engine)) {
      wasFighting = true;
      setStatus('Walka w toku');

      if (!autoFightClicked) {
        const button = document.querySelector(
          '.auto-fight-btn'
        );

        if (button) {
          button.click();
          autoFightClicked = true;
        }
      }

      return true;
    }

    if (wasFighting) {
      wasFighting = false;
      autoFightClicked = false;
      currentTargetId = null;
      lastFightEnd = now;
      attackPendingUntil = 0;
      setStatus('Walka zakończona');
    }

    return false;
  }

  function attackNpc(npc, now) {
    const engine = getEngine();

    const safeTarget = getAllowedMonsters(engine).find(
      target => String(target.id) === String(npc.id)
    );

    if (!safeTarget) {
      console.warn(
        '[Farmer] Pomijam niebezpiecznego NPC lub grupę:',
        npc.nick,
        npc.grp
      );

      currentTargetId = null;
      isApproachingMonster = false;
      approachingMonsterId = null;
      monsterLastSeen = 0;

      setStatus('Pominięto grupę z elitą');
      return;
    }

    if (now - lastAttack < CONFIG.attackRetryMs) return;

    if (typeof game._g !== 'function') {
      throw new Error('Brak funkcji _g do rozpoczęcia walki.');
    }

    const npcId = String(npc.id).replace(/^-/, '');

    // Żądanie rozpoczęcia walki z wybranym NPC.
    game._g(
      `fight&a=attack&ff=1&id=-${npcId}`
    );

    lastAttack = now;
    attackPendingUntil = now + CONFIG.maxFightWaitMs;
    attackCount++;

    counterEl.textContent = `Próby ataku: ${attackCount}`;
    setStatus(`Atak: ${npc.nick}`);

    console.log('[Farmer] Atak:', npc);
  }

  function moveTo(engine, destination, now) {
    if (now - lastMove < CONFIG.moveRetryMs) return;

    if (typeof engine.hero.autoGoTo !== 'function') {
      throw new Error('Brak Engine.hero.autoGoTo.');
    }

    const hero = engine.hero.d;
    const pos = `${hero.x},${hero.y}`;
    const dest = `${destination.x},${destination.y}`;

    if (lastDestination === dest && lastHeroPosition === pos) {
      stuckAttempts++;
    } else {
      stuckAttempts = 0;
    }

    if (stuckAttempts >= 5) {
      throw new Error('Postać nie może dotrzeć do celu.');
    }

    lastHeroPosition = pos;
    lastDestination = dest;
    lastMove = now;

    engine.hero.autoGoTo(destination);
  }


  function getGateways(engine) {
    const list = engine.map?.gateways?.getList?.() ?? [];

    return list
      .filter(g => g?.d)
      .map(g => ({
        obj: g,
        id: g.d.id,
        x: Number(g.d.x),
        y: Number(g.d.y),
        name: String(g.tip?.[0] ?? '').trim()
      }))
      .filter(g =>
        Number.isInteger(g.x) &&
        Number.isInteger(g.y) &&
        allowedMaps.has(normalize(g.name))
      );
  }

  // BFS do konkretnego kafelka przejścia.
  // Nie zakładamy, że najbliższe geometrycznie
  // przejście jest również najbliższe po ścieżce.
  function getGatewayPath(engine, gateway) {
    const hero = engine.hero.d;
    const map = engine.map;

    const width = Number(map?.d?.x ?? map?.size?.x);
    const height = Number(map?.d?.y ?? map?.size?.y);

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      typeof map?.col?.check !== 'function'
    ) {
      return null;
    }

    const startX = Number(hero.x);
    const startY = Number(hero.y);

    const key = (x, y) => `${x},${y}`;

    const startKey = key(startX, startY);
    const endKey = key(gateway.x, gateway.y);

    const queue = [[startX, startY]];
    const visited = new Set([startKey]);
    const previous = new Map();

    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0]
    ];

    let found = false;

    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];

      if (key(x, y) === endKey) {
        found = true;
        break;
      }

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nextKey = key(nx, ny);

        if (
          nx < 0 ||
          ny < 0 ||
          nx >= width ||
          ny >= height ||
          visited.has(nextKey)
        ) {
          continue;
        }

        // Pole przejścia bywa oznaczone w kolizjach
        // inaczej niż zwykłe pole do chodzenia.
        const isGatewayTile = nextKey === endKey;

        if (
          !isGatewayTile &&
          Number(map.col.check(nx, ny)) !== 0
        ) {
          continue;
        }

        visited.add(nextKey);
        previous.set(nextKey, [x, y]);
        queue.push([nx, ny]);
      }
    }

    if (!found) return null;

    const path = [];
    let current = [gateway.x, gateway.y];

    while (key(...current) !== startKey) {
      path.unshift({
        x: current[0],
        y: current[1]
      });

      const parent = previous.get(key(...current));
      if (!parent) return null;

      current = parent;
    }

    return path;
  }

  function registerMapVisit(engine) {
    const mapId = engine.map?.d?.id;
    const mapName = normalize(engine.map?.d?.name);

    if (!mapName) return;

    if (
      lastVisitedMapId === mapId &&
      lastVisitedMapName === mapName
    ) {
      return;
    }

    visitCounter++;

    mapLastVisited.set(mapName, visitCounter);

    lastVisitedMapId = mapId;
    lastVisitedMapName = mapName;

    console.log(
      `[Farmer] Wizyta #${visitCounter}: ${mapName}`
    );
  }


  function findNearestGateway(engine) {
    const gateways = getGateways(engine);

    const candidates = gateways
      .map(gateway => ({
        gateway,
        path: getGatewayPath(engine, gateway),
        lastVisit: mapLastVisited.get(
          normalize(gateway.name)
        )
      }))
      .filter(item => item.path !== null);

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => {
      const aNeverVisited = a.lastVisit === undefined;
      const bNeverVisited = b.lastVisit === undefined;

      // 1. Mapy nigdy nieodwiedzone mają pierwszeństwo.
      if (aNeverVisited !== bNeverVisited) {
        return aNeverVisited ? -1 : 1;
      }

      // 2. Jeśli obie mapy były odwiedzone,
      // wybieramy tę najdawniej odwiedzoną.
      if (!aNeverVisited && !bNeverVisited) {
        if (a.lastVisit !== b.lastVisit) {
          return a.lastVisit - b.lastVisit;
        }
      }

      // 3. W przypadku remisu wybieramy
      // najkrótszą osiągalną ścieżkę.
      return a.path.length - b.path.length;
    });

    const selected = candidates[0];

    console.log('[Farmer] Wybrane przejście:', {
      map: selected.gateway.name,
      steps: selected.path.length,
      lastVisit: selected.lastVisit ?? 'Nigdy',
      visitHistory: Object.fromEntries(mapLastVisited)
    });

    return selected;
  }


  function handleGateway(engine, now) {
    const currentMapName = normalize(engine.map?.d?.name);

    // Wykrycie rzeczywistej zmiany mapy
    // na podstawie nazwy i identyfikatora.
    if (
      gatewayTarget &&
      (
        normalize(gatewayTarget.fromName) !== currentMapName ||
        String(gatewayTarget.fromId) !==
        String(engine.map?.d?.id)
      )
    ) {

      gatewayPreviousMap = gatewayTarget.fromName;
      gatewayTarget = null;
      gatewayWaitingUntil = 0;
      gatewayAttempts = 0;

      currentTargetId = null;
      lastDestination = null;
      lastHeroPosition = null;
      stuckAttempts = 0;

      setStatus(`Nowa mapa: ${engine.map?.d?.name}`);
      return;
    }

    if (now < gatewayWaitingUntil) {
      setStatus('Oczekiwanie na zmianę mapy');
      return;
    }

    const selected = findNearestGateway(engine);

    if (!selected) {
      gatewayTarget = null;
      targetEl.textContent = 'Przejście: brak';
      setStatus('Brak dostępnego przejścia z listy maps');
      return;
    }

    const { gateway, path } = selected;

    const targetKey = `${gateway.id}:${gateway.x}:${gateway.y}`;

    if (gatewayTarget?.key !== targetKey) {
      gatewayTarget = {
        key: targetKey,
        fromId: engine.map?.d?.id,
        fromName: engine.map?.d?.name,
        gateway
      };

      gatewayAttempts = 0;
      lastDestination = null;
      lastHeroPosition = null;
      stuckAttempts = 0;
    }

    targetEl.textContent = `Mapa docelowa: ${gateway.name}`;

    const hero = engine.hero.d;

    if (
      Number(hero.x) === gateway.x &&
      Number(hero.y) === gateway.y
    ) {
      if (now - lastGatewayAction < CONFIG.moveRetryMs) {
        return;
      }

      if (gatewayAttempts >= 3) {
        gatewayTarget = null;
        setStatus('Nie udało się aktywować przejścia');
        stop('Błąd przejścia między mapami');
        return;
      }

      lastGatewayAction = now;
      gatewayAttempts++;

      if (typeof engine.hero.getTroughGateway === 'function') {
        engine.hero.getTroughGateway();
      } else if (
        typeof gateway.obj.onclick === 'function'
      ) {
        gateway.obj.onclick({
          stopPropagation() { },
          preventDefault() { },
          button: 0,
          which: 1,
          type: 'click'
        });
      } else {
        stop('Brak metody aktywacji przejścia');
        return;
      }

      gatewayWaitingUntil = now + 4000;

      setStatus(`Przechodzę do: ${gateway.name}`);
      return;
    }

    setStatus(
      `Idę do: ${gateway.name} (${path.length} kroków)`
    );

    moveTo(engine, {
      x: gateway.x,
      y: gateway.y
    }, now);
  }


  function findHeroOnMap(engine) {
    return getNpcs(engine).find(npc =>
      (npc.type === 2 || npc.type === 3) &&
      Number.isFinite(npc.wt) &&
      npc.wt >= 80 &&
      npc.wt < 100
    ) ?? null;
  }

  function showHeroPopup(hero, mapName) {
    // Zapobiegamy tworzeniu wielu popupów.
    document.getElementById('farmer-hero-popup')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'farmer-hero-popup';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.65)'
    });

    const popup = document.createElement('div');

    Object.assign(popup.style, {
      width: '310px',
      maxWidth: '90vw',
      padding: '20px',
      background: '#29221c',
      border: '2px solid #a9854c',
      borderRadius: '6px',
      color: '#e5d4b0',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 10px 35px rgba(0,0,0,.6)'
    });

    const title = document.createElement('h2');
    title.textContent = 'Wykryto herosa!';
    title.style.cssText = `
    color: #e7b95e;
    margin: 0 0 16px;
    font-size: 20px;
  `;

    const name = document.createElement('div');
    name.textContent = hero.nick;
    name.style.cssText = `
    font-size: 17px;
    font-weight: bold;
    margin-bottom: 10px;
  `;

    const level = document.createElement('div');
    level.textContent = Number.isFinite(hero.lvl)
      ? `Poziom: ${hero.lvl}`
      : '';

    const map = document.createElement('div');
    map.textContent = `Mapa: ${mapName}`;

    const coords = document.createElement('div');
    coords.textContent = `Pozycja: X: ${hero.x}, Y: ${hero.y}`;

    for (const el of [level, map, coords]) {
      el.style.marginBottom = '10px';
    }

    const message = document.createElement('div');
    message.textContent = 'Farmer został zatrzymany.';
    message.style.cssText = `
    margin: 16px 0;
    font-size: 12px;
    color: #d8b982;
  `;

    const button = document.createElement('button');
    button.textContent = 'Zamknij';

    Object.assign(button.style, {
      padding: '9px 30px',
      background: '#594128',
      border: '1px solid #b69157',
      borderRadius: '4px',
      color: '#f3e0b7',
      cursor: 'pointer'
    });

    button.addEventListener('click', () => overlay.remove());


    const copyButton = document.createElement('button');
    copyButton.textContent = 'Kopiuj informacje';

    Object.assign(copyButton.style, {
      padding: '9px 20px',
      marginRight: '8px',
      background: '#594128',
      border: '1px solid #b69157',
      borderRadius: '4px',
      color: '#f3e0b7',
      cursor: 'pointer'
    });

    copyButton.addEventListener('click', async () => {
      const info = [
        `Heros: ${hero.nick}`,
        `Poziom: ${Number.isFinite(hero.lvl) ? hero.lvl : 'Nieznany'}`,
        `Mapa: ${mapName}`,
        `Pozycja: X: ${hero.x}, Y: ${hero.y}`
      ].join('\n');

      try {
        await navigator.clipboard.writeText(info);

        copyButton.textContent = 'Skopiowano!';
        copyButton.style.background = '#365a32';

        console.log('[Farmer] Skopiowano informacje:', info);
      } catch (error) {
        console.error('[Farmer] Błąd kopiowania:', error);

        // Alternatywa dla przeglądarek, które blokują Clipboard API.
        const textarea = document.createElement('textarea');
        textarea.value = info;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand('copy');
        textarea.remove();

        if (copied) {
          copyButton.textContent = 'Skopiowano!';
          copyButton.style.background = '#365a32';
        } else {
          copyButton.textContent = 'Błąd kopiowania';
        }
      }
    });

    popup.append(
      title,
      name,
      level,
      map,
      coords,
      message,
      copyButton,
      button
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  function checkHeroAndStop(engine) {
    const hero = findHeroOnMap(engine);

    if (!hero) return false;

    const mapName = engine.map?.d?.name ?? 'Nieznana mapa';

    // Najpierw zatrzymujemy automat.
    stop('Wykryto herosa');

    console.warn('[Farmer] Wykryto herosa:', {
      name: hero.nick,
      lvl: hero.lvl,
      map: mapName,
      x: hero.x,
      y: hero.y
    });

    // Dopiero potem wyświetlamy popup.
    showHeroPopup(hero, mapName);

    return true;
  }

  function tick() {
    if (!running) return;

    try {
      const engine = getEngine();
      const now = Date.now();

      // Najwyższy priorytet: wykrycie herosa.
      // Sprawdzamy przed ruchem, walką i zmianą mapy.
      if (checkHeroAndStop(engine)) {
        return;
      }

      // Rejestrujemy mapę, na której aktualnie jesteśmy.
      registerMapVisit(engine);

      const currentName = normalize(engine.map?.d?.name);

      // Jeżeli trwa przechodzenie między mapami,
      // najpierw obsłuż jego zakończenie.
      if (gatewayTarget && (
        normalize(gatewayTarget.fromName) !== currentName ||
        String(gatewayTarget.fromId) !== String(engine.map?.d?.id)
      )) {
        handleGateway(engine, now);
        return;
      }

      if (engine.dead) {
        stop('Postać nie żyje');
        return;
      }

      // Zatrzymaj działania na czas CAPTCHA.
      const captcha = document.querySelector('.captcha-window');
      if (
        captcha &&
        captcha.getClientRects().length > 0 &&
        getComputedStyle(captcha).visibility !== 'hidden'
      ) {
        stop('Wykryto CAPTCHA');
        return;
      }

      const mapId = engine.map?.d?.id;

      if (currentMapId !== null && mapId !== currentMapId) {
        currentTargetId = null;
        lastDestination = null;
        lastHeroPosition = null;
        stuckAttempts = 0;
      }

      currentMapId = mapId;

      if (handleFight(engine, now)) return;

      if (now - lastFightEnd < CONFIG.afterFightMs) {
        return;
      }

      // Czekamy na odpowiedź gry po rozpoczęciu ataku.
      if (now < attackPendingUntil) {
        const npcs = getNpcs(engine);

        const stillExists = npcs.some(n =>
          String(n.id) === String(currentTargetId)
        );

        if (!stillExists) {
          attackPendingUntil = 0;
          currentTargetId = null;
        } else {
          setStatus('Oczekiwanie na walkę');
          return;
        }
      }


      const targets = getAllowedMonsters(engine);

      // Jeżeli jesteśmy w trakcie podchodzenia,
      // najpierw sprawdzamy poprzednio wybranego potwora.
      if (isApproachingMonster && approachingMonsterId !== null) {
        const trackedMonster = targets.find(
          n => String(n.id) === String(approachingMonsterId)
        );

        if (trackedMonster) {
          monsterLastSeen = now;

          // Kontynuujemy podchodzenie do tego samego potwora.
          const result = findNearestTarget(engine, [trackedMonster]);

          if (result) {
            const { npc, destination, path } = result;

            currentTargetId = npc.id;
            targetEl.textContent = `Cel: ${npc.nick}`;

            if (isAdjacent(engine.hero.d, npc)) {
              isApproachingMonster = false;
              approachingMonsterId = null;

              attackNpc(npc, now);
            } else {
              setStatus(
                `Podchodzę: ${npc.nick} (${path.length} kroków)`
              );

              moveTo(engine, destination, now);
            }

            return; // Nie sprawdzamy przejść do innych map.
          }
        }

        // Potwór chwilowo zniknął lub jest niedostępny.
        // Czekamy maksymalnie 5 sekund.
        if (now - monsterLastSeen < MONSTER_LOST_TIMEOUT) {
          setStatus('Oczekiwanie na aktualizację NPC');
          return;
        }

        // Potwór zniknął na stałe — odblokowujemy wybór celu.
        isApproachingMonster = false;
        approachingMonsterId = null;
        currentTargetId = null;
      }

      // Wyszukiwanie nowego potwora.
      if (targets.length > 0) {
        const result = findNearestTarget(engine, targets);

        if (result) {
          const { npc, destination, path } = result;

          currentTargetId = npc.id;
          targetEl.textContent = `Cel: ${npc.nick}`;

          // Anulujemy wybór przejścia do innej mapy.
          gatewayTarget = null;
          gatewayWaitingUntil = 0;
          gatewayAttempts = 0;

          if (isAdjacent(engine.hero.d, npc)) {
            isApproachingMonster = false;
            approachingMonsterId = null;

            attackNpc(npc, now);
          } else {
            isApproachingMonster = true;
            approachingMonsterId = npc.id;
            monsterLastSeen = now;

            setStatus(
              `Podchodzę: ${npc.nick} (${path.length} kroków)`
            );

            moveTo(engine, destination, now);
          }

          return;
        }
      }

      // Dopiero gdy nie mamy aktywnego celu
      // i nie znaleziono osiągalnego potwora,
      // możemy rozpocząć zmianę mapy.
      if (!isApproachingMonster) {
        currentTargetId = null;
        handleGateway(engine, now);
      }


    } catch (error) {
      console.error('[Farmer]', error);
      stop(`Błąd: ${error.message}`);
    }
  }

  function getSelectedIds() {
    return [...expList.querySelectorAll(
      'input[type="checkbox"]:checked'
    )]
      .map(el => Number(el.value))
      .filter(id => Number.isSafeInteger(id) && id > 0);
  }

  function updateSelectedCount() {
    const ids = getSelectedIds();

    selectedCountEl.textContent = `Wybrano: ${ids.length}`;

    if (!running) {
      try {
        localStorage.setItem(
          CONFIG.storageKey,
          JSON.stringify(ids)
        );
      } catch { }
    }
  }

  function setExpowiskaDisabled(disabled) {
    expList.querySelectorAll('input[type="checkbox"]')
      .forEach(checkbox => {
        checkbox.disabled = disabled;
      });
  }


  function loadExpowiska() {
    try {
      if (typeof GM_getResourceText !== 'function') {
        throw new Error('Brak GM_getResourceText.');
      }

      const json = GM_getResourceText('farmerData');
      const expowiska = JSON.parse(json);

      if (!Array.isArray(expowiska)) {
        throw new Error('Niepoprawny format expowiska.json.');
      }

      expowiskaCache = expowiska.filter(e =>
        Number.isSafeInteger(Number(e.id)) &&
        Number(e.id) > 0 &&
        typeof e.name === 'string' &&
        e.name.trim() &&
        e.lvl != null
      );

      // Pobierz wcześniej zaznaczone expowiska.
      let savedIds = [];

      try {
        const saved = localStorage.getItem(CONFIG.storageKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            savedIds = parsed.map(Number);
          }
        } else {
          // Migracja ze starego pojedynczego ID.
          const oldId = Number(
            localStorage.getItem('farmer-expowisko-id')
          );

          if (Number.isSafeInteger(oldId) && oldId > 0) {
            savedIds = [oldId];
          }
        }
      } catch { }

      const savedSet = new Set(savedIds);

      expList.replaceChildren();

      expowiskaCache.forEach(exp => {
        const label = document.createElement('label');
        label.className = 'farmer-exp-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(exp.id);
        checkbox.checked = savedSet.has(Number(exp.id));

        const text = document.createElement('span');
        text.textContent = `${exp.name} (${exp.lvl})`;

        label.appendChild(checkbox);
        label.appendChild(text);
        expList.appendChild(label);
      });

      expList.addEventListener('change', updateSelectedCount);

      updateSelectedCount();

      setStatus(
        `Załadowano ${expowiskaCache.length} expowisk`
      );

    } catch (error) {
      console.error(
        '[Farmer] Błąd ładowania expowisk:',
        error
      );

      expList.textContent = 'Błąd ładowania expowisk';
      setStatus(`Błąd: ${error.message}`);
    }
  }


  loadExpowiska();


  function start() {
    if (running) return;

    const ids = getSelectedIds();

    if (!ids.length) {
      setStatus('Wybierz przynajmniej jedno expowisko');
      return;
    }

    try {
      const selectedExpowiska = ids.map(id => {
        const exp = expowiskaCache.find(e =>
          Number(e.id) === id
        );

        if (!exp) {
          throw new Error(`Nie znaleziono expowiska ID ${id}.`);
        }

        if (!Array.isArray(exp.monsters)) {
          throw new Error(
            `Niepoprawna lista monsters: ${exp.name}`
          );
        }

        if (!Array.isArray(exp.maps)) {
          throw new Error(
            `Niepoprawna lista maps: ${exp.name}`
          );
        }

        return exp;
      });

      const engine = getEngine();

      // Suma potworów ze wszystkich zaznaczonych expowisk.
      allowedNames = new Set(
        selectedExpowiska
          .flatMap(exp => exp.monsters)
          .map(normalize)
          .filter(Boolean)
      );

      // Suma map ze wszystkich zaznaczonych expowisk.
      allowedMaps = new Set(
        selectedExpowiska
          .flatMap(exp => exp.maps)
          .map(normalize)
          .filter(Boolean)
      );

      if (!allowedNames.size) {
        throw new Error('Wybrane expowiska nie mają potworów.');
      }

      selectedIds = [...ids];

      mapLastVisited.clear();
      visitCounter = 0;
      lastVisitedMapId = null;
      lastVisitedMapName = null;

      registerMapVisit(engine);

      const startingMap = normalize(
        engine.map?.d?.name
      );

      gatewayTarget = null;
      gatewayPreviousMap = null;
      gatewayWaitingUntil = 0;
      lastGatewayAction = 0;
      gatewayAttempts = 0;

      running = true;
      attackCount = 0;
      currentTargetId = null;
      currentMapId = null;

      lastMove = 0;
      lastAttack = 0;
      lastFightEnd = 0;
      attackPendingUntil = 0;

      wasFighting = false;
      autoFightClicked = false;

      lastDestination = null;
      lastHeroPosition = null;
      stuckAttempts = 0;

      isApproachingMonster = false;
      approachingMonsterId = null;
      monsterLastSeen = 0;

      setExpowiskaDisabled(true);
      startBtn.disabled = true;
      stopBtn.disabled = false;

      targetEl.textContent = '';
      counterEl.textContent = 'Próby ataku: 0';

      setStatus(
        `Uruchomiono ${selectedExpowiska.length} expowisk`
      );

      try {
        localStorage.setItem(
          CONFIG.storageKey,
          JSON.stringify(selectedIds)
        );
      } catch { }

      console.log('[Farmer] Wybrane expowiska:', selectedExpowiska);
      console.log('[Farmer] Dozwolone potwory:', [...allowedNames]);
      console.log('[Farmer] Dozwolone mapy:', [...allowedMaps]);

      timer = setInterval(tick, CONFIG.tickMs);
      tick();

    } catch (error) {
      console.error('[Farmer]', error);
      setStatus(`Błąd: ${error.message}`);
    }
  }

  function stop(reason = 'Zatrzymany') {
    running = false;

    gatewayTarget = null;
    gatewayWaitingUntil = 0;
    gatewayAttempts = 0;

    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }

    const engine = game.Engine || window.Engine;

    if (Array.isArray(engine?.hero?.autoPath)) {
      engine.hero.autoPath = [];
    }

    setExpowiskaDisabled(false);

    isApproachingMonster = false;
    approachingMonsterId = null;
    monsterLastSeen = 0;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    currentTargetId = null;
    attackPendingUntil = 0;

    setStatus(reason);
    console.log('[Farmer] Stop:', reason);
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', () => stop());

  // Przeciąganie okna
  const dragHandle = $('.farmer-drag-handle');
  let drag = null;

  dragHandle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;

    event.preventDefault();

    const rect = root.getBoundingClientRect();
    const parentRect = root.offsetParent?.getBoundingClientRect()
      ?? { left: 0, top: 0 };

    drag = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top
    };

    dragHandle.setPointerCapture(event.pointerId);
  });

  dragHandle.addEventListener('pointermove', event => {
    if (!drag) return;

    root.style.left =
      `${Math.max(0, drag.left + event.clientX - drag.x)}px`;

    root.style.top =
      `${Math.max(0, drag.top + event.clientY - drag.y)}px`;
  });

  const endDrag = () => { drag = null; };

  dragHandle.addEventListener('pointerup', endDrag);
  dragHandle.addEventListener('pointercancel', endDrag);

  function destroy() {
    disableDobijara();
    stop();

    root.remove();
    style.remove();
    dobijaraStyle.remove();

    if (window.Farmer === api) {
      delete window.Farmer;
    }
  }

  $('.close-button').addEventListener('click', destroy);


  // ============================
  // DOBIJARA - tryb PvP
  // ============================

  const DOBIJARA_CONFIG = {
    tickMs: 400,
    moveRetryMs: 1500,
    attackRetryMs: 2500,
    fightTimeoutMs: 7000,
    lostTargetMs: 5000,
    afterFightMs: 1400,
    maxAttackAttempts: 5
  };

  const dobijara = {
    enabled: false,
    busy: false,
    timer: null,
    target: null,
    targetLastSeen: 0,
    lastMove: 0,
    lastAttack: 0,
    attackAttempts: 0,
    sawFight: false,
    autoFightClicked: false,
    resumeAt: 0,
    interruptedFarmer: false
  };

  const dobijaraPanel = document.createElement('div');
  dobijaraPanel.className = 'farmer-dobijara';

  dobijaraPanel.innerHTML = `
    <div class="farmer-dobijara-title">Dobijara</div>
    <button type="button" class="farmer-button farmer-dobijara-toggle">
      Uruchom
    </button>
    <div class="farmer-dobijara-status">
      Wyłączona
    </div>
  `;

  root.querySelector('.farmer-content').appendChild(
    dobijaraPanel
  );

  const dobijaraButton = dobijaraPanel.querySelector(
    '.farmer-dobijara-toggle'
  );

  const dobijaraStatus = dobijaraPanel.querySelector(
    '.farmer-dobijara-status'
  );

  const dobijaraStyle = document.createElement('style');

  dobijaraStyle.textContent = `
    #farmer-addon-window .farmer-dobijara {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #8f734b;
    }

    #farmer-addon-window .farmer-dobijara-title {
      font-size: 13px;
      font-weight: bold;
      color: #e7b95e;
      margin-bottom: 8px;
    }

    #farmer-addon-window .farmer-dobijara-toggle {
      width: 100%;
    }

    #farmer-addon-window .farmer-dobijara-status {
      margin-top: 7px;
      font-size: 11px;
      color: #caa169;
      overflow-wrap: anywhere;
    }
  `;

  document.head.appendChild(dobijaraStyle);

  function setDobijaraStatus(message) {
    dobijaraStatus.textContent = message;
  }

  // Relacje, których nigdy nie atakujemy.
  const protectedRelations = new Set([
    'fr',
    'cl',
    'cl-fr',
    'friends',
    'clan-members',
    'clan-friends',
    'friend',
    'clan',
    'ally',
    'alliance',
    'party',
    'party-members',
    'group',
    'self'
  ]);

  // Rozpoznane relacje pozwalające rozważyć atak.
  const hostileRelations = new Set([
    'en',
    'enemy',
    'enemies',
    'neutral',
    'none',
    'other',
    'no-relation',
    'hostile'
  ]);

  function getPlayersOnMap(engine) {
    const source = engine.whoIsHere?.getList?.();

    if (!source) return [];

    return Object.entries(source)
      .map(([key, value]) => {
        const d = value?.d ?? value;

        if (!d) return null;

        const relation = String(
          d.relation ?? d.relations ?? ''
        ).toLowerCase().trim();

        return {
          id: d.id ?? key,
          nick: d.nick ?? d.name ?? '',
          lvl: Number(d.lvl),
          x: Number(d.x),
          y: Number(d.y),
          relation,
          obj: value
        };
      })
      .filter(player =>
        player &&
        player.id != null &&
        Number.isFinite(player.x) &&
        Number.isFinite(player.y)
      );
  }

  function isHostilePlayer(player, engine) {
    const self = engine.hero.d;

    if (String(player.id) === String(self.id)) {
      return false;
    }

    if (
      normalize(player.nick) === normalize(self.nick)
    ) {
      return false;
    }

    if (protectedRelations.has(player.relation)) {
      return false;
    }

    // Brak rozpoznanej relacji:
    // nie ryzykujemy ataku na sojusznika.
    return hostileRelations.has(player.relation);
  }

  function findDobijaraTarget(engine) {
    const hero = engine.hero.d;

    return getPlayersOnMap(engine)
      .filter(player => isHostilePlayer(player, engine))
      .sort((a, b) => {
        const distanceA =
          Math.abs(a.x - hero.x) +
          Math.abs(a.y - hero.y);

        const distanceB =
          Math.abs(b.x - hero.x) +
          Math.abs(b.y - hero.y);

        return distanceA - distanceB;
      })[0] ?? null;
  }

  // Wyznaczenie osiągalnego pola obok gracza.
  function getDobijaraDestination(engine, player) {
    const hero = engine.hero.d;
    const map = engine.map;

    const width = Number(map?.d?.x ?? map?.size?.x);
    const height = Number(map?.d?.y ?? map?.size?.y);

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      typeof map?.col?.check !== 'function'
    ) {
      return null;
    }

    const startX = Number(hero.x);
    const startY = Number(hero.y);

    const key = (x, y) => `${x},${y}`;

    const queue = [[startX, startY]];
    const seen = new Set([key(startX, startY)]);

    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0]
    ];

    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];

      if (
        Math.abs(x - player.x) <= 1 &&
        Math.abs(y - player.y) <= 1
      ) {
        return { x, y, distance: i };
      }

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nextKey = key(nx, ny);

        if (
          nx < 0 ||
          ny < 0 ||
          nx >= width ||
          ny >= height ||
          seen.has(nextKey) ||
          Number(map.col.check(nx, ny)) !== 0
        ) {
          continue;
        }

        seen.add(nextKey);
        queue.push([nx, ny]);
      }
    }

    return null;
  }

  function pauseFarmerForDobijara(player) {
    dobijara.interruptedFarmer = running;

    if (running) {
      stop('Wstrzymany przez Dobijarę');
    }

    dobijara.busy = true;
    dobijara.target = player;
    dobijara.targetLastSeen = Date.now();
    dobijara.lastMove = 0;
    dobijara.lastAttack = 0;
    dobijara.attackAttempts = 0;
    dobijara.sawFight = false;
    dobijara.autoFightClicked = false;
    dobijara.resumeAt = 0;

    setDobijaraStatus(`Cel: ${player.nick}`);

    console.log(
      '[Dobijara] Rozpoczynam pościg:',
      player
    );
  }

  function resumeFarmerAfterDobijara(reason) {
    const shouldResume =
      dobijara.interruptedFarmer &&
      dobijara.enabled;

    dobijara.busy = false;
    dobijara.target = null;
    dobijara.sawFight = false;
    dobijara.autoFightClicked = false;
    dobijara.resumeAt = 0;
    dobijara.interruptedFarmer = false;

    setDobijaraStatus(reason);

    console.log('[Dobijara]', reason);

    if (shouldResume) {
      start();
    }
  }

  function dobijaAttack(player, now) {
    const engine = getEngine();

    if (!dobijara.enabled || !isPvpEnabled(engine)) {
      return;
    }

    if (
      now - dobijara.lastAttack <
      DOBIJARA_CONFIG.attackRetryMs
    ) {
      return;
    }

    if (
      dobijara.attackAttempts >=
      DOBIJARA_CONFIG.maxAttackAttempts
    ) {
      resumeFarmerAfterDobijara(
        'Nie udało się rozpocząć walki'
      );
      return;
    }

    if (typeof game._g !== 'function') {
      resumeFarmerAfterDobijara(
        'Brak funkcji ataku'
      );
      return;
    }

    // Dla gracza używamy dodatniego ID.
    game._g(
      `fight&a=attack&id=${encodeURIComponent(player.id)}`
    );

    dobijara.lastAttack = now;
    dobijara.attackAttempts++;

    setDobijaraStatus(
      `Atakuję: ${player.nick} (${dobijara.attackAttempts})`
    );
  }

  function dobijaMove(engine, player, now) {
    if (
      now - dobijara.lastMove <
      DOBIJARA_CONFIG.moveRetryMs
    ) {
      return;
    }

    const destination = getDobijaraDestination(
      engine,
      player
    );

    if (!destination) {
      setDobijaraStatus(
        `Brak drogi do: ${player.nick}`
      );
      return;
    }

    if (typeof engine.hero.autoGoTo !== 'function') {
      resumeFarmerAfterDobijara(
        'Brak funkcji autoGoTo'
      );
      return;
    }

    engine.hero.autoGoTo({
      x: destination.x,
      y: destination.y
    });

    dobijara.lastMove = now;

    setDobijaraStatus(
      `Podążam za: ${player.nick}`
    );
  }

  function isPvpEnabled(engine) {
    const pvp = engine.map?.d?.pvp;

    // W starszym interfejsie wartość 2 oznaczała
    // mapę z bezwarunkowym PvP (czerwoną).
    // W aktualnym Engine wymaga to weryfikacji.
    return Number(pvp) === 2;
  }

  function dobijaraTick() {
    if (!dobijara.enabled) return;

    try {
      const engine = getEngine();
      const now = Date.now();

      // Dobijara działa wyłącznie na mapach PvP.
      if (!isPvpEnabled(engine)) {
        if (dobijara.busy) {
          // Przerwij pościg i wznów Farmera,
          // jeśli został wcześniej wstrzymany.
          resumeFarmerAfterDobijara(
            'Poza mapą PvP'
          );
        } else {
          setDobijaraStatus(
            'Oczekiwanie na mapę PvP'
          );
        }

        return;
      }

      // Pozostała część dotychczasowej funkcji...

      if (engine.dead) {
        disableDobijara();
        return;
      }

      const captcha = document.querySelector(
        '.captcha-window'
      );

      if (
        captcha &&
        captcha.getClientRects().length > 0
      ) {
        disableDobijara();
        return;
      }

      // Dobijara nie przerywa walk już trwających.
      const fighting = isFighting(engine);

      if (!dobijara.busy) {
        if (!running || fighting) return;

        const player = findDobijaraTarget(engine);

        if (player) {
          pauseFarmerForDobijara(player);
        }

        return;
      }

      // Wykrywanie zakończenia walki.
      if (fighting) {
        dobijara.sawFight = true;
        setDobijaraStatus('Walka PvP');

        if (!dobijara.autoFightClicked) {
          const autoButton = document.querySelector(
            '.auto-fight-btn'
          );

          if (autoButton) {
            autoButton.click();
            dobijara.autoFightClicked = true;
          }
        }

        return;
      }

      if (dobijara.sawFight) {
        if (!dobijara.resumeAt) {
          dobijara.resumeAt =
            now + DOBIJARA_CONFIG.afterFightMs;
        }

        if (now >= dobijara.resumeAt) {
          resumeFarmerAfterDobijara(
            'Walka zakończona'
          );
        }

        return;
      }

      const tracked = getPlayersOnMap(engine)
        .find(player =>
          String(player.id) ===
          String(dobijara.target?.id)
        );

      if (!tracked) {
        if (
          now - dobijara.targetLastSeen >
          DOBIJARA_CONFIG.lostTargetMs
        ) {
          resumeFarmerAfterDobijara(
            'Gracz opuścił mapę'
          );
        }

        return;
      }

      // Ponowna kontrola relacji.
      if (!isHostilePlayer(tracked, engine)) {
        resumeFarmerAfterDobijara(
          'Gracz jest chroniony relacją'
        );
        return;
      }

      dobijara.target = tracked;
      dobijara.targetLastSeen = now;

      const hero = engine.hero.d;

      const dx = Math.abs(hero.x - tracked.x);
      const dy = Math.abs(hero.y - tracked.y);

      // Zbliżamy się do pola sąsiadującego,
      // a grze pozostawiamy weryfikację zasięgu PvP.
      if (dx <= 1 && dy <= 1) {
        dobijaAttack(tracked, now);
      } else {
        dobijaMove(engine, tracked, now);
      }

    } catch (error) {
      console.error('[Dobijara]', error);

      resumeFarmerAfterDobijara(
        `Błąd: ${error.message}`
      );
    }
  }

  function enableDobijara() {
    if (dobijara.enabled) return;

    dobijara.enabled = true;
    dobijaraButton.textContent = 'Zatrzymaj';

    dobijara.timer = setInterval(
      dobijaraTick,
      DOBIJARA_CONFIG.tickMs
    );

    setDobijaraStatus('Aktywna - szukanie graczy');
  }

  function disableDobijara() {
    dobijara.enabled = false;

    if (dobijara.timer !== null) {
      clearInterval(dobijara.timer);
      dobijara.timer = null;
    }

    dobijaraButton.textContent = 'Uruchom';

    const wasBusy = dobijara.busy;

    if (wasBusy) {
      const engine = game.Engine || window.Engine;

      if (Array.isArray(engine?.hero?.autoPath)) {
        engine.hero.autoPath = [];
      }

      resumeFarmerAfterDobijara(
        'Dobijara wyłączona'
      );
    } else {
      setDobijaraStatus('Wyłączona');
    }
  }

  dobijaraButton.addEventListener('click', () => {
    if (dobijara.enabled) {
      disableDobijara();
    } else {
      enableDobijara();
    }
  });

  const api = {
    start,
    stop,
    destroy,
    getState: () => ({
      running,
      selectedIds,
      currentTargetId,
      attackCount,
      allowedNames: [...allowedNames],
      allowedMaps: [...allowedMaps],
      dobijara: {
        enabled: dobijara.enabled,
        busy: dobijara.busy,
        target: dobijara.target?.nick ?? null,
        attackAttempts: dobijara.attackAttempts
      }
    })
  };

  window.Farmer = api;
})();
