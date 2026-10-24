/**********************************************
 * [DIAG] Визуальная диагностика для машины (без консоли).
 * [FIX] Добавлен перехват launcherCatalog.
 **********************************************/

const diag = (function() {
  let el = null;
  let lines = [];
  let started = false;

  let clickCount = 0;
  let clickFirstAt = 0;
  let clickResetTimer = null;
  const CLICKS_NEEDED = 10;
  const CLICK_WINDOW_MS = 3000;

  const IMPORTANT_EVENTS = new Set([
    'carResponse', 'climateState', 'carData', 'musicInfo', 'volumeChanged',
    'launcherCatalog' // <--- Добавили
  ]);

  function ensureEl() {
    if (el && document.body.contains(el)) return el;
    el = document.getElementById('diagOverlay');
    return el;
  }

  function render() {
    const node = ensureEl();
    if (!node) return;
    const closeBtn = node.querySelector('.diag-close');
    const content = node.querySelector('.diag-content');
    if (!closeBtn || !content) {
      node.innerHTML = '<button class="diag-close" aria-label="Закрыть">✕</button><div class="diag-content"></div>';
    }
    const c = node.querySelector('.diag-content');
    if (c) c.textContent = lines.join('\n');
    node.scrollTop = node.scrollHeight;
  }

  function log(...args) {
    const text = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    const ts = new Date().toLocaleTimeString('ru-RU');
    lines.push(`[${ts}] ${text}`);
    if (lines.length > 200) lines = lines.slice(-200);
    render();
  }

  function show() {
    const node = ensureEl();
    if (!node) return;
    render();
    node.classList.add('visible');
  }

  function hide() {
    const node = ensureEl();
    if (!node) return;
    node.classList.remove('visible');
  }

  function safeCall(name, fn) {
    try {
      const r = fn();
      let preview;
      try { preview = typeof r === 'string' ? r.slice(0, 300) : JSON.stringify(r).slice(0, 300); }
      catch { preview = String(r).slice(0, 300); }
      log(`${name} → ${preview}`);
      return r;
    } catch (e) {
      log(`${name} → ОШИБКА: ${e && e.message ? e.message : e}`);
      return null;
    }
  }

  function callApi(method, ...args) {
    if (!window.androidApi || typeof window.androidApi[method] !== 'function') {
      return `(метод ${method} отсутствует)`;
    }
    try {
      return window.androidApi[method].apply(window.androidApi, args);
    } catch (e) {
      return `ОШИБКА: ${e && e.message ? e.message : e}`;
    }
  }

  function runDiagnostics() {
    const TOKEN = window.ANDROID_TOKEN || "SECURE_TOKEN_2025";
    log('=== ДИАГНОСТИКА ===');
    log('TOKEN:', TOKEN);

    log('--- Каталог приложений ---');
    safeCall('requestLauncherCatalogAsync', () => {
      const id = 'diag_apps_' + Date.now();
      return callApi('requestLauncherCatalogAsync', TOKEN, id);
    });
    safeCall('getUserApps', () => callApi('getUserApps', TOKEN));

    log('=== ЖДУ carResponse ===');
  }

  function handleNetworkClick() {
    const now = Date.now();
    if (now - clickFirstAt > CLICK_WINDOW_MS) {
      clickFirstAt = now;
      clickCount = 0;
    }
    clickCount++;

    if (clickResetTimer) clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => {
      clickCount = 0;
      clickFirstAt = 0;
    }, CLICK_WINDOW_MS);

    if (clickCount >= CLICKS_NEEDED) {
      clickCount = 0;
      clickFirstAt = 0;
      if (clickResetTimer) { clearTimeout(clickResetTimer); clickResetTimer = null; }
      log('=== СЕРИЯ ИЗ 10 КЛИКОВ — ОТКРЫВАЮ ПЛАШКУ ===');
      show();
      runDiagnostics();
      return true;
    }
    return false;
  }

  function init() {
    if (started) return;
    started = true;

    const node = ensureEl();
    if (node) {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.diag-close')) {
          e.stopPropagation();
          hide();
        }
      });
      node.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.diag-close')) {
          e.stopPropagation();
        }
      });
    }

    log('Диагностика готова. 10 кликов по значку сети — открыть.');
  }

  function onEvent(type, data) {
    if (!IMPORTANT_EVENTS.has(type)) return;

    let preview;
    try {
      if (type === 'carResponse') {
        const evt = typeof data === 'string' ? JSON.parse(data) : data;
        const reqId = evt && evt.requestId ? evt.requestId : '?';
        const resp = evt && evt.response !== undefined ? evt.response : null;
        let respStr;
        try { respStr = (typeof resp === 'string') ? resp : JSON.stringify(resp); }
        catch { respStr = String(resp); }
        preview = `reqId=${reqId} response=${(respStr || '').slice(0, 500)}`;
      } else if (type === 'launcherCatalog') {
        preview = (typeof data === 'string') ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500);
      } else {
        preview = (typeof data === 'string') ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500);
      }
    } catch {
      preview = String(data).slice(0, 500);
    }
    log(`СОБЫТИЕ "${type}" → ${preview}`);
  }

  return { init, log, onEvent, show, hide, handleNetworkClick, runDiagnostics };
})();