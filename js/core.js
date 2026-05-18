/**********************************************
 * My Black Window - Dashboard
 * Ядро: токен, хранилище, API, утилиты
 **********************************************/

const TOKEN = window.ANDROID_TOKEN || "SECURE_TOKEN_2025";
const IS_ANDROID = !!(window.androidApi && typeof window.androidApi === 'object');

// Общее хранилище
const storage = {
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error("Storage save error:", e); }
  },
  load(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { console.error("Storage load error:", e); return null; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch(e) { console.error("Storage remove error:", e); }
  }
};

// Android API с заглушками и диагностикой
const android = {
  call(method, ...args) {
    if (!IS_ANDROID) {
      console.warn(`Android API call '${method}' ignored – no Android bridge`);
      return null;
    }
    if (window.androidApi && typeof window.androidApi[method] === 'function') {
      try {
        const result = window.androidApi[method](...args);
        console.log(`[ANDROID] ${method} ->`, result);
        return result;
      } catch (e) { console.error(`Android API error [${method}]:`, e); }
    } else { console.warn(`Android API method not available: ${method}`); }
    return null;
  },
  runEnum(cmd) { this.call('runEnum', TOKEN, cmd); },
  getRunEnum() { return this.call('getRunEnum', TOKEN) || '[]'; },
  getRunEnumPic(cmd) { return this.call('getRunEnumPic', TOKEN, cmd); },
  getUserApps() { return this.call('getUserApps', TOKEN) || '[]'; },
  runApp(pkg) { this.call('runApp', TOKEN, pkg); },
  requestClimateState() { this.call('requestClimateState', TOKEN); },
  requestClimateStateForCommand(cmd) { this.call('requestClimateStateForCommand', TOKEN, cmd); },
  getCarData(key) { 
    const res = this.call('getCarData', TOKEN, key);
    return res || '{}';
  },
  // ДИАГНОСТИРОВАННЫЕ МЕТОДЫ ГРОМКОСТИ
  getVolume() {
    if (!IS_ANDROID) return 50;
    const vol = this.call('getvol', TOKEN);
    console.log(`[ANDROID] getvol вернул: ${vol}`);
    if (vol !== null && vol !== undefined && typeof vol === 'number' && vol >= 0 && vol <= 100) {
      return parseInt(vol);
    }
    console.warn('[ANDROID] getVolume вернул некорректное значение:', vol);
    return 50;
  },
  setVolume(volume) {
    const vol = Math.min(100, Math.max(0, volume));
    console.log(`[ANDROID] setVolume вызван с ${vol}`);
    if (IS_ANDROID) {
      const result = this.call('setvol', TOKEN, vol);
      console.log(`[ANDROID] setvol вернул:`, result);
      return result;
    } else {
      console.log('[ANDROID] заглушка setVolume:', vol);
      return null;
    }
  },
  requestMusicState() {
    this.call('requestMusicState', TOKEN);
  },
  onJsReady() { this.call('onJsReady', TOKEN); },
  onClose() { this.call('onClose', TOKEN); },
  onSettings() { this.call('onSettings', TOKEN); }
};

// Toast-уведомления
function showToast(message, duration = 3000) {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `position:fixed; top:5rem; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:0.8rem 1.5rem; border-radius:2rem; font-size:1rem; backdrop-filter:blur(5px); z-index:10000; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation:fadeInOutTop ${duration}ms ease-in-out; pointer-events:none;`;
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `@keyframes fadeInOutTop { 0% { opacity:0; transform:translateX(-50%) translateY(-20px); } 10% { opacity:1; transform:translateX(-50%) translateY(0); } 90% { opacity:1; transform:translateX(-50%) translateY(0); } 100% { opacity:0; transform:translateX(-50%) translateY(-20px); } }`;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Универсальное длинное нажатие
function makeLongPressable(element, callback, options = {}) {
  const { delay = 700, preventDefaultOnStart = false } = options;
  let pressTimer, longPressTriggered = false;
  
  const start = (e) => {
    longPressTriggered = false;
    clearTimeout(pressTimer);
    if (preventDefaultOnStart) e.preventDefault();
    pressTimer = setTimeout(() => { 
      longPressTriggered = true; 
      callback(element, e);
      element.setAttribute('data-long-pressed', 'true');
      setTimeout(() => element.removeAttribute('data-long-pressed'), 300);
    }, delay);
  };
  
  const cancel = () => clearTimeout(pressTimer);
  const end = (e) => {
    clearTimeout(pressTimer);
    if (longPressTriggered) {
      e?.preventDefault();
      longPressTriggered = false;
    }
  };
  
  element.addEventListener('touchstart', start, { passive: !preventDefaultOnStart });
  element.addEventListener('touchend', end);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', end);
  element.addEventListener('mouseleave', cancel);
}

// OEM Touch Feedback
function attachOemTouchFeedback(selector) {
  const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
  elements?.forEach?.((element) => {
    if (!element || element.dataset.oemTouchBound === '1') return;
    element.dataset.oemTouchBound = '1';

    let releaseTimer = null;
    let pointerActive = false;

    const clearRelease = () => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
    };

    const ensureRipple = (event) => {
      let ripple = element.querySelector('.touch-ripple');
      if (!ripple) {
        ripple = document.createElement('span');
        ripple.className = 'touch-ripple';
        element.appendChild(ripple);
      }
      const rect = element.getBoundingClientRect();
      const point = event?.touches?.[0] || event;
      const x = point?.clientX ?? (rect.left + rect.width / 2);
      const y = point?.clientY ?? (rect.top + rect.height / 2);
      ripple.style.left = `${x - rect.left}px`;
      ripple.style.top = `${y - rect.top}px`;
      ripple.getAnimations?.().forEach(anim => anim.cancel());
      ripple.style.animation = 'none';
      ripple.offsetHeight;
    };

    const press = (event) => {
      pointerActive = true;
      clearRelease();
      element.classList.remove('is-releasing');
      ensureRipple(event);
      element.classList.add('is-pressed');
    };

    const release = () => {
      if (!pointerActive && !element.classList.contains('is-pressed')) return;
      pointerActive = false;
      element.classList.remove('is-pressed');
      element.classList.add('is-releasing');
      clearRelease();
      releaseTimer = setTimeout(() => {
        element.classList.remove('is-releasing');
      }, 240);
    };

    element.addEventListener('pointerdown', press, { passive: true });
    element.addEventListener('pointerup', release, { passive: true });
    element.addEventListener('pointercancel', release, { passive: true });
    element.addEventListener('pointerleave', release, { passive: true });
    element.addEventListener('blur', release, true);
  });
}

// Глобальный лоадер
const loader = {
  show() { document.getElementById('global-loader')?.classList.remove('hidden'); },
  hide() { document.getElementById('global-loader')?.classList.add('hidden'); }
};

const modules = {};

const DEBUG = false;
const log = (...args) => DEBUG && console.log("[App]", ...args);
const warn = (...args) => console.warn("[App]", ...args);
const error = (...args) => console.error("[App]", ...args);