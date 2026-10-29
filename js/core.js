/**********************************************
 * Ядро: токен, хранилище, API, утилиты
 * [FIX] IS_ANDROID вычисляется лениво (функция isAndroid + getter).
 * [FIX] Единая нормализация requestCarCommandAsync (2 и 3 аргумента).
 * [NEW] EventBus + onAndroidEvent dispatcher (идемпотентный).
 * [FIX] showToast защищён от отсутствия body.
 * [FIX] showToast поднят над каруселью температуры (z-index 40000).
 **********************************************/

if (typeof window.MANIFEST === 'undefined' || !window.MANIFEST) {
  window.MANIFEST = { version: '—' };
}

function getToken() {
  return window.ANDROID_TOKEN || "SECURE_TOKEN_2025";
}

/* Ленивая проверка Android-моста: window.androidApi может появиться позже. */
function isAndroid() {
  return !!(window.androidApi && typeof window.androidApi === "object");
}

/* Обратная совместимость: в старом коде используется IS_ANDROID как boolean. */
Object.defineProperty(window, 'IS_ANDROID', {
  configurable: true,
  get() { return isAndroid(); }
});

const storage = {
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  },
  load(key) {
    try { const v = localStorage.getItem(key); if (v === null) return null; return JSON.parse(v); } catch (e) { return null; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

// ---------- EventBus ----------

const EventBus = (function() {
  const listeners = Object.create(null);

  function on(type, fn) {
    if (typeof fn !== 'function') return () => {};
    if (!listeners[type]) listeners[type] = [];
    if (!listeners[type].includes(fn)) listeners[type].push(fn);
    return function off() {
      const arr = listeners[type];
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    };
  }

  function once(type, fn) {
    const off = on(type, function handler(data) {
      off();
      try { fn(data); } catch (e) { console.warn('[EventBus] once listener error:', e); }
    });
    return off;
  }

  function off(type, fn) {
    const arr = listeners[type];
    if (!arr) return;
    if (!fn) { delete listeners[type]; return; }
    const i = arr.indexOf(fn);
    if (i !== -1) arr.splice(i, 1);
  }

  function emit(type, data) {
    const arr = listeners[type];
    if (!arr || !arr.length) return;
    const snapshot = arr.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try { snapshot[i](data, type); } catch (e) { console.warn('[EventBus] listener error:', type, e); }
    }
  }

  return { on, once, off, emit };
})();
window.EventBus = EventBus;

// ---------- Async request helpers ----------

const responseWaiters = Object.create(null);
let requestSeq = 0;

function nextReqId(prefix) {
  requestSeq = (requestSeq + 1) % 1_000_000;
  return `${prefix}_${Date.now()}_${requestSeq}`;
}

function waitForResponse(requestId, timeoutMs = 3000) {
  return new Promise(resolve => {
    responseWaiters[requestId] = resolve;
    setTimeout(() => {
      if (responseWaiters[requestId]) {
        delete responseWaiters[requestId];
        resolve(null);
      }
    }, timeoutMs);
  });
}

function resolveResponseWaiter(requestId, response) {
  const resolve = responseWaiters[requestId];
  if (!resolve) return false;
  delete responseWaiters[requestId];
  resolve(response);
  return true;
}

function callAndroid(method, ...args) {
  if (!isAndroid() || typeof window.androidApi[method] !== "function") return null;
  try {
    return window.androidApi[method].call(window.androidApi, getToken(), ...args);
  } catch (e) {
    return null;
  }
}

// ---------- Enum command queue ----------

const commandQueue = [];
let commandInFlight = null;

function enqueueEnumCommand(command) {
  commandQueue.push({ command, requestId: null, watchdog: null });
  dispatchNextEnumCommand();
}

function dispatchNextEnumCommand() {
  if (commandInFlight || !commandQueue.length) return;
  const item = commandQueue.shift();
  item.requestId = nextReqId('enum');
  commandInFlight = item;

  const ok = callAndroid('requestRunEnumAsync', item.requestId, item.command);
  if (ok !== true) {
    finishEnumCommand(item.requestId);
    return;
  }
  item.watchdog = setTimeout(() => finishEnumCommand(item.requestId), 2500);
}

function finishEnumCommand(requestId) {
  const item = commandInFlight;
  if (!item || item.requestId !== requestId) return;
  clearTimeout(item.watchdog);
  commandInFlight = null;
  setTimeout(dispatchNextEnumCommand, 70);
}

function handleCarResponse(raw) {
  let evt = raw;
  if (typeof raw === 'string') {
    try { evt = JSON.parse(raw); } catch { return; }
  }
  if (!evt || !evt.requestId) return;

  if (commandInFlight && evt.requestId === commandInFlight.requestId) {
    finishEnumCommand(evt.requestId);
  }

  resolveResponseWaiter(evt.requestId, evt.response);

  EventBus.emit('carResponse', evt);
  EventBus.emit('carResponse:' + (evt.requestType || 'unknown'), evt);
}

/**
 * Нормализует JSON-команду: принимает объект, строку JSON или (уже собранную) строку.
 * Возвращает { payload: string, object: object|null }.
 */
function normalizeCommandPayload(json) {
  if (typeof json === 'string') {
    try { return { payload: json, object: JSON.parse(json) }; }
    catch { return { payload: json, object: null }; }
  }
  try { return { payload: JSON.stringify(json), object: json }; }
  catch { return { payload: '{}', object: null }; }
}

const android = {
  call: callAndroid,

  runEnum(cmd) {
    enqueueEnumCommand(cmd);
  },

  async requestCarDataAsync(key, timeoutMs = 3000) {
    const id = nextReqId('data_' + key);
    const ok = callAndroid('requestCarDataAsync', id, key);
    if (ok !== true) return null;
    const resp = await waitForResponse(id, timeoutMs);
    if (!resp) return null;
    if (typeof resp === 'string') {
      try { return JSON.parse(resp); } catch { return resp; }
    }
    return resp;
  },

  /**
   * Универсальный вызов команды авто.
   * Поддерживаются варианты:
   *   requestCarCommandAsync(json, timeoutMs)
   *   requestCarCommandAsync(token, requestId, json)   // проксируется на нативный мост
   */
  async requestCarCommandAsync(json, a2, a3) {
    // Вариант (token, requestId, json) — прокси на нативный метод с 3 аргументами
    if (typeof a3 !== 'undefined' && typeof a2 === 'string') {
      if (!isAndroid() || typeof window.androidApi.requestCarCommandAsync !== 'function') return null;
      const requestId = a2;
      const payload = (typeof a3 === 'string') ? a3 : JSON.stringify(a3);
      const accepted = window.androidApi.requestCarCommandAsync(getToken(), requestId, payload);
      if (accepted !== true) return null;
      const resp = await waitForResponse(requestId, 3000);
      if (!resp) return null;
      if (typeof resp === 'string') { try { return JSON.parse(resp); } catch { return resp; } }
      return resp;
    }

    // Вариант (json, timeoutMs)
    const timeoutMs = typeof a2 === 'number' ? a2 : 3000;
    const { payload } = normalizeCommandPayload(json);
    const id = nextReqId('cmd');
    const ok = callAndroid('requestCarCommandAsync', id, payload);
    if (ok !== true) return null;
    const resp = await waitForResponse(id, timeoutMs);
    if (!resp) return null;
    if (typeof resp === 'string') { try { return JSON.parse(resp); } catch { return resp; } }
    return resp;
  },

  getUserApps() {
    return callAndroid('getUserApps');
  },

  runApp(packageName) {
    return callAndroid('runApp', packageName);
  },

  getWeather() {
    const raw = callAndroid('getWeather');
    if (!raw) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  },

  refreshWeather(lat, lon) {
    return callAndroid('refreshWeather', lat, lon);
  },

  getFileList() {
    const raw = callAndroid('getFileList');
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  getFile(name) {
    return callAndroid('getFile', name);
  },

  getVolume() {
    const raw = callAndroid('getvol');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 50;
  },
  setVolume(volume) {
    callAndroid('setvol', Math.min(100, Math.max(0, volume)));
  },

  requestMusicState() {
    callAndroid('requestMusicState');
  },

  onJsReady() { callAndroid('onJsReady'); },
  onClose() { callAndroid('onClose'); },
  onSettings() { callAndroid('onSettings'); }
};

// ---------- Central dispatcher (идемпотентный) ----------

(function installAndroidEventDispatcher() {
  if (window.__androidEventDispatcherInstalled) return;
  window.__androidEventDispatcherInstalled = true;

  const preexisting = typeof window.onAndroidEvent === 'function' ? window.onAndroidEvent : null;

  window.onAndroidEvent = function(type, data) {
    if (type === 'carResponse') handleCarResponse(data);

    try { EventBus.emit(type, data); } catch (e) { console.warn('[EventBus] emit error:', e); }
    try { EventBus.emit('*', { type, data }); } catch (e) { console.warn('[EventBus] emit * error:', e); }

    if (preexisting) {
      try { preexisting(type, data); } catch (e) { /* noop */ }
    }
  };
})();

// ---------- Toast ----------

(function injectToastKeyframes() {
  if (document.getElementById('toast-keyframes-style')) return;
  const style = document.createElement('style');
  style.id = 'toast-keyframes-style';
  style.textContent = `
    @keyframes fadeInOutTop {
      0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      15% { opacity: 1; transform: translateX(-50%) translateY(0); }
      85% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
})();

function showToast(message, duration = 3000) {
  if (!document.body) return;
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  // z-index 40000 — выше любых оверлеев (карусель температуры 30000, QR 30000)
  toast.style.cssText = `position:fixed; top:5rem; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:0.8rem 1.5rem; border-radius:2rem; font-size:1rem; backdrop-filter:blur(5px); z-index:40000; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation:fadeInOutTop ${duration}ms ease-in-out; pointer-events:none;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ---------- Long press / OEM feedback ----------

document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('input, textarea')) return;
  e.preventDefault();
});

document.addEventListener('selectstart', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.target.closest('.dashboard, .widget, .widget_buttons, .app_slot, .climate_slot, .widget_player__btn, #btnNetwork, #btnClose, #btnSettings, #btnWallpaper, #openSidebar')) {
    e.preventDefault();
  }
});

