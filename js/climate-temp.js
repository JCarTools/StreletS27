/**********************************************
 * Модуль: Регулировка температуры климата свайпом
 * Часть 4 из 4 — точка входа, публичный API.
 * Подключение: climate-temp-state.js → climate-temp-zones.js → climate-temp-carousel.js → climate-temp.js
 * [FIX] pollClimateState: защита от отсутствия requestCarCommandAsync.
 * [FIX] сохранение и снятие обработчиков visibilitychange/storage в destroy().
 **********************************************/

modules.climateTemp = (function() {
  const S = modules.climateTempState;
  const Z = modules.climateTempZones;
  const C = modules.climateTempCarousel;
  const { state, POLL_INTERVAL_MS } = S;

  let pollTimer = null;
  let visibilityHandler = null;
  let storageHandler = null;

  async function pollClimateState() {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') return;
    if (!state.enabled) return;
    if (document.hidden) return;
    try {
      const resp = await android.requestCarCommandAsync({ cmd: 'climate_get_state' }, 2500);
      if (resp && resp.success) {
        Z.applyCarData({
          heat: {
            driverTemp: resp.driverTemperature,
            passengerTemp: resp.passengerTemperature,
            sync: resp.sync
          }
        });
      }
    } catch (e) {}
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollClimateState, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    document.documentElement.style.setProperty('--climate-temp-opacity', storage.load('setting_climateTempOpacity') || 0.4);
    document.documentElement.style.setProperty('--climate-temp-font-size', (storage.load('setting_climateTempFontSize') || 8) + 'rem');

    Z.initZones();

    if (modules.carData && typeof modules.carData.subscribe === 'function') {
      modules.carData.subscribe(Z.applyCarData);
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.on('climateState', (data) => { if (data) Z.applyCarData(data); });
      EventBus.on('carData', (data) => { if (data) Z.applyCarData(data); });
    }

    setTimeout(() => {
      if (modules.carData && typeof modules.carData.fetchData === 'function') {
        modules.carData.fetchData();
      }
      pollClimateState();
    }, 500);

    startPolling();

    // FIX: сохраняем ссылки для снятия в destroy()
    visibilityHandler = () => {
      if (!document.hidden) {
        pollClimateState();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    storageHandler = (e) => {
      if (e.key === 'setting_showClimateTemp') {
        Z.applyVisibility();
      }
    };
    window.addEventListener('storage', storageHandler);

    console.log('[ClimateTemp] initialized');
  }

  function destroy() {
    stopPolling();
    C.closeCarousel();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler);
      storageHandler = null;
    }
    const left = Z.getZoneLeft();
    const right = Z.getZoneRight();
    if (left && left.parentNode) left.parentNode.removeChild(left);
    if (right && right.parentNode) right.parentNode.removeChild(right);
    Z.setZoneLeft(null);
    Z.setZoneRight(null);
    state.initialized = false;
  }

  return {
    init,
    destroy,
    applyCarData: Z.applyCarData,
    getDriverTemp: () => state.driverTemp,
    getPassengerTemp: () => state.passengerTemp
  };
})();