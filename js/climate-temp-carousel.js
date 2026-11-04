/**********************************************
 * Модуль: Регулировка температуры климата — карусель
 * Часть 3 из 4.
 * [NEW] Инверсия колеса при climateSwipeInvert = "Вверх — уменьшение".
 * [FIX] attachDragHandlers: сохранение и снятие window-обработчиков при closeCarousel.
 * [FIX] scrollToValue: защита от невалидного value.
 * [FIX] openCarousel: принудительно удаляем старый overlay, если остался в DOM.
 **********************************************/

modules.climateTempCarousel = (function() {
  const S = modules.climateTempState;
  const Z = modules.climateTempZones;
  const {
    STEP, MIN_TEMP, MAX_TEMP, CAROUSEL_OVERLAY_ID, state,
    formatTemp, clampTemp, getItemHeightPx, getTranslateY, buildCarouselValues
  } = S;

  let carouselOverlay = null;
  let carouselZone = null;
  let carouselAnimating = false;

  let activeWindowHandlers = null;

  function refreshSyncButton() {
    if (!carouselOverlay) return;
    const btn = carouselOverlay.querySelector('.climate-temp-carousel__sync-btn');
    if (btn) btn.classList.toggle('active', state.syncEnabled);
  }

  function scrollToValue(value) {
    if (!carouselOverlay) return;
    if (!Number.isFinite(value)) return;
    const wheel = carouselOverlay.querySelector('.climate-temp-carousel__wheel');
    const itemsContainer = carouselOverlay.querySelector('.climate-temp-carousel__items');
    if (!wheel || !itemsContainer) return;

    const overlayAtStart = carouselOverlay;

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
      if (carouselOverlay !== overlayAtStart) return;
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
    Z.requestTempChange(carouselZone, value);
  }

  function attachWheelHandlers(wheel, itemsContainer, values) {
    let wheelTimer = null;
    const overlayAtStart = carouselOverlay;

    const onWheel = (e) => {
      if (carouselOverlay !== overlayAtStart) return;
      e.preventDefault();
      if (carouselAnimating) return;

      // Инверсия: при "Вверх — уменьшение" скролл вниз (deltaY > 0) = увеличение
      const inverted = Z.isSwipeInverted();
      let dir = e.deltaY > 0 ? 1 : -1;
      if (inverted) dir = -dir;

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
        if (carouselOverlay !== overlayAtStart) return;
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
    const overlayAtStart = carouselOverlay;

    const snapToNearest = () => {
      if (carouselOverlay !== overlayAtStart) return;
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
        if (carouselOverlay !== overlayAtStart) return;
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
      if (carouselOverlay !== overlayAtStart) return;
      if (carouselAnimating) return;
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      dragging = true;
      startY = point.clientY;
      startTranslate = getTranslateY(itemsContainer);
      itemsContainer.style.transition = 'none';
    };

    const onMove = (e) => {
      if (carouselOverlay !== overlayAtStart) return;
      if (!dragging) return;
      const point = e.touches ? e.touches[0] : e;
      if (!point) return;
      if (e.cancelable) e.preventDefault();
      const dy = point.clientY - startY;
      // Инверсия: при "Вверх — уменьшение" перетаскиваем контент в обратную сторону
      const inverted = Z.isSwipeInverted();
      const effectiveDy = inverted ? -dy : dy;
      itemsContainer.style.transform = `translateY(${startTranslate + effectiveDy}px)`;
    };

    const onEnd = () => {
      if (carouselOverlay !== overlayAtStart) return;
      if (!dragging) return;
      dragging = false;
      snapToNearest();
    };

    wheel.addEventListener('touchstart', onStart, { passive: true });
    wheel.addEventListener('touchmove', onMove, { passive: false });
    wheel.addEventListener('touchend', onEnd);
    wheel.addEventListener('touchcancel', onEnd);
    wheel.addEventListener('mousedown', onStart);

    activeWindowHandlers = { onMove, onEnd };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
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
        S.SYNC_REQUEST_TIMEOUT_MS
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
    if (carouselOverlay) {
      const old = carouselOverlay;
      carouselOverlay = null;
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    const stray = document.getElementById(CAROUSEL_OVERLAY_ID);
    if (stray && stray.parentNode) stray.parentNode.removeChild(stray);

    if (activeWindowHandlers) {
      window.removeEventListener('mousemove', activeWindowHandlers.onMove);
      window.removeEventListener('mouseup', activeWindowHandlers.onEnd);
      activeWindowHandlers = null;
    }

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
      item.addEventListener('click', () => {
        if (carouselOverlay === overlay) scrollToValue(v);
      });
      itemsContainer.appendChild(item);
    });

    const safeIndex = values.indexOf(safeCurrent);
    const idx = safeIndex >= 0 ? safeIndex : Math.floor(values.length / 2);

    requestAnimationFrame(() => {
      if (carouselOverlay !== overlay) return;
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

  function closeCarousel() {
    if (!carouselOverlay) return;
    const overlay = carouselOverlay;
    carouselOverlay = null;
    carouselZone = null;
    carouselAnimating = false;

    if (activeWindowHandlers) {
      window.removeEventListener('mousemove', activeWindowHandlers.onMove);
      window.removeEventListener('mouseup', activeWindowHandlers.onEnd);
      activeWindowHandlers = null;
    }

    overlay.classList.remove('visible');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  return {
    openCarousel,
    closeCarousel,
    scrollToValue,
    refreshSyncButton
  };
})();