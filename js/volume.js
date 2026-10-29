/**********************************************
 * Модуль: Управление громкостью
 * handleVolumeFromSystem понимает объект {volume, value}.
 * [FIX] Улучшен парсинг данных из Android (включая массивы и вложенные объекты).
 * [FIX] fetchVolume(force) — принудительный опрос без защиты от эха.
 **********************************************/

modules.volume = (function() {
  let currentVolume = 50;
  let callbacks = [];
  let volumeCheckInterval = null;
  let isInitialized = false;

  let lastSetValue = null;
  let lastSetTime = 0;
  const ECHO_SUPPRESS_MS = 2000;

  function isSuppressing() {
    return lastSetValue !== null && (Date.now() - lastSetTime) < ECHO_SUPPRESS_MS;
  }

  function parseVolumeValue(raw) {
    if (raw === undefined || raw === null) return null;
    
    if (Array.isArray(raw) && raw.length > 0) {
      raw = raw[0];
    }
    
    let candidate = raw;
    if (typeof raw === 'object') {
      candidate = raw.volume ?? raw.value ?? raw.vol ?? raw.level;
    }
    
    if (typeof candidate === 'string') {
      candidate = candidate.replace(/[^0-9]/g, '');
    }

    const num = parseInt(candidate, 10);
    if (isNaN(num) || num < 0 || num > 100) return null;
    return num;
  }

  function fetchVolume(force = false) {
    try {
      const raw = android.getVolume();
      const newVolume = parseVolumeValue(raw);
      if (newVolume === null) return currentVolume;
      
      if (!force && isSuppressing() && newVolume !== lastSetValue) {
        return currentVolume;
      }
      
      if (newVolume !== currentVolume) {
        currentVolume = newVolume;
        notifyCallbacks(currentVolume);
      }
      return currentVolume;
    } catch (e) {
      console.error('[Volume] Ошибка получения громкости:', e);
    }
    return currentVolume;
  }

  function setVolume(volume, showToastMsg = false) {
    const newVolume = parseVolumeValue(volume);
    if (newVolume === null) return;

    lastSetValue = newVolume;
    lastSetTime = Date.now();

    android.setVolume(newVolume);

    if (newVolume === currentVolume) return;
    currentVolume = newVolume;

    if (showToastMsg && typeof showToast === 'function') {
      showToast(`Громкость: ${newVolume}%`, 1500);
    }
    notifyCallbacks(currentVolume);
  }

  function volumeUp(step = 5) { setVolume(Math.min(100, currentVolume + step), true); }
  function volumeDown(step = 5) { setVolume(Math.max(0, currentVolume - step), true); }

  function notifyCallbacks(volume) {
    callbacks.forEach(cb => {
      try { cb(volume); } catch (e) { console.error('[Volume] Callback error:', e); }
    });
  }

  function subscribe(callback) {
    if (typeof callback === 'function') {
      callbacks.push(callback);
      callback(currentVolume);
    }
  }

  function unsubscribe(callback) {
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  function startAutoCheck(intervalMs = 30000) {
    stopAutoCheck();
    volumeCheckInterval = setInterval(fetchVolume, intervalMs);
  }

  function stopAutoCheck() {
    if (volumeCheckInterval) {
      clearInterval(volumeCheckInterval);
      volumeCheckInterval = null;
    }
  }

  function handleVolumeFromSystem(volume) {
    const newVolume = parseVolumeValue(volume);
    if (newVolume === null) return;
    
    lastSetValue = null; 
    
    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      notifyCallbacks(currentVolume);
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;
    fetchVolume();
    startAutoCheck(30000);
  }

  return {
    init,
    getVolume: () => currentVolume,
    setVolume,
    volumeUp,
    volumeDown,
    subscribe,
    unsubscribe,
    fetchVolume,
    startAutoCheck,
    stopAutoCheck,
    handleVolumeFromSystem
  };
})();