function makeLongPressable(element, callback, options = {}) {
  const { delay = 700, preventDefaultOnStart = false } = options;
  if (!element) return;
  if (element._lpHandlers && element._lpHandlers.teardown) element._lpHandlers.teardown();
  let pressTimer = null;
  let longPressTriggered = false;
  let startX = 0, startY = 0;
  const MOVE_CANCEL_PX = 10;

  const start = (e) => {
    longPressTriggered = false;
    clearTimeout(pressTimer);
    if (preventDefaultOnStart && e.cancelable) e.preventDefault();

    const point = e.touches ? e.touches[0] : e;
    if (point) { startX = point.clientX; startY = point.clientY; }

    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }

    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      callback(element, e);
      element.setAttribute('data-long-pressed', 'true');
      setTimeout(() => element.removeAttribute('data-long-pressed'), 300);
    }, delay);
  };
  const cancel = () => { clearTimeout(pressTimer); pressTimer = null; };
  const end = (e) => {
    cancel();
    if (longPressTriggered && e && e.cancelable) e.preventDefault();
  };
  const move = (e) => {
    if (!pressTimer) return;
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_CANCEL_PX) cancel();
  };

  element.addEventListener('touchstart', start, { passive: !preventDefaultOnStart });
  element.addEventListener('touchend', end);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('touchmove', move, { passive: true });
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', end);
  element.addEventListener('mouseleave', cancel);
  element.addEventListener('mousemove', move);

  element._lpHandlers = {
    teardown() {
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', cancel);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('mousedown', start);
      element.removeEventListener('mouseup', end);
      element.removeEventListener('mouseleave', cancel);
      element.removeEventListener('mousemove', move);
      clearTimeout(pressTimer);
    }
  };
}

