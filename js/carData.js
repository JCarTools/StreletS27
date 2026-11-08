/**********************************************
 * Модуль: Данные автомобиля
 * [FIX] subscribe: защита от повторной подписки одного и того же callback.
 * [FIX] Используем requestCarDataAsync(key) вместо getCarData.
 * [FIX] Безопасный JSON.parse для updateFromEvent.
 * [FIX] startAutoUpdate останавливается при document.hidden — раньше интервал
 *       3000 мс продолжал дёргать Android-мост в свёрнутой вкладке/WebView,
 *       расходуя батарею и нагружая мост. При возврате — перезапускается,
 *       если был активен до скрытия.
 * [FIX] fetchData: защита от null-ответа requestCarDataAsync — не затираем
 *       lastData и не уведомляем подписчиков «пустотой».
 * [NEW] destroy(): снимает visibilitychange и останавливает поллинг.
 *       Вызывается из cleanupIntervals() в main.js.
 * [FIX] init(): защита от повторной инициализации.
 **********************************************/

modules.carData = (function() {
  let updateInterval = null;
  let callbacks = [];
  let lastData = null;
  let isPolling = false;
  let visibilityHandler = null;
  let wasActiveBeforeHidden = false;
  let currentIntervalMs = 5000;
  let initialized = false;

  async function fetchData() {
    if (isPolling) return;
    if (typeof android === 'undefined' || typeof android.requestCarDataAsync !== 'function') return;
    isPolling = true;

    try {
      const data = await android.requestCarDataAsync('all', 3000);
      // [FIX] null может означать и «нет данных», и таймаут — не затираем.
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
      if (!callbacks.includes(callback)) {
        callbacks.push(callback);
      }
      if (lastData) callback(lastData);
    }
  }

  function startTimer() {
    if (updateInterval) clearInterval(updateInterval);
    fetchData();
    updateInterval = setInterval(fetchData, currentIntervalMs);
  }

  function stopTimer() {
    if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
  }

  function startAutoUpdate(intervalMs = 5000) {
    currentIntervalMs = intervalMs;
    stopTimer();

    // [FIX] Не запускаем поллинг в свёрнутой вкладке.
    if (document.hidden) {
      wasActiveBeforeHidden = true;
      return;
    }
    wasActiveBeforeHidden = false;
    startTimer();
  }

  function stopAutoUpdate() {
    stopTimer();
    wasActiveBeforeHidden = false;
  }

  function updateFromEvent(data) {
    if (!data) return;
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch { return; }
    }
    // [FIX] Защита от невалидного типа.
    if (!parsed || typeof parsed !== 'object') return;
    lastData = parsed;
    notifyCallbacks(parsed);
  }

  function attachVisibilityHandler() {
    if (visibilityHandler) return;
    // [FIX] Останавливаем/возобновляем поллинг при скрытии/возврате.
    visibilityHandler = () => {
      if (document.hidden) {
        if (updateInterval) {
          wasActiveBeforeHidden = true;
          stopTimer();
        }
      } else if (wasActiveBeforeHidden) {
        wasActiveBeforeHidden = false;
        startTimer();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function destroy() {
    stopAutoUpdate();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    initialized = false;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    attachVisibilityHandler();
    startAutoUpdate(3000);
  }

  return {
    init,
    destroy,
    subscribe,
    fetchData,
    startAutoUpdate,
    stopAutoUpdate,
    updateFromEvent,
    getData: () => lastData
  };
})();