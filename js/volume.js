/**********************************************
 * Модуль: Управление громкостью
 * Исправлено: корректная синхронизация со свайпом
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

  function fetchVolume() {
    try {
      const raw = android.getVolume();
      if (raw === null || raw === undefined) return currentVolume;

      const newVolume = parseInt(raw, 10);
      if (isNaN(newVolume) || newVolume < 0 || newVolume > 100) return currentVolume;

      if (isSuppressing() && newVolume !== lastSetValue) {
        console.warn('[Volume] poll', newVolume, '!= last set', lastSetValue, '— ignored');
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

  function setVolume(volume, showToastMsg = true) {
    let newVolume = Math.min(100, Math.max(0, parseInt(volume, 10)));
    if (isNaN(newVolume)) return;

    lastSetValue = newVolume;
    lastSetTime = Date.now();

    android.setVolume(newVolume);

    if (newVolume === currentVolume) return;

    currentVolume = newVolume;

    if (showToastMsg && typeof showToast === 'function') {
      showToast(`Громкость: ${newVolume}%`, 1500);
    }

    notifyCallbacks(currentVolume);
    
    // Дополнительно показываем индикатор, если есть модуль свайпа
    if (modules.volumeSwipe && typeof modules.volumeSwipe.showVolumeIndicator === 'function') {
      modules.volumeSwipe.showVolumeIndicator(currentVolume);
    }
  }

  function volumeUp(step = 5) {
    setVolume(Math.min(100, currentVolume + step), true);
  }

  function volumeDown(step = 5) {
    setVolume(Math.max(0, currentVolume - step), true);
  }

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
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
  }

  function startAutoCheck(intervalMs = 30000) {
    stopAutoCheck();
    volumeCheckInterval = setInterval(fetchVolume, intervalMs);
    console.log('[Volume] Автоопрос включён, интервал', intervalMs, 'мс');
  }

  function stopAutoCheck() {
    if (volumeCheckInterval) {
      clearInterval(volumeCheckInterval);
      volumeCheckInterval = null;
    }
  }

  function handleVolumeFromSystem(volume) {
    if (volume === undefined || volume === null) return;
    const newVolume = parseInt(volume, 10);
    if (isNaN(newVolume) || newVolume < 0 || newVolume > 100) return;

    lastSetValue = null;

    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      notifyCallbacks(currentVolume);
      
      // Показываем индикатор при внешнем изменении громкости
      if (modules.volumeSwipe && typeof modules.volumeSwipe.showVolumeIndicator === 'function') {
        modules.volumeSwipe.showVolumeIndicator(currentVolume);
      }
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    fetchVolume();

    // Включаем редкий опрос (раз в 30 секунд) для синхронизации
    startAutoCheck(30000);

    console.log('[Volume] Модуль инициализирован, громкость:', currentVolume);
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