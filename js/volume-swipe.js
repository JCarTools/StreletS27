/**********************************************
 * Модуль: Управление громкостью через свайп
 * [FIX] Экспортируется resetSwipeState (был вызов из main.js без определения).
 * [FIX] handleMouseMove: защита от mouseDownPos === null.
 * [FIX] handleWheel: синхронизация currentVolume с modules.volume.getVolume().
 * [FIX 5.4] SWIPE_SENSITIVITY заменена на адаптивную computeSensitivity().
 *       Раньше фикс 1.2 давал ~6% на 100 px при ширине 1920 px — свайп
 *       через 8+ экранов для полного диапазона. Теперь sensitivity
 *       масштабируется к ширине экрана: ~100 px свайпа ≈ 10% громкости
 *       независимо от разрешения (нормализация к 1000 px, ограничение [1.0, 2.5]).
 * [FIX 5.3-связанное] EXCLUDE_SELECTORS объединены в один составной селектор —
 *       один closest() вместо цикла по 20. Добавлены climate-temp-zone/carousel,
 *       onboarding, orientation-picker — чтобы свайп громкости не мешал им.
 * [FIX] resetSwipeState() также сбрасывает hintShown (подсказка покажется снова).
 * [FIX] handleTouchStart: если touchIdentifier уже установлен — игнорируем
 *       (защита от мультитача).
 **********************************************/

