/**********************************************
 * Модуль: Управление громкостью
 **********************************************/

modules.volume = (function() {
  let currentVolume = 50;
  let callbacks = [];
  let volumeCheckInterval = null;
  let isInitialized = false;
  
  function fetchVolume() {
    try {
      const volume = android.getVolume();
      if (volume !== null && volume !== undefined && !isNaN(volume)) {
        const newVolume = parseInt(volume);
        if (newVolume !== currentVolume) {
          currentVolume = newVolume;
          notifyCallbacks(currentVolume);
        }
        return currentVolume;
      }
    } catch (e) {
      console.error('[Volume] Ошибка получения громкости:', e);
    }
    return currentVolume;
  }
  
  function setVolume(volume, showToastMsg = true) {
    let newVolume = Math.min(100, Math.max(0, parseInt(volume)));
    if (isNaN(newVolume)) return;
    if (newVolume === currentVolume) return;
    
    currentVolume = newVolume;
    android.setVolume(newVolume);
    
    if (showToastMsg && typeof showToast === 'function') {
      showToast(`Громкость: ${newVolume}%`, 1500);
    }
    
    notifyCallbacks(currentVolume);
  }
  
  function volumeUp(step = 5) {
    let newVolume = Math.min(100, currentVolume + step);
    setVolume(newVolume, true);
  }
  
  function volumeDown(step = 5) {
    let newVolume = Math.max(0, currentVolume - step);
    setVolume(newVolume, true);
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
  
  function startAutoCheck(intervalMs = 3000) {
    stopAutoCheck();
    volumeCheckInterval = setInterval(() => {
      fetchVolume();
    }, intervalMs);
  }
  
  function stopAutoCheck() {
    if (volumeCheckInterval) {
      clearInterval(volumeCheckInterval);
      volumeCheckInterval = null;
    }
  }
  
  function handleVolumeFromSystem(volume) {
    if (volume !== undefined && volume !== null) {
      const newVolume = parseInt(volume);
      if (!isNaN(newVolume) && newVolume !== currentVolume) {
        currentVolume = newVolume;
        notifyCallbacks(currentVolume);
      }
    }
  }
  
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    fetchVolume();
    // startAutoCheck(3000);  // <-- ЗАКОММЕНТИРОВАТЬ ЭТУ СТРОКУ
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