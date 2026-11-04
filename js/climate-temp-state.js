/**********************************************
 * Модуль: Регулировка температуры климата — состояние
 * Часть 1 из 4.
 * [FIX] LO и HI — крайние значения, сверху и снизу пустых чисел нет.
 * [FIX] getTranslateY: поддержка matrix3d.
 * [FIX] buildCarouselValues: диапазон строго от LO до HI.
 **********************************************/

modules.climateTempState = (function() {
  const STEP = 1;
  const MIN_TEMP = 16;
  const MAX_TEMP = 30;

  const LO_VALUE = MIN_TEMP - 1; // 15 — отображается как "LO"
  const HI_VALUE = MAX_TEMP + 1; // 31 — отображается как "HI"

  const OPTIMISTIC_MS = 3000;
  const POLL_INTERVAL_MS = 5000;
  const SWIPE_THRESHOLD_PX = 25;
  const SWIPE_STEP_PX = 50;
  const CAROUSEL_ITEM_HEIGHT = 4.5;
  const CAROUSEL_EXTRA_STEPS = 3; // оставляем как есть для плавности, но ограничим генерацию
  const SYNC_REQUEST_TIMEOUT_MS = 2500;
  const COMMIT_DEBOUNCE_MS = 150;
  const FALLBACK_STEP_DELAY_MS = 300;
  const ABSOLUTE_TEMP_TIMEOUT_MS = 3000;

  const ZONE_LEFT_ID = 'climate-temp-zone-left';
  const ZONE_RIGHT_ID = 'climate-temp-zone-right';
  const CAROUSEL_OVERLAY_ID = 'climate-temp-carousel';

  const CMD = {
    driverUp: 'Driver_Temp_Up',
    driverDown: 'Driver_Temp_Down',
    passengerUp: 'Passenger_Temp_Up',
    passengerDown: 'Passenger_Temp_Down'
  };

  const state = {
    driverTemp: null,
    passengerTemp: null,
    syncEnabled: false,
    syncPending: false,
    optimistic: Object.create(null),
    pendingTarget: Object.create(null),
    enabled: true,
    initialized: false,
    disablingSync: false
  };

  function normalizeTemp(value) {
    if (typeof value === 'string') {
      const s = value.trim().toUpperCase();
      if (s === 'LO' || s === 'LOW') return LO_VALUE;
      if (s === 'HI' || s === 'HIGH') return HI_VALUE;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < -20 || n > 60) return null;
    return Math.round(n);
  }

  function formatTemp(temp) {
    if (temp === null || !Number.isFinite(temp)) return '—';
    if (temp <= LO_VALUE) return 'LO';
    if (temp >= HI_VALUE) return 'HI';
    return String(Math.round(temp));
  }

  function clampTemp(temp) {
    return Math.max(LO_VALUE, Math.min(HI_VALUE, temp));
  }

  function getRootFontSize() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }

  function getItemHeightPx() {
    return CAROUSEL_ITEM_HEIGHT * getRootFontSize();
  }

  function getTranslateY(el) {
    if (!el) return 0;
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return 0;

    const m2d = transform.match(/matrix\(([^)]+)\)/);
    if (m2d) {
      const parts = m2d[1].split(',').map(s => parseFloat(s.trim()));
      return Number.isFinite(parts[5]) ? parts[5] : 0;
    }

    const m3d = transform.match(/matrix3d\(([^)]+)\)/);
    if (m3d) {
      const parts = m3d[1].split(',').map(s => parseFloat(s.trim()));
      return Number.isFinite(parts[13]) ? parts[13] : 0;
    }

    return 0;
  }

  // FIX: генерируем только значения от LO до HI (без выхода за пределы)
  function buildCarouselValues() {
    const values = [];
    for (let t = LO_VALUE; t <= HI_VALUE; t += STEP) {
      values.push(Math.round(t));
    }
    return values;
  }

  return {
    STEP,
    MIN_TEMP,
    MAX_TEMP,
    LO_VALUE,
    HI_VALUE,
    OPTIMISTIC_MS,
    POLL_INTERVAL_MS,
    SWIPE_THRESHOLD_PX,
    SWIPE_STEP_PX,
    CAROUSEL_ITEM_HEIGHT,
    CAROUSEL_EXTRA_STEPS,
    SYNC_REQUEST_TIMEOUT_MS,
    COMMIT_DEBOUNCE_MS,
    FALLBACK_STEP_DELAY_MS,
    ABSOLUTE_TEMP_TIMEOUT_MS,
    ZONE_LEFT_ID,
    ZONE_RIGHT_ID,
    CAROUSEL_OVERLAY_ID,
    CMD,
    state,
    normalizeTemp,
    formatTemp,
    clampTemp,
    getRootFontSize,
    getItemHeightPx,
    getTranslateY,
    buildCarouselValues
  };
})();