modules.volumeSwipe = (function() {
  let isSwiping = false;
  let hasMoved = false;
  let startX = 0;
  let startVolume = 50;
  let currentVolume = 50;
  let hintShown = false;
  let touchIdentifier = null;
  let touchStartPos = { x: 0, y: 0 };
  let enabled = true;
  let indicatorEl = null;
  let indicatorHideTimer = null;

  const MIN_MOVE_DISTANCE = 15;

  // [FIX 5.3-связанное] Один составной селектор исключённых областей.
  // Раньше был цикл по 20 селекторам — теперь один native closest().
  const EXCLUDE_SELECTOR = [
    '.dashboard',
    '.sidebar',
    '.picker-drawer',
    '.modal-overlay',
    '.modal-content',
    '#btnNetwork',
    '#btnClose',
    '.widget_player__btn',
    '.widget_player__track_line',
    '.widget_player__volume_slider',
    '.climate_slot',
    '.app_slot',
    '.widget_buttons',
    '.brand-footer',
    '.close-btn',
    '.drawer-close',
    '.wallpaper-item',
    '.custom-wallpaper-btn',
    '.settings-modal-overlay',
    '.settings-toggle',
    '.settings-range',
    '.settings-reset-btn',
    '.settings-close-btn',
    '.picker-item',
    // [FIX 5.3-связанное] Новые исключения.
    '.climate-temp-zone',
    '.climate-temp-carousel',
    '.onboarding-overlay',
    '.onboarding-content',
    '.orientation-picker-overlay',
    '.orientation-picker-content',
    '.volume-indicator',
    '.volume-hint'
  ].join(',');

  // [FIX 5.4] Адаптивная чувствительность: ~100 px свайпа ≈ 10% громкости
  // при любой ширине экрана. Нормализация к 1000 px, ограничение [1.0, 2.5].
  function computeSensitivity() {
    const w = window.innerWidth || 1000;
    const raw = w / 1000;
    return Math.max(1.0, Math.min(2.5, raw));
  }

  function isEnabled() {
    const settingEnabled = storage.load('setting_volumeSwipeEnabled');
    return settingEnabled !== false && enabled !== false;
  }

  function isOffMode() {
    return document.body.classList.contains('off-mode');
  }

  function shouldExclude(target) {
    if (isOffMode()) return true;
    if (!target || typeof target.closest !== 'function') return false;
    // [FIX 5.3-связанное] Один closest() по составному селектору.
    return !!target.closest(EXCLUDE_SELECTOR);
  }

  function getIndicator() {
    if (indicatorEl && document.body.contains(indicatorEl)) return indicatorEl;
    indicatorEl = document.getElementById('volume-indicator');
    if (!indicatorEl) {
      indicatorEl = document.createElement('div');
      indicatorEl.id = 'volume-indicator';
      indicatorEl.className = 'volume-indicator';
      indicatorEl.innerHTML = '<div class="volume-indicator__bar"><div class="volume-indicator__fill"></div></div><div class="volume-indicator__value">50%</div>';
      document.body.appendChild(indicatorEl);
    }
    return indicatorEl;
  }

  function showIndicator(vol) {
    const el = getIndicator();
    const fill = el.querySelector('.volume-indicator__fill');
    const value = el.querySelector('.volume-indicator__value');
    if (fill) fill.style.width = vol + '%';
    if (value) value.textContent = vol + '%';
    el.classList.add('visible');
    if (indicatorHideTimer) clearTimeout(indicatorHideTimer);
    indicatorHideTimer = setTimeout(() => {
      el.classList.remove('visible');
      indicatorHideTimer = null;
    }, 1200);
  }

  function showHint() {
    if (hintShown) return;
    if (storage.load('volumeSwipeHintShown')) return;
    hintShown = true;
    storage.save('volumeSwipeHintShown', true);
    const hint = document.createElement('div');
    hint.className = 'volume-hint';
    hint.textContent = '🎵 Свайп влево/вправо по фону — регулировка громкости';
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 3000);
  }

  function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'swipe-ripple-large';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }

  function setVolumeFromSwipe(clientX, startClientX, startVol) {
    const deltaX = clientX - startClientX;
    const screenWidth = window.innerWidth;
    if (screenWidth <= 0) return;
    // [FIX 5.4] Адаптивная чувствительность.
    const sensitivity = computeSensitivity();
    const volumeDelta = Math.round((deltaX / screenWidth) * 100 * sensitivity);
    let newVolume = startVol + volumeDelta;
    newVolume = Math.min(100, Math.max(0, newVolume));
    newVolume = Math.round(newVolume);
    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      if (modules.volume && typeof modules.volume.setVolume === 'function') {
        modules.volume.setVolume(currentVolume, false);
      }
      showIndicator(currentVolume);
    }
  }

  function getTouchIdentifier(e) {
    if (e.touches && e.touches[0]) return e.touches[0].identifier;
    return null;
  }

  function handleTouchStart(e) {
    if (!isEnabled()) return;
    if (shouldExclude(e.target)) return;
    if (e.touches && e.touches.length > 1) return;
    // [FIX] Защита от мультитача: если уже начали свайп — игнорируем.
    if (touchIdentifier !== null) return;
    touchIdentifier = getTouchIdentifier(e);
    touchStartPos = {
      x: e.touches ? e.touches[0].clientX : e.clientX,
      y: e.touches ? e.touches[0].clientY : e.clientY
    };
    startX = touchStartPos.x;
    if (modules.volume && typeof modules.volume.getVolume === 'function') {
      startVolume = modules.volume.getVolume();
      currentVolume = startVolume;
    }
    isSwiping = true;
    hasMoved = false;
  }

  function handleTouchMove(e) {
    if (!isEnabled() || !isSwiping) return;
    if (isOffMode()) {
      isSwiping = false;
      hasMoved = false;
      touchIdentifier = null;
      return;
    }
    if (e.touches) {
      const currentIdentifier = getTouchIdentifier(e);
      if (currentIdentifier !== touchIdentifier) return;
    }
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = Math.abs(currentX - touchStartPos.x);
    const deltaY = Math.abs(currentY - touchStartPos.y);
    if (!hasMoved && deltaX > MIN_MOVE_DISTANCE && deltaX > deltaY) {
      hasMoved = true;
      showHint();
      createRipple(currentX, currentY);
      showIndicator(currentVolume);
      if (e.cancelable) e.preventDefault();
    }
    if (hasMoved) {
      if (e.cancelable) e.preventDefault();
      setVolumeFromSwipe(currentX, startX, startVolume);
    }
  }

  function handleTouchEnd() {
    if (!isEnabled() || !isSwiping) return;
    if (hasMoved && modules.volume && typeof modules.volume.getVolume === 'function') {
      currentVolume = modules.volume.getVolume();
    }
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
  }

  function handleTouchCancel() {
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
  }

  let mouseDownPos = null;

  function handleMouseDown(e) {
    if (!isEnabled() || shouldExclude(e.target)) return;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    touchIdentifier = 'mouse';
    startX = e.clientX;
    if (modules.volume && typeof modules.volume.getVolume === 'function') {
      startVolume = modules.volume.getVolume();
      currentVolume = startVolume;
    }
    isSwiping = true;
    hasMoved = false;
  }

  function handleMouseMove(e) {
    if (!isEnabled() || !isSwiping || touchIdentifier !== 'mouse') return;
    if (!mouseDownPos) return;
    if (isOffMode()) {
      isSwiping = false;
      hasMoved = false;
      touchIdentifier = null;
      mouseDownPos = null;
      return;
    }
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    if (!hasMoved && deltaX > MIN_MOVE_DISTANCE && deltaX > deltaY) {
      hasMoved = true;
      showHint();
      createRipple(e.clientX, e.clientY);
      showIndicator(currentVolume);
      e.preventDefault();
    }
    if (hasMoved) {
      e.preventDefault();
      setVolumeFromSwipe(e.clientX, startX, startVolume);
    }
  }

  function handleMouseUp() {
    if (!isEnabled() || !isSwiping) return;
    if (hasMoved && modules.volume && typeof modules.volume.getVolume === 'function') {
      currentVolume = modules.volume.getVolume();
    }
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
    mouseDownPos = null;
  }

  function handleWheel(e) {
    if (!isEnabled() || shouldExclude(e.target)) return;
    e.preventDefault();

    // FIX: синхронизация с актуальным значением
    if (modules.volume && typeof modules.volume.getVolume === 'function') {
      const actual = modules.volume.getVolume();
      if (Number.isFinite(actual)) currentVolume = actual;
    }

    let newVolume = currentVolume;
    if (e.deltaY < 0) newVolume = Math.min(100, currentVolume + 5);
    else newVolume = Math.max(0, currentVolume - 5);
    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      if (modules.volume && typeof modules.volume.setVolume === 'function') {
        modules.volume.setVolume(currentVolume, false);
      }
      showIndicator(currentVolume);
    }
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (!enabled) {
      isSwiping = false;
      hasMoved = false;
      touchIdentifier = null;
      mouseDownPos = null;
    }
  }

  // FIX: экспортируем — main.js вызывает resetSwipeState() при blur/focus
  function resetSwipeState() {
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
    mouseDownPos = null;
  }

  let isInitialized = false;

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    const settingEnabled = storage.load('setting_volumeSwipeEnabled');
    enabled = settingEnabled !== false;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });

    if (modules.volume && typeof modules.volume.subscribe === 'function') {
      modules.volume.subscribe((volume) => { currentVolume = volume; });
    }

    window.addEventListener('storage', function(e) {
      if (e.key === 'setting_volumeSwipeEnabled') {
        const raw = e.newValue;
        let newValue = true;
        try {
          newValue = raw === null ? true : JSON.parse(raw) !== false;
        } catch { newValue = raw !== 'false'; }
        enabled = newValue;
        if (!enabled) {
          isSwiping = false;
          hasMoved = false;
          touchIdentifier = null;
          mouseDownPos = null;
        }
      }
    });
  }

  return { init, setEnabled, resetSwipeState };
})();