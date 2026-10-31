/**********************************************
 * Модуль: Регулировка температуры климата свайпом
 **********************************************/

modules.climateTemp = (function() {
  const STEP = 1;
  const MIN_TEMP = 16;
  const MAX_TEMP = 30;
  const OPTIMISTIC_MS = 3000;
  const POLL_INTERVAL_MS = 5000;
  const SWIPE_THRESHOLD_PX = 25;
  const SWIPE_STEP_PX = 50;
  const CAROUSEL_ITEM_HEIGHT = 4.5;
  const CAROUSEL_EXTRA_STEPS = 3;
  const SYNC_REQUEST_TIMEOUT_MS = 2500;

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
    enabled: true,
    initialized: false,
    disablingSync: false
  };

  let zoneLeft = null;
  let zoneRight = null;
  let carouselOverlay = null;
  let carouselZone = null;
  let carouselAnimating = false;
  let pollTimer = null;

  function normalizeTemp(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < -20 || n > 60) return null;
    return Math.round(n);
  }

  function formatTemp(temp) {
    if (temp === null || !Number.isFinite(temp)) return '—';
    return String(Math.round(temp));
  }

  function clampTemp(temp) {
    return Math.max(MIN_TEMP, Math.min(MAX_TEMP, temp));
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
        setTimeout(() => { clearInterval(check); resolve(!state.syncEnabled); }, SYNC_REQUEST_TIMEOUT_MS + 500);
      });
    }
    state.disablingSync = true;
    let ok = false;
    try {
      const res = await android.requestCarCommandAsync(
        { cmd: 'climate_set_sync', value: false },
        SYNC_REQUEST_TIMEOUT_MS
      );
      if (res && (res.success === true || res.status === 'ok')) {
        state.syncEnabled = false;
        ok = true;
        if (carouselOverlay) {
          const btn = carouselOverlay.querySelector('.climate-temp-carousel__sync-btn');
          if (btn) btn.classList.remove('active');
        }
      }
    } catch (e) {
      console.warn('[ClimateTemp] ensureSyncDisabled error:', e);
    } finally {
      state.disablingSync = false;
    }
    return ok || !state.syncEnabled;
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
      openCarousel(side);
    });

    attachSwipeHandlers(zone, side);
    return zone;
  }

  /**
   * Логика изменения температуры:
   *  - sync + driver: меняем обе стороны, sync не трогаем.
   *  - sync + passenger: сначала выключаем sync, потом меняем только пассажира.
   *  - no sync: меняем только выбранную сторону.
   */
  function requestTempChange(side, targetTemp) {
    if (targetTemp === null || !Number.isFinite(targetTemp)) return;
    const clamped = clampTemp(Math.round(targetTemp));

    if (side === 'passenger' && state.syncEnabled) {
      ensureSyncDisabled().then(ok => {
        if (ok) applyTempOptimistic('passenger', clamped, true);
      });
      return;
    }

    if (side === 'driver' && state.syncEnabled) {
      applyTempOptimistic('driver', clamped, false);
      return;
    }

    applyTempOptimistic(side, clamped, true);
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
          const target = clampTemp(startTemp + (-steps) * STEP);
          requestTempChange(side, target);
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

  /**
   * @param {string} side - 'driver' | 'passenger'
   * @param {number} targetTemp
   * @param {boolean} skipSync - если true, не копировать на противоположную сторону
   */
  function applyTempOptimistic(side, targetTemp, skipSync) {
    if (targetTemp === null || !Number.isFinite(targetTemp)) return;
    const clamped = clampTemp(Math.round(targetTemp));
    const current = side === 'driver' ? state.driverTemp : state.passengerTemp;
    if (current === clamped) return;

    const isUp = current === null ? true : clamped > current;
    const cmd = side === 'driver'
      ? (isUp ? CMD.driverUp : CMD.driverDown)
      : (isUp ? CMD.passengerUp : CMD.passengerDown);

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
    renderZone(side);

    if (typeof android !== 'undefined' && typeof android.runEnum === 'function') {
      try { android.runEnum(cmd); } catch (e) { console.warn('[ClimateTemp] runEnum error:', e); }
    }
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
      html = `${Math.round(temp)}<span class="climate-temp-degree">°</span>`;
    }

    if (valueEl.innerHTML !== html) {
      valueEl.innerHTML = html;
      valueEl.classList.remove('climate-temp-value--pulse');
      void valueEl.offsetWidth;
      valueEl.classList.add('climate-temp-value--pulse');
    }
    zone.classList.toggle('climate-temp-zone--empty', temp === null);
  }

  function buildCarouselValues() {
    const values = [];
    const start = MIN_TEMP - CAROUSEL_EXTRA_STEPS * STEP;
    const end = MAX_TEMP + CAROUSEL_EXTRA_STEPS * STEP;
    for (let t = start; t <= end + 0.001; t += STEP) {
      values.push(Math.round(t));
    }
    return values;
  }

  function getRootFontSize() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }

  function getItemHeightPx() {
    return CAROUSEL_ITEM_HEIGHT * getRootFontSize();
  }

  function getTranslateY(el) {
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return 0;
    const match = transform.match(/matrix\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map(s => parseFloat(s.trim()));
      return parts[5] || 0;
    }
    return 0;
  }

  async function setSync(newState, syncBtn, syncTextSpan) {
    if (state.syncPending) return;
    state.syncPending = true;
    if (syncBtn) {
      syncBtn.classList.add('pending');
      syncBtn.disabled = true;
    }
    if (syncTextSpan) syncTextSpan.textContent = 'Отправка...';

    let success = false;
    try {
      const res = await android.requestCarCommandAsync(
        { cmd: 'climate_set_sync', value: newState },
        SYNC_REQUEST_TIMEOUT_MS
      );
      if (res && (res.success === true || res.status === 'ok')) {
        success = true;
      }
    } catch (err) {
      console.warn('[ClimateTemp] Sync error:', err);
    } finally {
      state.syncPending = false;
      if (syncBtn) {
        syncBtn.classList.remove('pending');
        syncBtn.disabled = false;
      }
      if (syncTextSpan) syncTextSpan.textContent = 'Синхронно';
    }

    if (success) {
      state.syncEnabled = newState;
      if (syncBtn) syncBtn.classList.toggle('active', state.syncEnabled);

      if (state.syncEnabled && carouselZone === 'driver') {
        const currentTemp = state.driverTemp;
        if (currentTemp !== null) {
          const values = buildCarouselValues();
          const safeCurrent = clampTemp(currentTemp);
          if (values.includes(safeCurrent)) scrollToValue(safeCurrent);
        }
      }
      if (typeof showToast === 'function') {
        showToast(state.syncEnabled ? 'Синхронизация включена' : 'Синхронизация выключена', 1500);
      }
    } else {
      if (typeof showToast === 'function') {
        showToast('Машина отклонила команду синхронизации', 2000);
      }
    }
  }

  function openCarousel(side) {
    if (carouselOverlay) closeCarousel();
    carouselZone = side;
    const currentTemp = side === 'driver' ? state.driverTemp : state.passengerTemp;
    const safeCurrent = currentTemp !== null ? clampTemp(currentTemp) : 22;

    const overlay = document.createElement('div');
    overlay.id = CAROUSEL_OVERLAY_ID;
    overlay.className = 'climate-temp-carousel';

    const backdrop = document.createElement('div');
    backdrop.className = 'climate-temp-carousel__backdrop';
    overlay.appendChild(backdrop);

    const panel = document.createElement('div');
    panel.className = 'climate-temp-carousel__panel';

    const title = document.createElement('div');
    title.className = 'climate-temp-carousel__title';
    title.textContent = side === 'driver' ? 'Температура водителя' : 'Температура пассажира';
    panel.appendChild(title);

    const highlight = document.createElement('div');
    highlight.className = 'climate-temp-carousel__highlight';
    panel.appendChild(highlight);

    const wheel = document.createElement('div');
    wheel.className = 'climate-temp-carousel__wheel';
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'climate-temp-carousel__items';
    wheel.appendChild(itemsContainer);
    panel.appendChild(wheel);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'climate-temp-carousel__close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeCarousel(); });
    panel.appendChild(closeBtn);

    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = `climate-temp-carousel__sync-btn ${state.syncEnabled ? 'active' : ''}`;
    syncBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 2.1l4 4-4 4"/>
        <path d="M3 12.2v-2a4 4 0 0 1 4-4h14"/>
        <path d="M7 21.9l-4-4 4-4"/>
        <path d="M21 11.8v2a4 4 0 0 1-4 4H3"/>
      </svg>
      <span>Синхронно</span>
    `;
    const syncTextSpan = syncBtn.querySelector('span');

    let syncClickBusy = false;
    const handleSyncClick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (syncClickBusy || state.syncPending) return;
      syncClickBusy = true;
      setSync(!state.syncEnabled, syncBtn, syncTextSpan).finally(() => {
        setTimeout(() => { syncClickBusy = false; }, 200);
      });
    };
    syncBtn.addEventListener('click', handleSyncClick);

    panel.appendChild(syncBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    carouselOverlay = overlay;

    const values = buildCarouselValues();
    const itemHeightPx = getItemHeightPx();

    values.forEach((v, idx) => {
      const item = document.createElement('div');
      item.className = 'climate-temp-carousel__item';
      item.dataset.value = String(v);
      item.dataset.index = String(idx);
      item.innerHTML = `${formatTemp(v)}<span class="climate-temp-degree">°</span>`;
      item.addEventListener('click', () => scrollToValue(v));
      itemsContainer.appendChild(item);
    });

    const safeIndex = values.indexOf(safeCurrent);
    const idx = safeIndex >= 0 ? safeIndex : Math.floor(values.length / 2);

    requestAnimationFrame(() => {
      const wheelHeight = wheel.clientHeight;
      const centerOffset = wheelHeight / 2 - itemHeightPx / 2;
      const scrollY = idx * itemHeightPx - centerOffset;
      itemsContainer.style.transition = 'none';
      itemsContainer.style.transform = `translateY(${-scrollY}px)`;
      const items = Array.from(itemsContainer.children);
      updateActiveItem(items, idx);
    });

    attachWheelHandlers(wheel, itemsContainer, values);
    attachDragHandlers(wheel, itemsContainer, values);

    backdrop.addEventListener('click', () => closeCarousel());
  }

  function scrollToValue(value) {
    if (!carouselOverlay) return;
    const wheel = carouselOverlay.querySelector('.climate-temp-carousel__wheel');
    const itemsContainer = carouselOverlay.querySelector('.climate-temp-carousel__items');
    if (!wheel || !itemsContainer) return;

    const items = Array.from(itemsContainer.children);
    const targetItem = items.find(item => Number(item.dataset.value) === value);
    if (!targetItem) return;

    const idx = Number(targetItem.dataset.index);
    const itemHeightPx = getItemHeightPx();
    const wheelHeight = wheel.clientHeight;
    const centerOffset = wheelHeight / 2 - itemHeightPx / 2;
    const scrollY = idx * itemHeightPx - centerOffset;

    carouselAnimating = true;
    itemsContainer.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
    itemsContainer.style.transform = `translateY(${-scrollY}px)`;

    setTimeout(() => {
      carouselAnimating = false;
      itemsContainer.style.transition = '';
      updateActiveItem(items, idx);
      applyCarouselValue(value);
    }, 360);
  }

  function updateActiveItem(items, activeIdx) {
    items.forEach((item, i) => {
      item.classList.toggle('active', i === activeIdx);
    });
  }

  function applyCarouselValue(value) {
    if (!carouselZone) return;
    requestTempChange(carouselZone, value);
  }

  function attachWheelHandlers(wheel, itemsContainer, values) {
    let wheelTimer = null;
    const onWheel = (e) => {
      e.preventDefault();
      if (carouselAnimating) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const itemHeightPx = getItemHeightPx();
      const wheelHeight = wheel.clientHeight;
      const centerOffset = wheelHeight / 2 - itemHeightPx / 2;
      const currentTranslate = getTranslateY(itemsContainer);
      const scrollY = -currentTranslate;
      const currentIdx = Math.round((scrollY + centerOffset) / itemHeightPx);
      const nextIdx = Math.max(0, Math.min(values.length - 1, currentIdx + dir));
      if (nextIdx === currentIdx) return;

      const nextScrollY = nextIdx * itemHeightPx - centerOffset;

      carouselAnimating = true;
      itemsContainer.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      itemsContainer.style.transform = `translateY(${-nextScrollY}px)`;

      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        carouselAnimating = false;
        itemsContainer.style.transition = '';
        const items = Array.from(itemsContainer.children);
        updateActiveItem(items, nextIdx);
        applyCarouselValue(values[nextIdx]);
      }, 260);
    };
    wheel.addEventListener('wheel', onWheel, { passive: false });
  }

  function attachDragHandlers(wheel, itemsContainer, values) {
    let dragging = false;
    let startY = 0;
    let startTranslate = 0;
    let lastIdx = -1;

    const snapToNearest = () => {
      const itemHeightPx = getItemHeightPx();
      const wheelHeight = wheel.clientHeight;
      const centerOffset = wheelHeight / 2 - itemHeightPx / 2;
      const currentTranslate = getTranslateY(itemsContainer);
      const scrollY = -currentTranslate;
      const idx = Math.round((scrollY + centerOffset) / itemHeightPx);
      const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
      const snapScrollY = clampedIdx * itemHeightPx - centerOffset;
      itemsContainer.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      itemsContainer.style.transform = `translateY(${-snapScrollY}px)`;
      setTimeout(() => {
        itemsContainer.style.transition = '';
        const items = Array.from(itemsContainer.children);
        updateActiveItem(items, clampedIdx);
        if (clampedIdx !== lastIdx) {
          lastIdx = clampedIdx;
          applyCarouselValue(values[clampedIdx]);
        }
      }, 260);
    };

    const onStart = (e) => {
      if (carouselAnimating) return;
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      dragging = true;
      startY = point.clientY;
      startTranslate = getTranslateY(itemsContainer);
      itemsContainer.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!dragging) return;
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      if (e.cancelable) e.preventDefault();
      const dy = point.clientY - startY;
      itemsContainer.style.transform = `translateY(${startTranslate + dy}px)`;
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      snapToNearest();
    };

    wheel.addEventListener('touchstart', onStart, { passive: true });
    wheel.addEventListener('touchmove', onMove, { passive: false });
    wheel.addEventListener('touchend', onEnd);
    wheel.addEventListener('touchcancel', onEnd);
    wheel.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  function closeCarousel() {
    if (!carouselOverlay) return;
    const overlay = carouselOverlay;
    carouselOverlay = null;
    carouselZone = null;
    carouselAnimating = false;
    overlay.classList.remove('visible');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
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

    const heat = payload.heat || payload;
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
    else if (payload.climate && payload.climate.sync !== undefined) sync = Boolean(payload.climate.sync);
    else if (payload.heat && payload.heat.sync !== undefined) sync = Boolean(payload.heat.sync);

    const now = Date.now();
    let changed = false;

    if (sync !== null && state.syncEnabled !== sync) {
      state.syncEnabled = sync;
      if (carouselOverlay) {
        const btn = carouselOverlay.querySelector('.climate-temp-carousel__sync-btn');
        if (btn) btn.classList.toggle('active', state.syncEnabled);
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

  async function pollClimateState() {
    if (!isAndroid()) return;
    if (!state.enabled) return;
    if (document.hidden) return;
    try {
      const resp = await android.requestCarCommandAsync({ cmd: 'climate_get_state' }, 2500);
      if (resp && resp.success) {
        applyCarData({
          heat: {
            driverTemp: resp.driverTemperature,
            passengerTemp: resp.passengerTemperature,
            sync: resp.sync
          }
        });
      }
    } catch (e) {
      // noop
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollClimateState, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function applyVisibility() {
    const show = storage.load('setting_showClimateTemp');
    const enabled = show !== false;
    state.enabled = enabled;
    if (zoneLeft) zoneLeft.classList.toggle('climate-temp-zone--hidden', !enabled);
    if (zoneRight) zoneRight.classList.toggle('climate-temp-zone--hidden', !enabled);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    document.documentElement.style.setProperty('--climate-temp-opacity', storage.load('setting_climateTempOpacity') || 0.4);
    document.documentElement.style.setProperty('--climate-temp-font-size', (storage.load('setting_climateTempFontSize') || 8) + 'rem');

    zoneLeft = createZone('driver');
    zoneRight = createZone('passenger');

    document.body.appendChild(zoneLeft);
    document.body.appendChild(zoneRight);

    applyVisibility();

    if (modules.carData && typeof modules.carData.subscribe === 'function') {
      modules.carData.subscribe(applyCarData);
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.on('climateState', (data) => { if (data) applyCarData(data); });
      EventBus.on('carData', (data) => { if (data) applyCarData(data); });
    }

    setTimeout(() => {
      if (modules.carData && typeof modules.carData.fetchData === 'function') {
        modules.carData.fetchData();
      }
      pollClimateState();
    }, 500);

    startPolling();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        pollClimateState();
        startPolling();
      } else {
        stopPolling();
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'setting_showClimateTemp') {
        applyVisibility();
      }
    });

    console.log('[ClimateTemp] initialized');
  }

  function destroy() {
    stopPolling();
    closeCarousel();
    if (zoneLeft && zoneLeft.parentNode) zoneLeft.parentNode.removeChild(zoneLeft);
    if (zoneRight && zoneRight.parentNode) zoneRight.parentNode.removeChild(zoneRight);
    zoneLeft = null;
    zoneRight = null;
    state.initialized = false;
  }

  return {
    init,
    destroy,
    applyCarData,
    getDriverTemp: () => state.driverTemp,
    getPassengerTemp: () => state.passengerTemp
  };
})();