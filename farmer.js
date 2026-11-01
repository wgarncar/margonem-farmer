
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
    storageKey: 'farmer-expowisko-id'
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
          <label class="farmer-label" for="farmer-exp-id">
            ID expowiska
          </label>

          <input
            id="farmer-exp-id"
            class="farmer-input"
            type="number"
            min="1"
            step="1"
            placeholder="Wpisz ID..."
          />

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
  `;

  document.head.appendChild(style);

  (
    document.querySelector('.game-window-positioner') ||
    document.body
  ).appendChild(root);

  const $ = selector => root.querySelector(selector);

  const input = $('#farmer-exp-id');
  const startBtn = $('.farmer-start');
  const stopBtn = $('.farmer-stop');
  const statusEl = $('.farmer-status');
  const targetEl = $('.farmer-target');
  const counterEl = $('.farmer-counter');

  let running = false;
  let timer = null;
  let selectedId = null;
  let allowedNames = new Set();
  let allowedMaps = new Set();
let visitedMaps = new Set();

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

const MONSTER_LOST_TIMEOUT = 5000;

  try {
    input.value =
      localStorage.getItem(CONFIG.storageKey) || '';
  } catch {}

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
    return getNpcs(engine).filter(n =>
      allowedNames.has(normalize(n.nick)) &&
      (n.type === 2 || n.type === 3)
    );
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

function findNearestGateway(engine) {
  const gateways = getGateways(engine);

  const candidates = gateways
    .map(gateway => ({
      gateway,
      path: getGatewayPath(engine, gateway)
    }))
    .filter(item => item.path !== null);

  if (!candidates.length) return null;

  // Preferuj mapy jeszcze nieodwiedzone.
  let available = candidates.filter(item =>
    !visitedMaps.has(normalize(item.gateway.name))
  );

  // Po odwiedzeniu wszystkich dostępnych map
  // rozpoczynamy kolejną rundę.
  if (!available.length) {
    visitedMaps.clear();

    const currentName = normalize(engine.map?.d?.name);
    if (currentName) visitedMaps.add(currentName);

    available = candidates.filter(item =>
      normalize(item.gateway.name) !==
      normalize(gatewayPreviousMap)
    );

    if (!available.length) {
      available = candidates;
    }
  }

  available.sort((a, b) =>
    a.path.length - b.path.length
  );

  return available[0];
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
    visitedMaps.add(currentMapName);

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
        stopPropagation() {},
        preventDefault() {},
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


  function tick() {
    if (!running) return;

    try {
      const engine = getEngine();
      const now = Date.now();

      // Rejestrujemy mapę, na której aktualnie jesteśmy.
const currentName = normalize(engine.map?.d?.name);

if (currentName) {
  visitedMaps.add(currentName);
}

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

  function start() {
    if (running) return;

    const id = Number(input.value);

    if (!Number.isSafeInteger(id) || id < 1) {
      setStatus('Podaj poprawne ID expowiska');
      return;
    }

    try {
      if (typeof GM_getResourceText !== 'function') {
        throw new Error('Brak GM_getResourceText.');
      }

      const json = GM_getResourceText('farmerData');
      const expowiska = JSON.parse(json);

      if (!Array.isArray(expowiska)) {
        throw new Error('Niepoprawny format expowiska.json.');
      }

      const expowisko = expowiska.find(e =>
        Number(e.id) === id
      );

      if (!expowisko) {
        throw new Error(`Nie znaleziono expowiska ID ${id}.`);
      }

      if (!Array.isArray(expowisko.monsters) ||
          expowisko.monsters.length === 0) {
        throw new Error('Lista monsters jest pusta.');
      }

      getEngine();

      allowedNames = new Set(
        expowisko.monsters.map(normalize)
      );

      if (!Array.isArray(expowisko.maps)) {
  throw new Error('Wybrane expowisko nie ma listy maps.');
}

allowedMaps = new Set(
  expowisko.maps.map(normalize)
);

visitedMaps.clear();

const startingMap = normalize(
  getEngine().map?.d?.name
);

if (startingMap) {
  visitedMaps.add(startingMap);
}

gatewayTarget = null;
gatewayPreviousMap = null;
gatewayWaitingUntil = 0;
lastGatewayAction = 0;
gatewayAttempts = 0;

      selectedId = id;
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

      input.disabled = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;

      counterEl.textContent = 'Próby ataku: 0';
      setStatus(`Uruchomiony: ${expowisko.name}`);

      try {
        localStorage.setItem(CONFIG.storageKey, String(id));
      } catch {}

      console.log('[Farmer] Start:', expowisko);

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

    input.disabled = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    currentTargetId = null;
    attackPendingUntil = 0;

    setStatus(reason);
    console.log('[Farmer] Stop:', reason);
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', () => stop());

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !running) start();
  });

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
    stop();
    root.remove();
    style.remove();

    if (window.Farmer === api) {
      delete window.Farmer;
    }
  }

  $('.close-button').addEventListener('click', destroy);

  const api = {
    start,
    stop,
    destroy,
    getState: () => ({
      running,
      selectedId,
      currentTargetId,
      attackCount,
      allowedNames: [...allowedNames]
    })
  };

  window.Farmer = api;
})();
