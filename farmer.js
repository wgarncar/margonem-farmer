
/** Farmer — kod ładowany przez Tampermonkey z @require. Wymaga @resource farmerData i @grant GM_getResourceText. */
(() => {
  const EXISTING = window.Farmer;
  if (EXISTING?.destroy) EXISTING.destroy();

  const ROOT_ID = 'farmer-addon-window';
  const STYLE_ID = 'farmer-addon-styles';
  const KEY = 'farmer-expowisko-id';
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = 'c-window border-window transparent farmer-window';
  root.setAttribute('data-opacity-lvl', '3');
  root.setAttribute('size-opt', '1');
  root.style.cssText = 'touch-action:none;position:absolute;left:270px;top:110px;display:block;z-index:10000;';
  root.innerHTML = `
    <div class="header-label-positioner">
      <div class="draggable-window-element pointer-draggable-handle farmer-drag-handle"></div>
      <div class="header-label">
        <div class="left-decor"></div><div class="right-decor"></div>
        <div class="text" name="Farmer">Farmer</div>
      </div>
    </div>
    <div class="content content--padding-md">
      <div class="inner-content">
        <div class="farmer-content">
          <label class="farmer-label" for="farmer-exp-id">ID expowiska</label>
          <input id="farmer-exp-id" class="farmer-input" type="number" min="1" step="1" placeholder="Wpisz ID..." />
          <div class="farmer-actions">
            <button type="button" class="farmer-button farmer-start">Start</button>
            <button type="button" class="farmer-button farmer-stop" disabled>Stop</button>
          </div>
          <div class="farmer-status" role="status" aria-live="polite">Status: Zatrzymany</div>
        </div>
      </div>
      <div class="window-controlls"></div>
    </div>
    <div class="c-window__bottom-bar"><div class="interface-element-bottom-bar-background-stretch"></div></div>
    <div class="close-button-corner-decor">
      <button type="button" class="close-button" aria-label="Zamknij Farmer"><div class="ie-icon ie-icon-close"></div></button>
    </div>
    <div class="border-image"></div>
  `;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} { width: 258px; box-sizing: border-box; color: #e5d4b0; }
    #${ROOT_ID} .farmer-drag-handle { cursor: move; touch-action: none; }
    #${ROOT_ID} .farmer-content { width: 212px; min-height: 125px; padding: 10px 4px 6px; box-sizing: border-box; }
    #${ROOT_ID} .farmer-label { display:block; margin-bottom: 6px; font-size: 12px; }
    #${ROOT_ID} .farmer-input { box-sizing:border-box; width:100%; padding:6px 8px; background:#211b17; color:#f7eddb; border:1px solid #8f734b; border-radius:3px; font:inherit; }
    #${ROOT_ID} .farmer-input:focus { outline:1px solid #caa169; }
    #${ROOT_ID} .farmer-actions { display:flex; gap:8px; margin-top:10px; }
    #${ROOT_ID} .farmer-button { flex:1; padding:6px 7px; cursor:pointer; color:#f7eddb; background:linear-gradient(#655035,#3b2c1d); border:1px solid #9a7b50; border-radius:3px; font:inherit; }
    #${ROOT_ID} .farmer-button:not(:disabled):hover { filter:brightness(1.2); }
    #${ROOT_ID} .farmer-button:disabled { cursor:default; opacity:.45; }
    #${ROOT_ID} .farmer-status { margin-top:10px; font-size:11px; min-height:16px; }
  `;
  document.head.appendChild(style);
  // Wykorzystujemy klasy oryginalnego interfejsu; style gry odpowiadają za ramkę i nagłówek.
  (document.querySelector('.game-window-positioner') || document.body).appendChild(root);

  const input = root.querySelector('#farmer-exp-id');
  const startBtn = root.querySelector('.farmer-start');
  const stopBtn = root.querySelector('.farmer-stop');
  const status = root.querySelector('.farmer-status');
  const closeBtn = root.querySelector('.close-button');
  const dragHandle = root.querySelector('.farmer-drag-handle');

  const gameWindow =
    typeof unsafeWindow !== 'undefined'
        ? unsafeWindow
        : window;

  let running = false;
  let selectedId = null;
  let requestVersion = 0;
  let currentTarget = null;
  try { input.value = localStorage.getItem(KEY) || ''; } catch {}

  function setRunning(value) {
    running = value;
    input.disabled = value;
    startBtn.disabled = value;
    stopBtn.disabled = !value;
    status.textContent = `Status: ${value ? `Uruchomiony (ID: ${selectedId})` : 'Zatrzymany'}`;
  }
  function emit(name) {
    window.dispatchEvent(new CustomEvent(`farmer:${name}`, {detail:{id: selectedId}}));
  }
  function normalize(name) {
    return String(name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
  }

  function getNpcs(engine) {
    const data = engine.npcs?.check?.() ?? engine.npcs?.getAll?.() ??
      engine.npcs?.getDrawableList?.();
    if (!data) throw new Error('Nie można odczytać NPC z silnika gry.');
    return (Array.isArray(data) ? data : Object.values(data))
      .map(item => item?.d ?? item)
      .filter(n => n && Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)))
      .map(n => ({ ...n, x: Number(n.x), y: Number(n.y) }));
  }

  // BFS od pozycji bohatera: pierwszy osiągnięty sąsiad pasującego NPC
  // gwarantuje najmniejszą liczbę kroków w czterech kierunkach.
  function findNearestTarget(engine, allowedNames) {
    const hero = engine.hero?.d;
    const map = engine.map;
    const width = Number(map?.d?.x ?? map?.size?.x);
    const height = Number(map?.d?.y ?? map?.size?.y);
    if (!hero || !Number.isInteger(width) || !Number.isInteger(height) ||
        !map?.col?.check) {
      throw new Error('Nie można odczytać pozycji postaci lub kolizji mapy.');
    }
    const hx = Number(hero.x), hy = Number(hero.y);
    const targets = getNpcs(engine).filter(n => allowedNames.has(normalize(n.nick ?? n.name)));
    if (!targets.length) throw new Error('Na aktualnej mapie nie ma NPC z tego expowiska.');

    const key = (x, y) => `${x},${y}`;
    const queue = [[hx, hy]];
    const visited = new Set([key(hx, hy)]);
    const previous = new Map();
    const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const isWalkable = (x, y) => x >= 0 && y >= 0 && x < width && y < height &&
      Number(map.col.check(x, y)) === 0;

    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      const target = targets.find(n => Math.abs(n.x - x) + Math.abs(n.y - y) === 1);
      if (target) {
        const path = [];
        let current = [x, y];
        while (key(...current) !== key(hx, hy)) {
          path.unshift({ x: current[0], y: current[1] });
          current = previous.get(key(...current));
        }
        return { target, destination: { x, y }, path, npcCount: targets.length };
      }
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy;
        if (visited.has(key(nx, ny)) || !isWalkable(nx, ny)) continue;
        visited.add(key(nx, ny));
        previous.set(key(nx, ny), [x, y]);
        queue.push([nx, ny]);
      }
    }
    throw new Error('Brak dostępnej ścieżki do NPC z wybranego expowiska.');
  }

  function start() {
    if (running) return;
    const id = Number(input.value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      status.textContent = 'Podaj poprawne ID expowiska.';
      input.focus();
      return;
    }
    selectedId = id;
    const version = ++requestVersion;
    setRunning(true);
    status.textContent = 'Status: Odczytywanie expowisk...';
    try {
      if (typeof GM_getResourceText !== 'function') {
        throw new Error('Brak GM_getResourceText. Dodaj @resource farmerData oraz @grant GM_getResourceText.');
      }
      const resourceText = GM_getResourceText('farmerData');
      if (!resourceText) throw new Error('Zasób farmerData jest pusty lub niedostępny.');
      const expowiska = JSON.parse(resourceText);
      if (!Array.isArray(expowiska)) throw new Error('Plik JSON musi zawierać tablicę expowisk.');
      const expowisko = expowiska.find(e => Number(e.id) === id);
      if (!expowisko) throw new Error(`Brak expowiska z ID ${id}.`);
      if (!Array.isArray(expowisko.monsters) || !expowisko.monsters.length) {
        throw new Error('Wybrane expowisko nie ma listy monsters.');
      }
      if (version !== requestVersion || !running) return;
      const engine = gameWindow.Engine;
      if (!engine) throw new Error('Nie znaleziono Engine.');
      const allowed = new Set(expowisko.monsters.map(normalize));
      const result = findNearestTarget(engine, allowed);
      if (version !== requestVersion || !running) return;
      currentTarget = result;
      try { localStorage.setItem(KEY, String(id)); } catch {}
      emit('start');
      console.log('[Farmer] Wybrane expowisko:', expowisko);
      console.log('[Farmer] Najbliższy dozwolony NPC i ścieżka:', result);
      window.dispatchEvent(new CustomEvent('farmer:target', {detail: {id, ...result}}));
      status.textContent = `Cel: ${result.target.nick ?? result.target.name} (${result.path.length} kroków)`;
      if (result.path.length > 0) {
        if (typeof engine.hero?.autoGoTo === 'function') {
          engine.hero.autoGoTo(result.destination);
        } else {
          status.textContent += ' — brak autoGoTo; trasa w konsoli';
        }
      } else {
        status.textContent = `Już obok: ${result.target.nick ?? result.target.name}`;
      }
    } catch (error) {
      if (version !== requestVersion || !running) return;
      console.error('[Farmer]', error);
      setRunning(false);
      status.textContent = `Błąd: ${error.message}`;
    }
  }
  function stop() {
    if (!running) return;
    ++requestVersion;
    // Anulujemy automatyczną trasę, jeśli silnik przechowuje ją jako tablicę.
    if (Array.isArray(window.Engine?.hero?.autoPath)) window.Engine.hero.autoPath = [];
    currentTarget = null;
    setRunning(false);
    emit('stop');
  }
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !running) start(); });

  let drag = null;
  function onDragStart(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    const parentRect = root.offsetParent?.getBoundingClientRect() ?? {left:0,top:0};
    drag = { x:event.clientX, y:event.clientY, left:rect.left-parentRect.left, top:rect.top-parentRect.top };
    dragHandle.setPointerCapture(event.pointerId);
  }
  function onDragMove(event) {
    if (!drag) return;
    root.style.left = `${Math.max(0, drag.left + event.clientX - drag.x)}px`;
    root.style.top = `${Math.max(0, drag.top + event.clientY - drag.y)}px`;
  }
  function onDragEnd() { drag = null; }
  dragHandle.addEventListener('pointerdown', onDragStart);
  dragHandle.addEventListener('pointermove', onDragMove);
  dragHandle.addEventListener('pointerup', onDragEnd);
  dragHandle.addEventListener('pointercancel', onDragEnd);

  function destroy() {
    stop();
    root.remove();
    style.remove();
    if (window.Farmer === api) delete window.Farmer;
  }
  closeBtn.addEventListener('click', destroy);
  const api = { start, stop, destroy, getState: () => ({running, id: selectedId, target: currentTarget}), findNearestTarget };
  window.Farmer = api;
})();
