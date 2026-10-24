/**********************************************
 * Модуль: Управление громкостью
 *  - handleVolumeFromSystem понимает объект {volume, value}
 *  - showToast контролируется вызывающим (default = false для внешних)
 **********************************************/

modules.volume = (function() {
  let currentVolume = 50;
  let callbacks = [];
  let volumeCheckInterval = null;
  let isInitialized = false;

  // Echo-suppression
  let lastSetValue = null;
  let lastSetTime = 0;
  const ECHO_SUPPRESS_MS = 4000;

  function isSuppressing() {
    return lastSetValue !== null && (Date.now() - lastSetTime) < ECHO_SUPPRESS_MS;
  }

  function parseVolumeValue(raw) {
    if (raw === undefined || raw === null) return null;
    const candidate = (typeof raw === 'object') ? (raw.volume ?? raw.value) : raw;
    const num = parseInt(candidate, 10);
    if (isNaN(num) || num < 0 || num > 100) return null;
    return num;
  }

  function fetchVolume() {
    try {
      const raw = android.getVolume();
      const newVolume = parseVolumeValue(raw);
      if (newVolume === null) return currentVolume;
      if (isSuppressing() && newVolume !== lastSetValue) {
        warn('[Volume] poll', newVolume, '!= last set', lastSetValue, '— ignored');
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

  /**
   * @param {number} volume
   * @param {boolean} showToastMsg — по умолчанию false, чтобы не спамить
   */
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
    log('[Volume] Автоопрос включён, интервал', intervalMs, 'мс');
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
    log('[Volume] Модуль инициализирован, громкость:', currentVolume);
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