function attachOemTouchFeedback(selector) {
  const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
  if (!elements) return;
  const list = (elements instanceof Element) ? [elements] : Array.from(elements);
  list.forEach((element) => {
    if (!element || element.dataset.oemTouchBound === '1') return;
    element.dataset.oemTouchBound = '1';
    let releaseTimer = null;
    let pointerActive = false;
    const clearRelease = () => { if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; } };
    const ensureRipple = (event) => {
      let ripple = element.querySelector('.touch-ripple');
      if (!ripple) {
        ripple = document.createElement('span');
        ripple.className = 'touch-ripple';
        element.appendChild(ripple);
      }
      const rect = element.getBoundingClientRect();
      const point = event?.touches?.[0] || event;
      ripple.style.left = `${(point?.clientX ?? (rect.left + rect.width / 2)) - rect.left}px`;
      ripple.style.top = `${(point?.clientY ?? (rect.top + rect.height / 2)) - rect.top}px`;
      ripple.style.animation = '';
      void ripple.offsetWidth;
    };
    const press = (event) => {
      pointerActive = true;
      clearRelease();
      element.classList.remove('is-releasing');
      ensureRipple(event);
      element.classList.add('is-pressed');

      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }
    };
    const release = () => {
      if (!pointerActive && !element.classList.contains('is-pressed')) return;
      pointerActive = false;
      element.classList.remove('is-pressed');
      element.classList.add('is-releasing');
      clearRelease();
      releaseTimer = setTimeout(() => element.classList.remove('is-releasing'), 240);
    };
    element.addEventListener('pointerdown', press, { passive: true });
    element.addEventListener('pointerup', release, { passive: true });
    element.addEventListener('pointercancel', release, { passive: true });
    element.addEventListener('pointerleave', release, { passive: true });
    element.addEventListener('blur', release, true);
  });
}

const loader = {
  show() { document.getElementById('global-loader')?.classList.remove('hidden'); },
  hide() { document.getElementById('global-loader')?.classList.add('hidden'); }
};

const modules = {};
const log = (...args) => {};
const warn = (...args) => {};
const error = (...args) => {};