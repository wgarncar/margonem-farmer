/** Farmer — panel UI do uruchomienia w konsoli Margonem. */
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
  let running = false;
  let selectedId = null;
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
  function start() {
    const id = Number(input.value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      status.textContent = 'Podaj poprawne ID expowiska.';
      input.focus();
      return;
    }
    selectedId = id;
    try { localStorage.setItem(KEY, String(id)); } catch {}
    setRunning(true);
    emit('start');
  }
  function stop() {
    if (!running) return;
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
  const api = { start, stop, destroy, getState: () => ({running, id: selectedId}) };
  window.Farmer = api;
})();