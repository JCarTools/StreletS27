/**********************************************
 * Модуль: Управление громкостью через свайп
 * Свайп по любой области экрана (кроме виджетов)
 * Индикатор полностью удалён
 * Добавлена возможность отключения через настройки
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
  let enabled = true;  // внутреннее состояние
  
  // Настройки
  const SWIPE_SENSITIVITY = 1.2;
  const MIN_MOVE_DISTANCE = 15;
  
  // Селекторы элементов, на которых свайп НЕ должен работать
  const EXCLUDE_SELECTORS = [
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
    '.picker-item'
  ];
  
  function updateEnabledState() {
    // Читаем настройку из storage при каждом вызове
    const settingEnabled = storage.load('setting_volumeSwipeEnabled');
    enabled = settingEnabled !== false; // по умолчанию true
    console.log('[VolumeSwipe] Состояние обновлено:', enabled ? 'включён' : 'выключен');
    return enabled;
  }
  
  function isEnabled() {
    // Проверяем актуальное состояние
    const settingEnabled = storage.load('setting_volumeSwipeEnabled');
    return settingEnabled !== false;
  }
  
  function shouldExclude(target) {
    for (const selector of EXCLUDE_SELECTORS) {
      if (target.closest(selector)) {
        return true;
      }
    }
    return false;
  }
  
  function showHint() {
    if (hintShown) return;
    
    const hintShownFlag = storage.load('volumeSwipeHintShown');
    if (hintShownFlag) return;
    
    hintShown = true;
    storage.save('volumeSwipeHintShown', true);
    
    const hint = document.createElement('div');
    hint.className = 'volume-hint';
    hint.textContent = '🎵 Проведите пальцем влево/вправо для регулировки громкости';
    document.body.appendChild(hint);
    
    setTimeout(() => hint.remove(), 3000);
  }
  
  function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'swipe-ripple-large';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 500);
  }
  
  function setVolumeFromSwipe(clientX, startClientX, startVol) {
    const deltaX = clientX - startClientX;
    const screenWidth = window.innerWidth;
    const volumeDelta = Math.round((deltaX / screenWidth) * 100 * SWIPE_SENSITIVITY);
    let newVolume = startVol + volumeDelta;
    
    newVolume = Math.min(100, Math.max(0, newVolume));
    newVolume = Math.round(newVolume);
    
    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      
      if (modules.volume && typeof modules.volume.setVolume === 'function') {
        modules.volume.setVolume(currentVolume, false);
      }
    }
  }
  
  function getTouchIdentifier(e) {
    if (e.touches && e.touches[0]) {
      return e.touches[0].identifier;
    }
    return null;
  }
  
  function handleTouchStart(e) {
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (shouldExclude(e.target)) return;
    
    if (e.touches && e.touches.length > 1) return;
    
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
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (!isSwiping) return;
    
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
      e.preventDefault();
    }
    
    if (hasMoved) {
      e.preventDefault();
      setVolumeFromSwipe(currentX, startX, startVolume);
    }
  }
  
  function handleTouchEnd(e) {
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (!isSwiping) return;
    
    if (hasMoved) {
      if (modules.volume && typeof modules.volume.getVolume === 'function') {
        currentVolume = modules.volume.getVolume();
      }
    }
    
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
  }
  
  function handleTouchCancel(e) {
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
  }
  
  // Обработчики для мыши (для отладки на ПК)
  let mouseDownPos = null;
  
  function handleMouseDown(e) {
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (shouldExclude(e.target)) return;
    
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
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (!isSwiping || touchIdentifier !== 'mouse') return;
    
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    
    if (!hasMoved && deltaX > MIN_MOVE_DISTANCE && deltaX > deltaY) {
      hasMoved = true;
      showHint();
      createRipple(e.clientX, e.clientY);
      e.preventDefault();
    }
    
    if (hasMoved) {
      e.preventDefault();
      setVolumeFromSwipe(e.clientX, startX, startVolume);
    }
  }
  
  function handleMouseUp(e) {
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (!isSwiping) return;
    
    if (hasMoved) {
      if (modules.volume && typeof modules.volume.getVolume === 'function') {
        currentVolume = modules.volume.getVolume();
      }
    }
    
    isSwiping = false;
    hasMoved = false;
    touchIdentifier = null;
    mouseDownPos = null;
  }
  
  function handleWheel(e) {
    // Проверяем актуальное состояние при каждом событии
    if (!isEnabled()) return;
    if (shouldExclude(e.target)) return;
    
    e.preventDefault();
    
    let newVolume = currentVolume;
    if (e.deltaY < 0) {
      newVolume = Math.min(100, currentVolume + 5);
    } else {
      newVolume = Math.max(0, currentVolume - 5);
    }
    
    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      if (modules.volume && typeof modules.volume.setVolume === 'function') {
        modules.volume.setVolume(currentVolume, false);
      }
    }
  }
  
  function setEnabled(value) {
    enabled = value !== false;
    console.log('[VolumeSwipe] Свайп регулировки громкости:', enabled ? 'включён' : 'выключен');
    
    if (!enabled) {
      // Сбрасываем активные состояния при отключении
      isSwiping = false;
      hasMoved = false;
      touchIdentifier = null;
      mouseDownPos = null;
    }
  }
  
  function init() {
    // Загружаем состояние из настроек
    const settingEnabled = storage.load('setting_volumeSwipeEnabled');
    enabled = settingEnabled !== false;
    console.log('[VolumeSwipe] Инициализация. Свайп регулировки громкости:', enabled ? 'включён' : 'выключен');
    
    // Touch события
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
    
    // Mouse события (для ПК)
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Колесико мыши
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    // Подписываемся на изменения громкости из других источников
    if (modules.volume && typeof modules.volume.subscribe === 'function') {
      modules.volume.subscribe((volume) => {
        currentVolume = volume;
      });
    }
    
    // Подписываемся на изменения в storage (для синхронизации настроек в реальном времени)
    window.addEventListener('storage', function(e) {
      if (e.key === 'setting_volumeSwipeEnabled') {
        const newValue = e.newValue === 'true' || (e.newValue !== 'false' && e.newValue !== null);
        enabled = newValue;
        console.log('[VolumeSwipe] Настройка изменена через storage:', enabled ? 'включён' : 'выключен');
        
        if (!enabled) {
          // Сбрасываем активные состояния при отключении
          isSwiping = false;
          hasMoved = false;
          touchIdentifier = null;
          mouseDownPos = null;
        }
      }
    });
    
    console.log('[VolumeSwipe] Инициализация завершена');
  }
  
  return {
    init,
    setEnabled
  };
})();