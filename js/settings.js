/**********************************************
 * Модуль: Настройки приборной панели (модалка)
 * Отвечает ТОЛЬКО за модальное окно настроек.
 * Настройки автосмены обоев в сайдбаре — см. sidebar-settings.js
 **********************************************/

modules.settings = (function() {
  let modal = null;
  let isOpen = false;
  let isApplyingSetting = false;

  console.log('[Settings] Модуль загружен');

  const settingsConfig = {
    widgets: {
      title: 'Виджеты',
      settings: [
        { id: 'showClock', type: 'toggle', label: 'Показывать виджет часов', default: true },
        { id: 'showClimate', type: 'toggle', label: 'Показывать виджет климата', default: true },
        { id: 'showApps', type: 'toggle', label: 'Показывать виджет приложений', default: true },
        { id: 'showWeather', type: 'toggle', label: 'Показывать виджет погоды', default: false },
        { id: 'showMiniMap', type: 'toggle', label: 'Показывать виджет мини-карты', default: false },
        { id: 'showPlayer', type: 'toggle', label: 'Показывать виджет плеера', default: true },
        { id: 'miniMapTheme', type: 'select', label: 'Тема мини-карты', options: ['День', 'Ночь', 'Авто'], default: 'Ночь' },
        { id: 'widgetSize', type: 'range', label: 'Размер виджетов', min: 9, max: 20, step: 0.5, default: 13.5, unit: 'rem' },
        { id: 'widgetOpacity', type: 'range', label: 'Прозрачность виджетов и кнопок', min: 0.3, max: 1, step: 0.01, default: 1, unit: '' },
        { id: 'widgetBlur', type: 'range', label: 'Размытие фона', min: 0, max: 20, step: 1, default: 10, unit: 'px' }
      ]
    },
    climate: {
      title: 'Климат',
      settings: [
        { id: 'climateOffButton', type: 'toggle', label: 'Кнопка выключения всех устройств', default: true },
        { id: 'climateSlotsCount', type: 'select', label: 'Количество кнопок устройств', options: ['4', '6', '8'], default: '6' },
        { id: 'climateIconColor', type: 'select', label: 'Цвет иконок в кнопках', options: ['Белый', 'Черный'], default: 'Белый' }
      ]
    },
    fuel: {
      title: 'Настройка бака',
      settings: [
        { id: 'fuelTankSize', type: 'text', label: 'Размер бака (литров)', default: '60', placeholder: 'Например, 60' },
        { id: 'fuelDisplayMode', type: 'select', label: 'Показывать остаток', options: ['Проценты', 'Литры'], default: 'Проценты' }
      ]
    },
    clock: {
      title: 'Часы',
      settings: [
        { id: 'showClockWeather', type: 'toggle', label: 'Показывать температуру в часах', default: true },
        { id: 'showDate', type: 'toggle', label: 'Показывать дату', default: true },
        { id: 'showWeekday', type: 'toggle', label: 'Показывать день недели', default: true },
        { id: 'nightModeOnClockTap', type: 'toggle', label: 'Ночной режим по нажатию на часы', default: true }
      ]
    },
    player: {
      title: 'Плеер',
      settings: [
        { id: 'playerVolumeStep', type: 'range', label: 'Шаг изменения громкости', min: 1, max: 20, step: 1, default: 5, unit: '%' },
        { id: 'autoRequestMusicState', type: 'toggle', label: 'Автоматический запрос статуса', default: true },
        { id: 'volumeSwipeEnabled', type: 'toggle', label: 'Горизонтальный свайп по экрану → регулировка звука', default: true }
      ]
    },
    apps: {
      title: 'Приложения',
      settings: [
        { id: 'appsSlotsCount', type: 'select', label: 'Количество слотов приложений', options: ['2', '4', '6'], default: '4' },
        { id: 'showAppLabels', type: 'toggle', label: 'Показывать названия приложений', default: false }
      ]
    },
    behavior: {
      title: 'Поведение',
      settings: [
        { id: 'tapToChangeWallpaper', type: 'toggle', label: 'Тап по фону → смена обоев', default: true },
        { id: 'doubleTapToHideWidgets', type: 'toggle', label: 'Двойной тап по фону → скрыть виджеты', default: false }
      ]
    },
    offMode: {
      title: 'Черная заставка OFF-mode',
      settings: [
        { id: 'offModeHideClimate', type: 'toggle', label: 'Скрывать климат в OFF-mode', default: true },
        { id: 'offModeHideApps', type: 'toggle', label: 'Скрывать приложения в OFF-mode', default: true },
        { id: 'offModeHidePlayer', type: 'toggle', label: 'Скрывать плеер в OFF-mode', default: true },
        { id: 'offModeHideNetwork', type: 'toggle', label: 'Скрывать виджет сети и данных', default: true },
        { id: 'offModeHideMiniMap', type: 'toggle', label: 'Скрывать мини-карту в OFF-mode', default: true },
        { id: 'offModeHideRightButtons', type: 'toggle', label: 'Скрывать правые кнопки в OFF-mode', default: true }
      ]
    },
    about: {
      title: 'О панели',
      settings: [
        { id: 'version', type: 'info', label: 'Версия', value: '' },
        { id: 'author', type: 'info', label: 'Автор', value: '@Strelets27' },
        { id: 'qrCode', type: 'qr' }
      ]
    }
  };

  // ---------- load / save ----------

  function loadSetting(key) {
    const saved = storage.load(`setting_${key}`);
    if (saved !== null && saved !== undefined) return saved;
    for (const category of Object.values(settingsConfig)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.default !== undefined) return setting.default;
      }
    }
    return null;
  }

  function saveSetting(key, value) {
    storage.save(`setting_${key}`, value);
    applySetting(key, value);
  }

  function normalizeFuelDisplayMode(value) {
    if (value === 'Литры' || value === 'liters') return 'liters';
    if (value === 'Проценты' || value === 'percent') return 'percent';
    return 'percent';
  }

  function fuelDisplayModeToUi(value) {
    return value === 'liters' ? 'Литры' : 'Проценты';
  }

  function miniMapThemeToStorage(uiValue) {
    if (uiValue === 'Ночь') return 'night';
    if (uiValue === 'Авто') return 'auto';
    return 'day';
  }

  function miniMapThemeFromStorage(stored) {
    if (stored === 'night') return 'Ночь';
    if (stored === 'auto') return 'Авто';
    return 'День';
  }

  // ---------- apply ----------

  function applySetting(key, value) {
    if (isApplyingSetting) return;
    isApplyingSetting = true;
    try {
      switch (key) {
        case 'widgetSize': {
          document.documentElement.style.setProperty('--widget-size', value + 'rem');
          document.documentElement.style.setProperty('--clock-digit-size', `calc(${value}rem * 0.2)`);
          setTimeout(() => {
            const appsCount = loadSetting('appsSlotsCount');
            if (appsCount) updateAppsSlotsCount(parseInt(appsCount, 10));
            const climateCount = loadSetting('climateSlotsCount');
            if (climateCount) updateClimateSlotsCount(parseInt(climateCount, 10));
            const rightButtons = document.querySelector('.right-buttons');
            if (rightButtons) rightButtons.style.height = value + 'rem';
            const timeWidget = document.querySelector('.widget_time');
            if (timeWidget) timeWidget.style.width = value + 'rem';
            const navWidget = document.getElementById('widgetNavigation');
            if (navWidget) navWidget.style.width = value + 'rem';
          }, 10);
          break;
        }
        case 'widgetOpacity': applyOpacity(value); break;
        case 'widgetBlur':
          document.querySelectorAll('.widget, .picker-drawer, .sidebar, .modal-content, .settings-modal-content, .right-buttons').forEach(el => {
            el.style.backdropFilter = `blur(${value}px)`;
          });
          break;
        case 'showDate': {
          const dateDisplay = document.getElementById('dateDisplay');
          if (dateDisplay) dateDisplay.style.display = value ? 'block' : 'none';
          break;
        }
        case 'showWeekday': {
          const weekdayDisplay = document.getElementById('weekdayDisplay');
          if (weekdayDisplay) weekdayDisplay.style.display = value ? 'block' : 'none';
          break;
        }
        case 'tapToChangeWallpaper': storage.save('tapToChangeWallpaper', value); break;
        case 'nightModeOnClockTap':
          storage.save('nightModeOnClockTap', value);
          updateClockTapHandler();
          break;
        case 'climateOffButton':
          storage.save('climateOffButton', value);
          updateClimateOffButton();
          break;
        case 'climateSlotsCount':
          storage.save('climateSlotsCount', value);
          updateClimateSlotsCount(parseInt(value, 10));
          break;
        case 'climateIconColor':
          storage.save('climateIconColor', value);
          updateClimateIconColor(value);
          if (modules.climate && typeof modules.climate.updateIconColors === 'function') {
            modules.climate.updateIconColors();
          }
          break;
        case 'fuelTankSize':
          storage.save('setting_fuelTankSize', value);
          if (modules.fuel && typeof modules.fuel.refreshDisplay === 'function') modules.fuel.refreshDisplay();
          break;
        case 'fuelDisplayMode': {
          const mode = normalizeFuelDisplayMode(value);
          storage.save('setting_fuelDisplayMode', mode);
          if (modules.fuel && typeof modules.fuel.refreshDisplay === 'function') modules.fuel.refreshDisplay();
          break;
        }
        case 'showClockWeather':
          storage.save('setting_showClockWeather', value);
          if (modules.weather && typeof modules.weather.refreshClockDisplay === 'function') {
            modules.weather.refreshClockDisplay();
          }
          break;
        case 'showClock': {
          storage.save('setting_showClock', value);
          const clockWidget = document.querySelector('.widget_time');
          if (clockWidget) clockWidget.classList.toggle('widget-hidden', !value);
          break;
        }
        case 'showClimate': {
          storage.save('setting_showClimate', value);
          const climateWidget = document.querySelector('.widget_climate');
          if (climateWidget) climateWidget.classList.toggle('widget-hidden', !value);
          break;
        }
        case 'showApps': {
          storage.save('setting_showApps', value);
          const appsWidget = document.querySelector('.widget_apps');
          if (appsWidget) appsWidget.classList.toggle('widget-hidden', !value);
          break;
        }
        case 'showPlayer': {
          storage.save('setting_showPlayer', value);
          const playerWidget = document.querySelector('.widget_player');
          if (playerWidget) playerWidget.classList.toggle('widget-hidden', !value);
          break;
        }
        case 'showWeather': {
          storage.save('setting_showWeather', value);
          const weatherWidget = document.getElementById('widgetWeather');
          if (weatherWidget) weatherWidget.classList.toggle('widget-hidden', !value);
          break;
        }
        case 'showMiniMap':
          storage.save('setting_showMiniMap', value);
          if (modules.navigation && typeof modules.navigation.refresh === 'function') {
            modules.navigation.refresh();
          }
          break;
        case 'miniMapTheme': {
          const storedTheme = miniMapThemeToStorage(value);
          storage.save('setting_miniMapTheme', storedTheme);
          if (modules.navigation && typeof modules.navigation.applyThemeNow === 'function') {
            modules.navigation.applyThemeNow();
          } else if (modules.navigation && typeof modules.navigation.refresh === 'function') {
            modules.navigation.refresh();
          }
          break;
        }
        case 'playerVolumeStep': storage.save('playerVolumeStep', value); break;
        case 'autoRequestMusicState': storage.save('autoRequestMusicState', value); break;
        case 'volumeSwipeEnabled':
          storage.save('volumeSwipeEnabled', value);
          if (modules.volumeSwipe && typeof modules.volumeSwipe.setEnabled === 'function') {
            modules.volumeSwipe.setEnabled(value);
          }
          break;
        case 'appsSlotsCount':
          storage.save('appsSlotsCount', value);
          updateAppsSlotsCount(parseInt(value, 10));
          break;
        case 'showAppLabels':
          storage.save('showAppLabels', value);
          updateAppLabels(value);
          if (modules.apps && typeof modules.apps.updateAppLabels === 'function') {
            modules.apps.updateAppLabels(value);
          }
          break;
        case 'offModeHideClimate':
        case 'offModeHideApps':
        case 'offModeHidePlayer':
        case 'offModeHideNetwork':
        case 'offModeHideMiniMap':
        case 'offModeHideRightButtons':
          storage.save(`setting_${key}`, value);
          if (modules.wallpaper && typeof modules.wallpaper.updateOffModeWidgetVisibility === 'function') {
            modules.wallpaper.updateOffModeWidgetVisibility();
          }
          break;
      }
    } finally {
      isApplyingSetting = false;
    }
  }

  // ---------- helpers (не зависят от сайдбара) ----------

  function applyOpacity(value) {
    document.documentElement.style.setProperty('--widget-opacity', value);
    storage.save('currentOpacity', value);
  }

  function applyOpacityToNewElement(element) {
    if (!element) return;
    element.style.setProperty('--widget-opacity', 'var(--widget-opacity, 1)');
  }

  function updateAppsSlotsCount(count) {
    const appsWidget = document.querySelector('.widget_apps');
    if (!appsWidget || !Number.isFinite(count) || count <= 0) return;
    const slots = document.querySelectorAll('.app_slot');
    const currentCount = slots.length;
    if (count < currentCount) {
      for (let i = currentCount; i > count; i--) {
        document.querySelector(`.app_slot[data-slot="${i}"]`)?.remove();
      }
    }
    if (count > currentCount) {
      for (let i = currentCount + 1; i <= count; i++) {
        const newSlot = document.createElement('div');
        newSlot.className = 'app_slot';
        newSlot.setAttribute('data-slot', i);
        newSlot.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
        appsWidget.appendChild(newSlot);
      }
    }
    const widgetSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-size')) || 13.5;
    const gap = 0.55;
    const padding = 1.16;
    appsWidget.setAttribute('data-count', count);
    if (count === 2) {
      appsWidget.style.display = 'flex';
      appsWidget.style.flexDirection = 'column';
      appsWidget.style.gap = gap + 'rem';
      appsWidget.style.padding = '0.58rem';
      appsWidget.style.width = `calc(${widgetSize}rem / 2)`;
      appsWidget.style.minWidth = `calc(${widgetSize}rem / 2)`;
      appsWidget.style.maxWidth = `calc(${widgetSize}rem / 2)`;
      appsWidget.style.height = `calc(${widgetSize}rem)`;
      const slotHeight = (widgetSize - padding - gap) / 2;
      document.querySelectorAll('.app_slot').forEach(slot => {
        slot.style.aspectRatio = '1 / 1';
        slot.style.width = '100%';
        slot.style.height = slotHeight + 'rem';
        slot.style.minHeight = '0';
      });
    } else if (count === 4) {
      appsWidget.style.display = 'grid';
      appsWidget.style.gridTemplateColumns = 'repeat(2, 1fr)';
      appsWidget.style.gridTemplateRows = 'repeat(2, 1fr)';
      appsWidget.style.gap = gap + 'rem';
      appsWidget.style.padding = '0.58rem';
      appsWidget.style.width = `calc(${widgetSize}rem)`;
      appsWidget.style.minWidth = `calc(${widgetSize}rem)`;
      appsWidget.style.maxWidth = 'none';
      appsWidget.style.height = `calc(${widgetSize}rem)`;
      document.querySelectorAll('.app_slot').forEach(slot => {
        slot.style.aspectRatio = '1 / 1';
        slot.style.width = '100%';
        slot.style.height = 'auto';
        slot.style.minHeight = '0';
      });
    } else if (count === 6) {
      appsWidget.style.display = 'grid';
      appsWidget.style.gridTemplateColumns = 'repeat(3, 1fr)';
      appsWidget.style.gridTemplateRows = 'repeat(2, 1fr)';
      appsWidget.style.gap = gap + 'rem';
      appsWidget.style.padding = '0.58rem';
      appsWidget.style.width = `calc(${widgetSize}rem * 1.5)`;
      appsWidget.style.minWidth = `calc(${widgetSize}rem * 1.5)`;
      appsWidget.style.maxWidth = 'none';
      appsWidget.style.height = `calc(${widgetSize}rem)`;
      document.querySelectorAll('.app_slot').forEach(slot => {
        slot.style.aspectRatio = '1 / 1';
        slot.style.width = '100%';
        slot.style.height = 'auto';
        slot.style.minHeight = '0';
      });
    }
    let slotSize = (widgetSize - padding - gap) / 2;
    if (slotSize < 2.5) slotSize = 2.5;
    if (slotSize > 8) slotSize = 8;
    document.querySelectorAll('.app_slot').forEach(slot => {
      const img = slot.querySelector('img');
      if (img) {
        img.style.width = (slotSize * 0.45) + 'rem';
        img.style.height = (slotSize * 0.45) + 'rem';
      }
    });
    if (modules.apps && typeof modules.apps.reinitSlots === 'function') modules.apps.reinitSlots();
  }

  function updateAppLabels(show) {
    document.querySelectorAll('.app-label').forEach(l => { l.style.display = show ? 'block' : 'none'; });
    document.querySelectorAll('.app_slot').forEach(slot => {
      slot.classList.toggle('has-label', !!(show && slot.querySelector('.app-label')));
    });
  }

  function updateClockTapHandler() {
    const clockWidget = document.querySelector('.widget_time');
    if (!clockWidget) return;
    if (clockWidget._nightModeHandler) {
      clockWidget.removeEventListener('click', clockWidget._nightModeHandler);
      clockWidget._nightModeHandler = null;
    }
    if (loadSetting('nightModeOnClockTap')) {
      const newHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (modules.wallpaper && modules.wallpaper.toggleOffMode) modules.wallpaper.toggleOffMode();
      };
      clockWidget._nightModeHandler = newHandler;
      clockWidget.addEventListener('click', newHandler);
    }
  }

  function updateClimateOffButton() {
    const offButton = document.getElementById('climateOffAll');
    if (offButton) offButton.style.display = loadSetting('climateOffButton') ? 'flex' : 'none';
  }

  function updateClimateSlotsCount(count) {
    const climateWidget = document.querySelector('.widget_climate_2x3');
    const climateGrid = document.querySelector('.climate-grid_2x3');
    if (!climateGrid || !climateWidget || !Number.isFinite(count) || count <= 0) return;
    const slots = document.querySelectorAll('.climate_slot');
    const currentCount = slots.length;
    const widgetHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-size')) || 13.5;
    const padding = 1.6;
    const gap = 0.55;
    const availableHeight = widgetHeight - padding - gap;
    let slotSize = availableHeight / 2;
    if (slotSize < 2.5) slotSize = 2.5;
    if (slotSize > 8) slotSize = 8;
    let newWidth = 0;
    if (count === 4) {
      newWidth = (slotSize * 2) + (gap * 1);
      climateGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (count === 6) {
      newWidth = (slotSize * 3) + (gap * 2);
      climateGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    } else if (count === 8) {
      newWidth = (slotSize * 4) + (gap * 3);
      climateGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    }
    newWidth = newWidth + padding;
    climateGrid.style.gridTemplateRows = 'repeat(2, 1fr)';
    climateWidget.style.width = newWidth + 'rem';
    if (count < currentCount) {
      for (let i = currentCount; i > count; i--) {
        document.querySelector(`.climate_slot[data-climate-slot="${i}"]`)?.remove();
      }
    }
    if (count > currentCount) {
      for (let i = currentCount + 1; i <= count; i++) {
        const newSlot = document.createElement('div');
        newSlot.className = 'climate_slot';
        newSlot.setAttribute('data-climate-slot', i);
        newSlot.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
        climateGrid.appendChild(newSlot);
      }
    }
    document.querySelectorAll('.climate_slot').forEach(slot => {
      slot.style.aspectRatio = '1 / 1';
      slot.style.width = '100%';
      slot.style.height = 'auto';
      slot.style.minHeight = '0';
      const img = slot.querySelector('img');
      if (img) {
        img.style.width = (slotSize * 0.35) + 'rem';
        img.style.height = (slotSize * 0.35) + 'rem';
      }
      const label = slot.querySelector('.climate-label');
      if (label) label.style.fontSize = Math.max(0.5, Math.min(0.85, slotSize * 0.1)) + 'rem';
      const dots = slot.querySelector('.climate-dots');
      if (dots) {
        const dotSize = slotSize * 0.05;
        dots.style.gap = (dotSize * 0.5) + 'rem';
        dots.querySelectorAll('.climate-dot').forEach(dot => {
          dot.style.width = dotSize + 'rem';
          dot.style.height = dotSize + 'rem';
        });
      }
    });
    const currentColor = loadSetting('climateIconColor');
    if (currentColor) updateClimateIconColor(currentColor);
    const offButton = document.getElementById('climateOffAll');
    if (offButton && loadSetting('climateOffButton')) {
      if (count === 4) { offButton.style.left = '50%'; offButton.style.transform = 'translate(-50%, -50%)'; }
      else if (count === 6) { offButton.style.left = '33.33%'; offButton.style.transform = 'translate(-50%, -50%)'; }
      else if (count === 8) { offButton.style.left = '25%'; offButton.style.transform = 'translate(-50%, -50%)'; }
      const newSize = slotSize * 0.35;
      offButton.style.width = newSize + 'rem';
      offButton.style.height = newSize + 'rem';
      const svg = offButton.querySelector('svg');
      if (svg) {
        svg.style.width = (newSize * 0.45) + 'rem';
        svg.style.height = (newSize * 0.45) + 'rem';
      }
    }
    if (modules.climate && typeof modules.climate.reinitSlots === 'function') modules.climate.reinitSlots();
    storage.save('climateSlotsCount', count);
  }

  function updateClimateIconColor(color) {
    const isWhite = color === 'Белый';
    document.querySelectorAll('.climate_slot img').forEach(img => {
      if (isWhite) {
        img.style.filter = 'brightness(0) invert(1)';
        img.style.opacity = '0.92';
      } else {
        img.style.filter = 'brightness(0)';
        img.style.opacity = '0.85';
      }
    });
  }

  // ---------- QR ----------

  function addQrModalStyles() {
    if (document.getElementById('qr-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'qr-modal-styles';
    style.textContent = `
      .qr-expanded-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
        z-index: 30000; display: flex; align-items: center; justify-content: center;
        opacity: 0; visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        cursor: pointer;
      }
      .qr-expanded-overlay.active { opacity: 1; visibility: visible; }
      .qr-expanded-content {
        max-width: 85vw; max-height: 85vh;
        background: rgba(30,33,42,0.95); border-radius: 2rem; padding: 1.5rem;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        transform: scale(0.9);
        transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
      }
      .qr-expanded-overlay.active .qr-expanded-content { transform: scale(1); }
      .qr-expanded-img {
        width: 100%; height: auto; max-width: 400px; max-height: 70vh;
        border-radius: 1rem; background: white; padding: 1rem; box-sizing: border-box;
      }
      .qr-expanded-text {
        text-align: center; margin-top: 1rem; font-size: 0.85rem;
        color: rgba(255,255,255,0.7);
      }
      body.light .qr-expanded-content {
        background: rgba(245,248,255,0.95); border-color: rgba(0,0,0,0.1);
      }
      body.light .qr-expanded-text { color: rgba(50,60,80,0.8); }
    `;
    document.head.appendChild(style);
  }

  function showExpandedQr(qrImgSrc) {
    addQrModalStyles();
    document.querySelector('.qr-expanded-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'qr-expanded-overlay';
    const content = document.createElement('div');
    content.className = 'qr-expanded-content';
    content.onclick = (e) => e.stopPropagation();
    const img = document.createElement('img');
    img.src = qrImgSrc;
    img.className = 'qr-expanded-img';
    img.alt = 'QR-код для поддержки';
    const text = document.createElement('div');
    text.className = 'qr-expanded-text';
    text.innerHTML = '✨ Отсканируйте QR-код, чтобы поддержать автора ✨';
    content.appendChild(img);
    content.appendChild(text);
    overlay.appendChild(content);
    overlay.addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    });
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);
  }

  function createQrCode() {
    const container = document.createElement('div');
    container.className = 'settings-qr-container';
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; gap: 0.5rem; cursor: pointer;';
    const qrImg = document.createElement('img');
    qrImg.src = 'images/Qrkod.png';
    qrImg.alt = 'QR-код для поддержки автора';
    qrImg.style.cssText = 'width: 120px; height: 120px; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: white; padding: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer;';
    qrImg.addEventListener('mouseenter', () => {
      qrImg.style.transform = 'scale(1.02)';
      qrImg.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
    });
    qrImg.addEventListener('mouseleave', () => {
      qrImg.style.transform = 'scale(1)';
      qrImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
    qrImg.addEventListener('click', (e) => {
      e.stopPropagation();
      showExpandedQr(qrImg.src);
    });
    const qrText = document.createElement('div');
    qrText.className = 'settings-qr-text';
    qrText.innerHTML = '✨ Если Вам нравится моя работа,<br>подтвердите это переходом по QR ✨';
    qrText.style.cssText = 'font-size: 0.7rem; text-align: center; color: rgba(238,242,247,0.75); line-height: 1.4; max-width: 260px; cursor: pointer;';
    qrText.addEventListener('click', (e) => {
      e.stopPropagation();
      showExpandedQr(qrImg.src);
    });
    if (document.body.classList.contains('light')) {
      qrImg.style.borderColor = 'rgba(0,0,0,0.1)';
      qrText.style.color = 'rgba(50,60,80,0.75)';
    }
    container.appendChild(qrImg);
    container.appendChild(qrText);
    return container;
  }

  // ---------- form controls ----------

  function createRangeInput(setting, currentValue) {
    const container = document.createElement('div');
    container.className = 'settings-range-container';
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'settings-range-value';
    valueDisplay.textContent = currentValue + (setting.unit ? ` ${setting.unit}` : '');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = setting.min;
    input.max = setting.max;
    input.step = setting.step || 1;
    input.value = currentValue;
    input.className = 'settings-range';
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      valueDisplay.textContent = val + (setting.unit ? ` ${setting.unit}` : '');
      saveSetting(setting.id, val);
    });
    container.appendChild(input);
    container.appendChild(valueDisplay);
    return container;
  }

  function createSelect(setting, currentValue) {
    const select = document.createElement('select');
    select.className = 'settings-select';
    setting.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === currentValue) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
      e.stopPropagation();
      saveSetting(setting.id, e.target.value);
    });
    return select;
  }

  function createToggle(setting, currentValue) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `settings-toggle ${currentValue ? 'active' : ''}`;
    toggle.innerHTML = currentValue ? 'Вкл' : 'Выкл';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isActive = toggle.classList.contains('active');
      const newValue = !isActive;
      toggle.classList.toggle('active', newValue);
      toggle.innerHTML = newValue ? 'Вкл' : 'Выкл';
      toggle.blur();
      saveSetting(setting.id, newValue);
    });
    return toggle;
  }

  function createTextInput(setting, currentValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue || setting.default || '';
    input.placeholder = setting.placeholder || '';
    input.className = 'settings-text-input';
    let pendingTimer = null;
    let lastSavedValue = input.value;
    const commit = () => {
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      const v = input.value;
      if (v === lastSavedValue) return;
      lastSavedValue = v;
      saveSetting(setting.id, v);
    };
    const scheduleCommit = () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(commit, 500);
    };
    input.addEventListener('input', scheduleCommit);
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    return input;
  }

  function createInfo(setting) {
    const info = document.createElement('div');
    info.className = 'settings-info';
    info.textContent = setting.value;
    return info;
  }

  // ---------- full reset ----------

  async function clearAllAppIcons() {
    try {
      const slots = document.querySelectorAll('.app_slot');
      for (const slot of slots) {
        const key = `app_slot_${slot.dataset.slot}`;
        storage.remove(key);
      }
    } catch (e) { console.warn(e); }
  }

  async function performFullReset() {
    console.log('[Settings] Полный сброс...');
    document.querySelectorAll('.climate_slot').forEach(slot => {
      const slotId = slot.dataset.climateSlot;
      if (slotId) storage.remove(`climate_slot_${slotId}`);
    });
    await clearAllAppIcons();
    for (const category of Object.values(settingsConfig)) {
      for (const setting of category.settings) {
        if (setting.type !== 'qr' && setting.type !== 'info' && setting.type !== 'button') {
          storage.remove(`setting_${setting.id}`);
        }
      }
    }
    const runtimeKeys = [
      'networkPos', 'wallpaperMode', 'wallpaperImage', 'wallpaperCustom',
      'wallpaperVideo', 'wallpaper_cache_index',
      'customWallpaperIndex', 'autoWallpaperIntervalMs', 'autoWallpaperInterval',
      'builtinWallpaperIntervalMs', 'builtinWallpaperInterval',
      'brandText', 'currentOpacity', 'widgetsHiddenByUser',
      'volumeSwipeHintShown', 'tapToChangeWallpaper', 'climateOffButton',
      'climateSlotsCount', 'climateIconColor', 'showNetworkStatus',
      'showDate', 'showWeekday', 'nightModeOnClockTap', 'appsSlotsCount',
      'showAppLabels', 'showFooterText', 'footerText',
      'offModeHideClimate', 'offModeHideApps', 'offModeHidePlayer',
      'offModeHideRightButtons', 'offModeHideMiniMap', 'offModeHideNetwork',
      'setting_wallpaperCustomServer', 'setting_wallpaperCustomServer2',
      'setting_wallpaperCustomServerEnabled', 'setting_wallpaperCustomServer2Enabled',
      'wallpaper_hidden_builtins', 'wallpaper_custom_list',
      'climateTrunkOpen', 'setting_user_custom_url', 'setting_user_custom_enabled'
    ];
    runtimeKeys.forEach(k => storage.remove(k));
    try { await idbStore.clear(); } catch (e) { console.warn(e); }
  }

  // ---------- modal ----------

  function buildModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'settingsModal';
    modalOverlay.className = 'settings-modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'settings-modal-content';
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = `
      <h2>⚙️ Настройки панели</h2>
      <button class="settings-close-btn" id="settingsCloseBtn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    modalContent.appendChild(header);
    const body = document.createElement('div');
    body.className = 'settings-body';
    const currentAppVersion = (window.MANIFEST && window.MANIFEST.version) ? String(window.MANIFEST.version) : '—';

    for (const [, category] of Object.entries(settingsConfig)) {
      const section = document.createElement('div');
      section.className = 'settings-section';
      const sectionTitle = document.createElement('h3');
      sectionTitle.className = 'settings-section-title';
      sectionTitle.textContent = category.title;
      section.appendChild(sectionTitle);

      for (const setting of category.settings) {
        if (setting.type === 'qr') {
          section.appendChild(createQrCode());
          continue;
        }
        const row = document.createElement('div');
        row.className = 'settings-row';
        const label = document.createElement('label');
        label.className = 'settings-label';
        label.textContent = setting.label;
        label.style.flexShrink = '0';
        row.appendChild(label);
        let currentValue = loadSetting(setting.id);
        if (setting.id === 'fuelDisplayMode') currentValue = fuelDisplayModeToUi(currentValue);
        if (setting.id === 'version') currentValue = currentAppVersion;
        if (setting.id === 'miniMapTheme') currentValue = miniMapThemeFromStorage(loadSetting('miniMapTheme'));

        switch (setting.type) {
          case 'range': row.appendChild(createRangeInput(setting, currentValue)); break;
          case 'select': row.appendChild(createSelect(setting, currentValue)); break;
          case 'toggle': row.appendChild(createToggle(setting, currentValue)); break;
          case 'text': row.appendChild(createTextInput(setting, currentValue)); break;
          case 'info': row.appendChild(createInfo({ ...setting, value: currentValue || '—' })); break;
        }
        section.appendChild(row);
      }
      body.appendChild(section);
    }

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.type = 'button';
    resetBtn.innerHTML = '🔄 Сбросить все настройки';
    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (confirm('Сбросить все настройки панели? Это перезагрузит страницу.')) {
        await performFullReset();
        window.location.reload();
      }
    });
    body.appendChild(resetBtn);
    modalContent.appendChild(body);
    modalOverlay.appendChild(modalContent);
    modalOverlay.querySelector('#settingsCloseBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) close();
    });
    return modalOverlay;
  }

  function open() {
    if (isOpen) return;
    if (modal) modal.remove();
    modal = buildModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('open'), 10);
    isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (modal) {
      modal.classList.remove('open');
      const localModal = modal;
      setTimeout(() => {
        if (localModal && localModal.parentNode) localModal.remove();
        modal = null;
      }, 300);
    }
    isOpen = false;
    document.body.style.overflow = '';
  }

  let resizeTimeout = null;
  function handleResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      try {
        const appsCount = loadSetting('appsSlotsCount');
        if (appsCount) updateAppsSlotsCount(parseInt(appsCount, 10));
        const climateCount = loadSetting('climateSlotsCount');
        if (climateCount) updateClimateSlotsCount(parseInt(climateCount, 10));
      } catch (e) { console.warn(e); }
    }, 200);
  }

  function init() {
    console.log('[Settings] init()');
    applySetting('widgetSize', loadSetting('widgetSize') || 13.5);
    applySetting('widgetOpacity', loadSetting('widgetOpacity') || 1);
    applySetting('widgetBlur', loadSetting('widgetBlur') || 10);
    applySetting('showClockWeather', loadSetting('showClockWeather') !== false);
    applySetting('showDate', loadSetting('showDate') !== false);
    applySetting('showWeekday', loadSetting('showWeekday') !== false);
    applySetting('nightModeOnClockTap', loadSetting('nightModeOnClockTap') !== false);
    applySetting('climateOffButton', loadSetting('climateOffButton') !== false);
    applySetting('climateSlotsCount', loadSetting('climateSlotsCount') || '6');
    applySetting('climateIconColor', loadSetting('climateIconColor') || 'Белый');
    applySetting('fuelTankSize', loadSetting('fuelTankSize') || '60');
    applySetting('fuelDisplayMode', loadSetting('fuelDisplayMode') || 'Проценты');
    applySetting('showWeather', loadSetting('showWeather') === true);
    applySetting('showMiniMap', loadSetting('showMiniMap') === true);

    const storedMiniMapTheme = loadSetting('miniMapTheme');
    const uiMiniMapTheme = miniMapThemeFromStorage(storedMiniMapTheme);
    applySetting('miniMapTheme', uiMiniMapTheme);

    applySetting('showClock', loadSetting('showClock') !== false);
    applySetting('showClimate', loadSetting('showClimate') !== false);
    applySetting('showApps', loadSetting('showApps') !== false);
    applySetting('showPlayer', loadSetting('showPlayer') !== false);
    applySetting('playerVolumeStep', loadSetting('playerVolumeStep') || 5);
    applySetting('autoRequestMusicState', loadSetting('autoRequestMusicState') !== false);
    applySetting('volumeSwipeEnabled', loadSetting('volumeSwipeEnabled') !== false);
    applySetting('appsSlotsCount', loadSetting('appsSlotsCount') || '4');
    applySetting('showAppLabels', loadSetting('showAppLabels') || false);
    applySetting('offModeHideClimate', loadSetting('offModeHideClimate') !== false);
    applySetting('offModeHideApps', loadSetting('offModeHideApps') !== false);
    applySetting('offModeHidePlayer', loadSetting('offModeHidePlayer') !== false);
    applySetting('offModeHideNetwork', loadSetting('offModeHideNetwork') !== false);
    applySetting('offModeHideMiniMap', loadSetting('offModeHideMiniMap') !== false);
    applySetting('offModeHideRightButtons', loadSetting('offModeHideRightButtons') !== false);

    const settingsBtn = document.getElementById('btnSettings');
    if (settingsBtn) {
      if (settingsBtn._clickHandler) {
        settingsBtn.removeEventListener('click', settingsBtn._clickHandler);
      }
      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        open();
      };
      settingsBtn._clickHandler = clickHandler;
      settingsBtn.addEventListener('click', clickHandler);
      if (typeof attachOemTouchFeedback === 'function') attachOemTouchFeedback(settingsBtn);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  // Экспортируем также loadSetting/saveSetting — сайдбару они понадобятся
  return {
    init,
    open,
    close,
    applyOpacityToNewElement,
    loadSetting,
    saveSetting,
    applySetting
  };
})();