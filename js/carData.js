/**********************************************
 * Модуль: Данные автомобиля
 * [FIX] Используем requestCarDataAsync(key) вместо getCarData.
 *       Ключ "all" возвращает объект со всеми данными (климат, топливо, АКБ).
 **********************************************/

modules.carData = (function() {
  let updateInterval = null;
  let callbacks = [];
  let lastData = null;
  let isPolling = false;

  async function fetchData() {
    if (isPolling) return;
    isPolling = true;
    
    // Пробуем ключ "all" (как в эталоне app.js)
    const data = await android.requestCarDataAsync('all', 3000);
    
    if (data) {
      lastData = data;
      notifyCallbacks(data);
    }
    isPolling = false;
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

  // Для событий от моста (например, если авто само шлёт обновление)
  function updateFromEvent(data) {
    if (!data) return;
    let parsed = typeof data === 'string' ? JSON.parse(data) : data;
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