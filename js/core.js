/**********************************************
 * Ядро: токен, хранилище, API, утилиты
 * [FIX] Запрет выделения текста при долгом нажатии.
 **********************************************/

if (typeof window.MANIFEST === 'undefined' || !window.MANIFEST) {
  window.MANIFEST = { version: '—' };
}

function getToken() {
  return window.ANDROID_TOKEN || "SECURE_TOKEN_2025";
}

const IS_ANDROID = !!(window.androidApi && typeof window.androidApi === "object");

const storage = {
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  },
  load(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

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

function callAndroid(method, ...args) {
  if (!IS_ANDROID || typeof window.androidApi[method] !== "function") return null;
  try {
    return window.androidApi[method].call(window.androidApi, getToken(), ...args);
  } catch (e) {
    return null;
  }
}

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
    return parseInt(raw, 10) || 50;
  },
  setVolume(volume) {
    callAndroid('setvol', Math.min(100, Math.max(0, volume)));
  },
  
  requestMusicState() {
    callAndroid('requestMusicState');
  },
  
  onJsReady() { callAndroid('onJsReady'); },
  onClose() { callAndroid('onClose'); }
};

function handleCarResponse(raw) {
  let evt = raw;
  if (typeof raw === 'string') {
    try { evt = JSON.parse(raw); } catch { return; }
  }
  if (!evt || !evt.requestId) return;
  
  if (commandInFlight && evt.requestId === commandInFlight.requestId) {
    finishEnumCommand(evt.requestId);
    return;
  }

  const resolve = responseWaiters[evt.requestId];
  if (resolve) {
    delete responseWaiters[evt.requestId];
    resolve(evt.response);
  }
}

const _origOnAndroidEventCore = window.onAndroidEvent;
window.onAndroidEvent = function(type, data) {
  if (type === 'carResponse') handleCarResponse(data);
  if (typeof _origOnAndroidEventCore === 'function') {
    try { _origOnAndroidEventCore(type, data); } catch (e) {}
  }
};

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
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `position:fixed; top:5rem; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:0.8rem 1.5rem; border-radius:2rem; font-size:1rem; backdrop-filter:blur(5px); z-index:10000; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation:fadeInOutTop ${duration}ms ease-in-out; pointer-events:none;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Запрет выделения и контекстного меню на долгое нажатие
document.addEventListener('contextmenu', (e) => {
  // Разрешаем контекстное меню только для полей ввода
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
  if (element._lpHandlers && element._lpHandlers.teardown) element._lpHandlers.teardown();
  let pressTimer = null;
  let longPressTriggered = false;
  
  const start = (e) => {
    longPressTriggered = false;
    clearTimeout(pressTimer);
    if (preventDefaultOnStart && e.cancelable) e.preventDefault();
    
    // Принудительно снимаем выделение
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
  element.addEventListener('touchstart', start, { passive: !preventDefaultOnStart });
  element.addEventListener('touchend', end);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', end);
  element.addEventListener('mouseleave', cancel);
  element._lpHandlers = {
    teardown() {
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', cancel);
      element.removeEventListener('mousedown', start);
      element.removeEventListener('mouseup', end);
      element.removeEventListener('mouseleave', cancel);
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
      
      // Снимаем выделение при касании
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