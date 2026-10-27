/**********************************************
 * Модуль: Данные автомобиля
 * [FIX] Используем requestCarDataAsync(key) вместо getCarData.
 * [FIX] Безопасный JSON.parse для updateFromEvent.
 **********************************************/

modules.carData = (function() {
  let updateInterval = null;
  let callbacks = [];
  let lastData = null;
  let isPolling = false;

  async function fetchData() {
    if (isPolling) return;
    isPolling = true;
    
    try {
      const data = await android.requestCarDataAsync('all', 3000);
      if (data) {
        lastData = data;
        notifyCallbacks(data);
      }
    } catch (e) {
      // noop
    } finally {
      isPolling = false;
    }
  }

  function notifyCallbacks(data) {
    callbacks.forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function subscribe(callback) {
    if (typeof callback === 'function') {
      callbacks.push(callback);
      if (lastData) callback(lastData);
    }
  }

  function startAutoUpdate(intervalMs = 5000) {
    stopAutoUpdate();
    fetchData();
    updateInterval = setInterval(fetchData, intervalMs);
  }

  function stopAutoUpdate() {
    if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
  }

  function updateFromEvent(data) {
    if (!data) return;
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch { return; }
    }
    lastData = parsed;
    notifyCallbacks(parsed);
  }

  return {
    init: () => startAutoUpdate(3000),
    subscribe,
    fetchData,
    startAutoUpdate,
    stopAutoUpdate,
    updateFromEvent,
    getData: () => lastData
  };
})();