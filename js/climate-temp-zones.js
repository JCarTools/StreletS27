/**********************************************
 * Модуль: Регулировка температуры климата — зоны и оптимистик
 * Часть 2 из 4.
 * [FIX] На машину отправляем числа: LO=15, HI=31 (без строк).
 * [NEW] climateSwipeInvert — направление свайпа.
 * [NEW] showClimateTempCarousel — карусель можно отключить в настройках.
 **********************************************/

modules.climateTempZones = (function() {
  const S = modules.climateTempState;
  const {
    STEP, MIN_TEMP, MAX_TEMP, LO_VALUE, HI_VALUE,
    OPTIMISTIC_MS, SWIPE_THRESHOLD_PX, SWIPE_STEP_PX,
    ZONE_LEFT_ID, ZONE_RIGHT_ID, CMD, state, normalizeTemp, formatTemp, clampTemp,
    COMMIT_DEBOUNCE_MS, FALLBACK_STEP_DELAY_MS, ABSOLUTE_TEMP_TIMEOUT_MS
  } = S;

  let zoneLeft = null;
  let zoneRight = null;

  const commitTimers = { driver: null, passenger: null };
  const committing = { driver: false, passenger: false };

  function isSwipeInverted() {
    return storage.load('setting_climateSwipeInvert') === 'Вверх — уменьшение';
  }

  function isCarouselEnabled() {
    return storage.load('setting_showClimateTempCarousel') !== false;
  }

  function isOffMode() {
    return document.body.classList.contains('off-mode');
  }

  function isWidgetsHidden() {
    return document.body.classList.contains('widgets-hidden');
  }

  function isPointInExcludedArea(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    const excludeSelectors = [
      '.dashboard', '.widget', '.widget_buttons',
      '.widget_player', '.widget_climate', '.widget_apps',
      '.widget_time', '.widget_weather', '.widget_navigation',
      '#sidebar', '.sidebar',
      '.picker-drawer', '.modal-overlay', '.modal-content',
      '.settings-modal-overlay', '.settings-modal-content',
      '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content',
      '#btnNetwork', '#btnClose', '#btnSettings', '#btnWallpaper',
      '#openSidebar', '#diagOverlay',
      '.climate-temp-carousel',
      '.off-mode-hint', '.toast-message',
      '.volume-indicator', '.volume-hint',
      '.speedtest-overlay'
    ];
    for (const sel of excludeSelectors) {
      if (el.closest && el.closest(sel)) return true;
    }
    return false;
  }

  async function ensureSyncDisabled() {
    if (!state.syncEnabled) return true;
    if (state.disablingSync) {
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (!state.disablingSync) {
            clearInterval(check);
            resolve(!state.syncEnabled);
          }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(!state.syncEnabled); }, S.SYNC_REQUEST_TIMEOUT_MS + 500);
      });
    }
    state.disablingSync = true;
    let ok = false;
    try {
      const res = await android.requestCarCommandAsync(
        { cmd: 'climate_set_sync', value: false },
        S.SYNC_REQUEST_TIMEOUT_MS
      );
      if (res && (res.success === true || res.status === 'ok')) {
        state.syncEnabled = false;
        ok = true;
        if (typeof modules.climateTempCarousel !== 'undefined' && modules.climateTempCarousel.refreshSyncButton) {
          modules.climateTempCarousel.refreshSyncButton();
        }
      }
    } catch (e) {
      console.warn('[ClimateTemp] ensureSyncDisabled error:', e);
    } finally {
      state.disablingSync = false;
    }
    return ok || !state.syncEnabled;
  }

  function renderZone(side) {
    const zone = side === 'driver' ? zoneLeft : zoneRight;
    if (!zone) return;
    const valueEl = zone.querySelector('.climate-temp-value');
    if (!valueEl) return;

    const temp = side === 'driver' ? state.driverTemp : state.passengerTemp;

    let html;
    if (temp === null || !Number.isFinite(temp)) {
      html = '—';
    } else {
      html = `${formatTemp(temp)}<span class="climate-temp-degree">°</span>`;
    }

    if (valueEl.innerHTML !== html) {
      valueEl.innerHTML = html;
      valueEl.classList.remove('climate-temp-value--pulse');
      void valueEl.offsetWidth;
      valueEl.classList.add('climate-temp-value--pulse');
    }
    zone.classList.toggle('climate-temp-zone--empty', temp === null);
  }

  function applyTempOptimistic(side, targetTemp, skipSync) {
    if (targetTemp === null || !Number.isFinite(targetTemp)) return;
    const clamped = clampTemp(Math.round(targetTemp));
    const current = side === 'driver' ? state.driverTemp : state.passengerTemp;
    if (current === clamped) return;

    if (side === 'driver') state.driverTemp = clamped;
    else state.passengerTemp = clamped;

    if (!skipSync && state.syncEnabled) {
      const otherSide = side === 'driver' ? 'passenger' : 'driver';
      if (otherSide === 'driver') state.driverTemp = clamped;
      else state.passengerTemp = clamped;
      state.optimistic[otherSide] = { value: clamped, until: Date.now() + OPTIMISTIC_MS };
      renderZone(otherSide);
    }

    state.optimistic[side] = { value: clamped, until: Date.now() + OPTIMISTIC_MS };
    state.pendingTarget[side] = clamped;
    renderZone(side);
  }

  function toAbsoluteValue(temp) {
    return Math.round(temp);
  }

  async function commitTempChange(side) {
    const target = state.pendingTarget[side];
    if (target === null || target === undefined) return;
    if (committing[side]) return;
    if (state.syncPending) return;

    if (side === 'passenger' && state.syncEnabled) {
      const ok = await ensureSyncDisabled();
      if (!ok) return;
    }

    committing[side] = true;
    try {
      const zone = side === 'driver' ? 1 : 2;
      const res = await android.requestCarCommandAsync(
        { cmd: 'climate_set_temperature', zone: zone, value: toAbsoluteValue(target) },
        ABSOLUTE_TEMP_TIMEOUT_MS
      );

      if (res && res.success === true) {
        if (side === 'driver') state.driverTemp = target;
        else state.passengerTemp = target;
        delete state.pendingTarget[side];
        return;
      }

      await sendRelativeSteps(side, target);
    } catch (e) {
      console.warn('[ClimateTemp] commitTempChange error:', e);
      try { await sendRelativeSteps(side, target); } catch (e2) {}
    } finally {
      committing[side] = false;
      delete state.pendingTarget[side];
    }
  }

  async function sendRelativeSteps(side, target) {
    const current = side === 'driver' ? state.driverTemp : state.passengerTemp;
    if (current === null) return;
    const diff = target - current;
    if (diff === 0) return;

    const isUp = diff > 0;
    const steps = Math.abs(diff);
    const cmd = side === 'driver'
      ? (isUp ? CMD.driverUp : CMD.driverDown)
      : (isUp ? CMD.passengerUp : CMD.passengerDown);

    for (let i = 0; i < steps; i++) {
      if (state.syncPending) break;
      if (typeof android !== 'undefined' && typeof android.runEnum === 'function') {
        try { android.runEnum(cmd); } catch (e) { console.warn('[ClimateTemp] runEnum error:', e); break; }
      }
      if (i < steps - 1) {
        await new Promise(r => setTimeout(r, FALLBACK_STEP_DELAY_MS));
      }
    }
  }

  function scheduleCommit(side) {
    if (commitTimers[side]) clearTimeout(commitTimers[side]);
    commitTimers[side] = setTimeout(() => {
      commitTimers[side] = null;
      commitTempChange(side);
    }, COMMIT_DEBOUNCE_MS);
  }

  function requestTempChange(side, targetTemp) {
    if (targetTemp === null || !Number.isFinite(targetTemp)) return;
    if (state.syncPending) return;
    const clamped = clampTemp(Math.round(targetTemp));
    applyTempOptimistic(side, clamped, side !== 'driver');
    scheduleCommit(side);
  }

  function attachSwipeHandlers(zone, side) {
    let startY = 0;
    let startX = 0;
    let startTemp = null;
    let tracking = false;
    let moved = false;

    const onStart = (e) => {
      if (!state.enabled) return;
      if (isOffMode()) return;
      if (isWidgetsHidden()) return;

      const point = e.touches ? e.touches[0] : e;
      if (!point) return;

      if (isPointInExcludedArea(point.clientX, point.clientY)) return;

      tracking = true;
      moved = false;
      startX = point.clientX;
      startY = point.clientY;
      startTemp = side === 'driver' ? state.driverTemp : state.passengerTemp;
      if (startTemp === null) startTemp = 22;
      zone.dataset.swiped = '0';
      zone.classList.add('climate-temp-zone--active');
    };

    const onMove = (e) => {
      if (!tracking) return;
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;

      const dy = point.clientY - startY;
      const dx = point.clientX - startX;

      if (!moved && Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        moved = true;
        if (e.cancelable) e.preventDefault();
      }

      if (moved) {
        if (e.cancelable) e.preventDefault();
        const steps = Math.trunc(dy / SWIPE_STEP_PX);
        if (steps !== 0 && startTemp !== null) {
          const invert = isSwipeInverted();
          const direction = invert ? 1 : -1;
          const target = clampTemp(startTemp + (steps * STEP * direction));
          applyTempOptimistic(side, target, side !== 'driver');
          startTemp = target;
          startY = point.clientY;
        }
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      zone.classList.remove('climate-temp-zone--active');
      if (moved) {
        zone.dataset.swiped = '1';
        setTimeout(() => { zone.dataset.swiped = '0'; }, 50);
        scheduleCommit(side);
      }
    };

    zone.addEventListener('touchstart', onStart, { passive: true });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd);
    zone.addEventListener('touchcancel', onEnd);

    zone.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  function createZone(side) {
    const zone = document.createElement('div');
    zone.id = side === 'driver' ? ZONE_LEFT_ID : ZONE_RIGHT_ID;
    zone.className = `climate-temp-zone climate-temp-zone--${side}`;
    zone.dataset.side = side;

    const valueEl = document.createElement('div');
    valueEl.className = 'climate-temp-value';
    valueEl.innerHTML = '—';
    zone.appendChild(valueEl);

    zone.addEventListener('click', (e) => {
      if (zone.dataset.swiped === '1') {
        zone.dataset.swiped = '0';
        return;
      }
      e.stopPropagation();
      // Проверяем настройку карусели
      if (!isCarouselEnabled()) return;
      if (typeof modules.climateTempCarousel !== 'undefined') {
        modules.climateTempCarousel.openCarousel(side);
      }
    });

    attachSwipeHandlers(zone, side);
    return zone;
  }

  function initZones() {
    zoneLeft = createZone('driver');
    zoneRight = createZone('passenger');
    document.body.appendChild(zoneLeft);
    document.body.appendChild(zoneRight);
    applyVisibility();
  }

  function applyVisibility() {
    const show = storage.load('setting_showClimateTemp');
    const enabled = show !== false;
    state.enabled = enabled;
    if (zoneLeft) zoneLeft.classList.toggle('climate-temp-zone--hidden', !enabled);
    if (zoneRight) zoneRight.classList.toggle('climate-temp-zone--hidden', !enabled);
  }

  function applyCarData(raw) {
    if (!raw) return;
    let payload;
    try {
      payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return; }
    if (!payload || typeof payload !== 'object') return;

    let driverTemp = null;
    let passengerTemp = null;
    let sync = null;

    const heat = (payload.heat && typeof payload.heat === 'object') ? payload.heat : null;
    if (heat && heat.driverTemp !== undefined) driverTemp = normalizeTemp(heat.driverTemp);
    if (heat && heat.passengerTemp !== undefined) passengerTemp = normalizeTemp(heat.passengerTemp);

    if (payload.cabinTemp && typeof payload.cabinTemp === 'object') {
      if (driverTemp === null) driverTemp = normalizeTemp(payload.cabinTemp.driverTemp);
      if (passengerTemp === null) passengerTemp = normalizeTemp(payload.cabinTemp.passengerTemp);
    }

    if (driverTemp === null) driverTemp = normalizeTemp(payload.driverTemp);
    if (passengerTemp === null) passengerTemp = normalizeTemp(payload.passengerTemp);

    if (payload.vehicle && typeof payload.vehicle === 'object') {
      if (driverTemp === null) driverTemp = normalizeTemp(payload.vehicle.driverTemp);
      if (passengerTemp === null) passengerTemp = normalizeTemp(payload.vehicle.passengerTemp);
    }

    if (payload.sync !== undefined) sync = Boolean(payload.sync);
    else if (payload.climate && typeof payload.climate === 'object' && payload.climate.sync !== undefined) sync = Boolean(payload.climate.sync);
    else if (heat && heat.sync !== undefined) sync = Boolean(heat.sync);

    const now = Date.now();
    let changed = false;

    if (sync !== null && state.syncEnabled !== sync) {
      state.syncEnabled = sync;
      if (typeof modules.climateTempCarousel !== 'undefined' && modules.climateTempCarousel.refreshSyncButton) {
        modules.climateTempCarousel.refreshSyncButton();
      }
    }

    const applyTemp = (side, value) => {
      if (value === null) return;
      const opt = state.optimistic[side];
      if (opt && now < opt.until) {
        if (Math.abs(value - opt.value) < 0.01) {
          delete state.optimistic[side];
        } else {
          return;
        }
      }
      const current = side === 'driver' ? state.driverTemp : state.passengerTemp;
      if (current !== value) {
        if (side === 'driver') state.driverTemp = value;
        else state.passengerTemp = value;
        changed = true;
      }
    };

    applyTemp('driver', driverTemp);
    applyTemp('passenger', passengerTemp);

    if (changed) {
      renderZone('driver');
      renderZone('passenger');
    }
  }

  function getZoneLeft() { return zoneLeft; }
  function getZoneRight() { return zoneRight; }
  function setZoneLeft(v) { zoneLeft = v; }
  function setZoneRight(v) { zoneRight = v; }

  return {
    initZones,
    applyVisibility,
    applyCarData,
    renderZone,
    requestTempChange,
    applyTempOptimistic,
    commitTempChange,
    ensureSyncDisabled,
    isSwipeInverted,
    isCarouselEnabled,
    getZoneLeft,
    getZoneRight,
    setZoneLeft,
    setZoneRight
  };
})();