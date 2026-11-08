/**********************************************
 * Модуль: Регулировка температуры климата свайпом
 * Часть 4 из 4 — точка входа, публичный API.
 * [FIX] destroy(): использует Z.destroyZones() для полной очистки обработчиков зон.
 * [FIX] init(): защита от повторной инициализации (state.initialized).
 * [FIX] pollClimateState: защита от отсутствия requestCarCommandAsync.
 * [FIX] сохранение и снятие обработчиков visibilitychange/storage в destroy().
 * [FIX] destroy(): сбрасываем CSS-переменные --climate-temp-opacity и
 *       --climate-temp-font-size в исходные значения, чтобы после повторного
 *       init() со сменой настроек не оставались «висящие» значения от прошлой сессии.
 **********************************************/

modules.climateTemp = (function() {
  const S = modules.climateTempState;
  const Z = modules.climateTempZones;
  const C = modules.climateTempCarousel;
  const { state, POLL_INTERVAL_MS } = S;

  // [FIX] Дефолты для сброса CSS-переменных в destroy().
  const DEFAULT_TEMP_OPACITY = 0.4;
  const DEFAULT_TEMP_FONT_SIZE = '8rem';

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

    // Применяем актуальные настройки к CSS-переменным.
    document.documentElement.style.setProperty(
      '--climate-temp-opacity',
      storage.load('setting_climateTempOpacity') || DEFAULT_TEMP_OPACITY
    );
    document.documentElement.style.setProperty(
      '--climate-temp-font-size',
      (storage.load('setting_climateTempFontSize') || parseFloat(DEFAULT_TEMP_FONT_SIZE)) + 'rem'
    );

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
    // [FIX] Полная очистка зон и обработчиков.
    Z.destroyZones();
    // [FIX] Сбрасываем CSS-переменные к дефолтам — чтобы при повторном init()
    // (например, после «Сбросить всё») не оставались значения из прошлой сессии.
    document.documentElement.style.setProperty('--climate-temp-opacity', DEFAULT_TEMP_OPACITY);
    document.documentElement.style.setProperty('--climate-temp-font-size', DEFAULT_TEMP_FONT_SIZE);
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