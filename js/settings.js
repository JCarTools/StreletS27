/**********************************************
 * Модуль: Настройки приборной панели
 * Добавлен QR-код с увеличением при нажатии
 **********************************************/

modules.settings = (function() {
  let modal = null;
  let isOpen = false;
  let isApplyingSetting = false;
  
  console.log('[Settings] Модуль загружен');
  
  function getStaticWallpapersList() {
    const items = document.querySelectorAll('.wallpaper-item');
    const list = [];
    if (items.length) {
      items.forEach((item, idx) => {
        list.push({
          index: idx,
          name: item.querySelector('img')?.alt || `Обои ${idx + 1}`,
          src: item.dataset.src
        });
      });
    }
    return list;
  }
  
  const settingsConfig = {
    climate: {
      title: 'Климат',
      settings: [
        { id: 'climateOffButton', type: 'toggle', label: 'Кнопка выключения всех устройств', default: true },
        { id: 'climateSlotsCount', type: 'select', label: 'Количество кнопок устройств', options: ['4', '6', '8'], default: '6' },
        { id: 'climateIconColor', type: 'select', label: 'Цвет иконок в кнопках', options: ['Белый', 'Черный'], default: 'Белый' }
      ]
    },
    clock: {
      title: 'Часы',
      settings: [
        { id: 'showDate', type: 'toggle', label: 'Показывать дату', default: true },
        { id: 'showWeekday', type: 'toggle', label: 'Показывать день недели', default: true },
        { id: 'nightModeOnClockTap', type: 'toggle', label: 'Ночной режим по нажатию на часы', default: true }
      ]
    },
    player: {
      title: 'Плеер',
      settings: [
        { id: 'playerVolumeStep', type: 'range', label: 'Шаг изменения громкости', min: 1, max: 20, step: 1, default: 5, unit: '%' },
        { id: 'autoRequestMusicState', type: 'toggle', label: 'Автоматический запрос статуса', default: true }
      ]
    },
    apps: {
      title: 'Приложения',
      settings: [
        { id: 'appsSlotsCount', type: 'select', label: 'Количество слотов приложений', options: ['2', '4', '6'], default: '4' },
        { id: 'showAppLabels', type: 'toggle', label: 'Показывать названия приложений', default: false }
      ]
    },
    widgets: {
      title: 'Виджеты',
      settings: [
        { id: 'widgetSize', type: 'range', label: 'Размер виджетов', min: 9, max: 20, step: 0.5, default: 13.5, unit: 'rem' },
        { id: 'widgetOpacity', type: 'range', label: 'Прозрачность виджетов и кнопок', min: 0.3, max: 1, step: 0.01, default: 1, unit: '' },
        { id: 'widgetBlur', type: 'range', label: 'Размытие фона', min: 0, max: 20, step: 1, default: 10, unit: 'px' }
      ]
    },
    wallpaper: {
      title: 'Обои',
      settings: [
        { id: 'autoWallpaperInterval', type: 'select', label: 'Время смены автообоев', options: ['30 секунд', '1 минута', '2 минуты', '5 минут', '10 минут', '30 минут', '1 час'], default: '5 минут' },
        { id: 'wallpaperServers', type: 'multiselect', label: 'Серверы для автообоев', options: [
          { value: 'picsum', label: 'Picsum (Рекомендуется)' },
          { value: 'picsum_proxy', label: 'Picsum Proxy (Россия)' },
          { value: 'loremflickr', label: 'LoremFlickr' },
          { value: 'placekitten', label: 'PlaceKitten' },
          { value: 'loremflickrcn', label: 'LoremFlickr CN (Россия)' }
        ], default: ['picsum_proxy', 'picsum'] }
      ]
    },
    network: {
      title: 'Сеть',
      settings: [
        { id: 'showNetworkStatus', type: 'toggle', label: 'Отображать состояние сети', default: true }
      ]
    },
    behavior: {
      title: 'Поведение',
      settings: [
        { id: 'tapToChangeWallpaper', type: 'toggle', label: 'Тап по фону → смена обоев', default: true },
        { id: 'doubleTapToHideWidgets', type: 'toggle', label: 'Тап двумя пальцами → скрыть виджеты', default: false }
      ]
    },
    footer: {
      title: 'Нижняя подпись',
      settings: [
        { id: 'showFooterText', type: 'toggle', label: 'Показывать подпись', default: true },
        { id: 'footerText', type: 'text', label: 'Текст подписи', default: 'ТенеТ Т8 Вместе к новым свершениям ТенеТ Т8', placeholder: 'Введите текст подписи' }
      ]
    },
    offMode: {
      title: 'Черная заставка OFF-mode',
      settings: [
        { id: 'offModeHideClimate', type: 'toggle', label: 'Скрывать климат в OFF-mode', default: true },
        { id: 'offModeHideApps', type: 'toggle', label: 'Скрывать приложения в OFF-mode', default: true },
        { id: 'offModeHidePlayer', type: 'toggle', label: 'Скрывать плеер в OFF-mode', default: true },
        { id: 'offModeHideRightButtons', type: 'toggle', label: 'Скрывать правые кнопки в OFF-mode', default: true }
      ]
    },
    about: {
      title: 'О панели',
      settings: [
        { id: 'version', type: 'info', label: 'Версия', value: '2.0' },
        { id: 'author', type: 'info', label: 'Автор', value: '@Strelets27' },
        { id: 'qrCode', type: 'qr' }
      ]
    }
  };
  
  function loadSetting(key) {
    const saved = storage.load(`setting_${key}`);
    if (saved !== null && saved !== undefined) return saved;
    for (const category of Object.values(settingsConfig)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.default !== undefined) {
          return setting.default;
        }
      }
    }
    return null;
  }
  
  function saveSetting(key, value) {
    storage.save(`setting_${key}`, value);
    applySetting(key, value);
  }
  
  function applySetting(key, value) {
    if (isApplyingSetting) return;
    isApplyingSetting = true;
    try {
      switch(key) {
        case 'widgetSize':
          document.documentElement.style.setProperty('--widget-size', value + 'rem');
          setTimeout(() => {
            const appsCount = loadSetting('appsSlotsCount');
            if (appsCount) updateAppsSlotsCount(parseInt(appsCount));
            const climateCount = loadSetting('climateSlotsCount');
            if (climateCount) updateClimateSlotsCount(parseInt(climateCount));
            const rightButtons = document.querySelector('.right-buttons');
            if (rightButtons) rightButtons.style.height = value + 'rem';
            const timeWidget = document.querySelector('.widget_time');
            if (timeWidget) {
              timeWidget.style.width = value + 'rem';
              const newFontSize = value * 0.2;
              document.querySelectorAll('.flip-digit').forEach(d => d.style.fontSize = newFontSize + 'rem');
              document.querySelectorAll('.flip-separator').forEach(s => s.style.fontSize = newFontSize + 'rem');
            }
          }, 10);
          break;
        case 'widgetOpacity':
          applyOpacity(value);
          break;
        case 'widgetBlur':
          document.querySelectorAll('.widget, .picker-drawer, .sidebar, .modal-content').forEach(el => {
            el.style.backdropFilter = `blur(${value}px)`;
          });
          break;
        case 'showDate':
          const dateDisplay = document.getElementById('dateDisplay');
          if (dateDisplay) dateDisplay.style.display = value ? 'block' : 'none';
          break;
        case 'showWeekday':
          const weekdayDisplay = document.getElementById('weekdayDisplay');
          if (weekdayDisplay) weekdayDisplay.style.display = value ? 'block' : 'none';
          break;
        case 'tapToChangeWallpaper':
          storage.save('tapToChangeWallpaper', value);
          break;
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
          updateClimateSlotsCount(parseInt(value));
          break;
        case 'climateIconColor':
          storage.save('climateIconColor', value);
          updateClimateIconColor(value);
          if (modules.climate && typeof modules.climate.updateIconColors === 'function') modules.climate.updateIconColors();
          break;
        case 'showNetworkStatus':
          storage.save('showNetworkStatus', value);
          updateNetworkStatusVisibility(value);
          break;
        case 'autoWallpaperInterval':
          storage.save('autoWallpaperInterval', value);
          updateAutoWallpaperInterval(value);
          break;
        case 'wallpaperServers':
          storage.save('wallpaperServers', value);
          updateWallpaperServers(value);
          break;
        case 'playerVolumeStep':
          storage.save('playerVolumeStep', value);
          break;
        case 'autoRequestMusicState':
          storage.save('autoRequestMusicState', value);
          break;
        case 'appsSlotsCount':
          storage.save('appsSlotsCount', value);
          updateAppsSlotsCount(parseInt(value));
          break;
        case 'showAppLabels':
          storage.save('showAppLabels', value);
          updateAppLabels(value);
          if (modules.apps && typeof modules.apps.updateAppLabels === 'function') modules.apps.updateAppLabels(value);
          break;
        case 'showFooterText':
          storage.save('showFooterText', value);
          updateFooterVisibility(value);
          break;
        case 'footerText':
          storage.save('footerText', value);
          updateFooterText(value);
          const footer = document.getElementById('editableBrand');
          if (footer) footer.textContent = value;
          break;
        case 'offModeHideClimate':
        case 'offModeHideApps':
        case 'offModeHidePlayer':
        case 'offModeHideRightButtons':
          if (modules.wallpaper && typeof modules.wallpaper.updateOffModeWidgetVisibility === 'function') {
            modules.wallpaper.updateOffModeWidgetVisibility();
          }
          break;
      }
    } finally {
      isApplyingSetting = false;
    }
  }
  
  function applyOpacity(value) {
    document.documentElement.style.setProperty('--widget-opacity', value);
    storage.save('currentOpacity', value);
  }
  
  function applyOpacityToNewElement(element) {
    const currentOpacity = loadSetting('widgetOpacity');
    if (currentOpacity !== undefined && element) {
      element.style.opacity = `var(--widget-opacity, ${currentOpacity})`;
    }
  }
  
  function updateWallpaperServers(selectedServers) {
    if (modules.wallpaper && typeof modules.wallpaper.updateServers === 'function') {
      modules.wallpaper.updateServers(selectedServers);
    }
    if (storage.load('wallpaperMode') === 'auto' && modules.wallpaper && typeof modules.wallpaper.setAuto === 'function') {
      modules.wallpaper.setAuto(true);
    }
  }
  
  function updateAppsSlotsCount(count) {
    const appsWidget = document.querySelector('.widget_apps');
    if (!appsWidget) return;
    const slots = document.querySelectorAll('.app_slot');
    const currentCount = slots.length;
    if (count < currentCount) {
      for (let i = currentCount; i > count; i--) {
        const slotToRemove = document.querySelector(`.app_slot[data-slot="${i}"]`);
        if (slotToRemove) slotToRemove.remove();
      }
    }
    if (count > currentCount) {
      for (let i = currentCount + 1; i <= count; i++) {
        const newSlot = document.createElement('div');
        newSlot.className = 'app_slot';
        newSlot.setAttribute('data-slot', i);
        newSlot.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
        appsWidget.appendChild(newSlot);
        applyOpacityToNewElement(newSlot);
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
    let slotSize = (count === 2) ? (widgetSize - padding - gap) / 2 : (widgetSize - padding - gap) / 2;
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
    console.log('[Settings] Количество слотов приложений установлено:', count);
  }
  
  function updateAppLabels(show) {
    const labels = document.querySelectorAll('.app-label');
    if (show) {
      labels.forEach(label => label.style.display = 'block');
      document.querySelectorAll('.app_slot').forEach(slot => {
        if (slot.querySelector('.app-label')) slot.classList.add('has-label');
      });
    } else {
      labels.forEach(label => label.style.display = 'none');
      document.querySelectorAll('.app_slot').forEach(slot => slot.classList.remove('has-label'));
    }
  }
  
  function updateClockTapHandler() {
    const clockWidget = document.querySelector('.widget_time');
    if (!clockWidget) return;
    const oldHandler = clockWidget._nightModeHandler;
    if (oldHandler) clockWidget.removeEventListener('click', oldHandler);
    const nightModeEnabled = loadSetting('nightModeOnClockTap');
    if (nightModeEnabled) {
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
  
  function updateNetworkStatusVisibility(isVisible) {
    const networkBtn = document.getElementById('btnNetwork');
    if (networkBtn) networkBtn.style.display = isVisible ? 'flex' : 'none';
  }
  
  function updateFooterVisibility(isVisible) {
    const footer = document.getElementById('editableBrand');
    if (footer) footer.style.display = isVisible ? 'block' : 'none';
  }
  
  function updateFooterText(text) {
    const footer = document.getElementById('editableBrand');
    if (footer && text) footer.textContent = text;
  }
  
  function updateAutoWallpaperInterval(intervalText) {
    let intervalMs = 300000;
    switch(intervalText) {
      case '30 секунд': intervalMs = 30000; break;
      case '1 минута': intervalMs = 60000; break;
      case '2 минуты': intervalMs = 120000; break;
      case '5 минут': intervalMs = 300000; break;
      case '10 минут': intervalMs = 600000; break;
      case '30 минут': intervalMs = 1800000; break;
      case '1 час': intervalMs = 3600000; break;
    }
    storage.save('autoWallpaperIntervalMs', intervalMs);
    if (modules.wallpaper && typeof modules.wallpaper.restartAutoMode === 'function') {
      modules.wallpaper.restartAutoMode();
    } else if (storage.load('wallpaperMode') === 'auto' && modules.wallpaper && typeof modules.wallpaper.setAuto === 'function') {
      modules.wallpaper.setAuto(true);
    }
    console.log('[Settings] Интервал автообоев установлен:', intervalText, '(' + intervalMs + 'ms)');
  }
  
  function updateClimateSlotsCount(count) {
    const climateWidget = document.querySelector('.widget_climate_2x3');
    const climateGrid = document.querySelector('.climate-grid_2x3');
    if (!climateGrid || !climateWidget) return;
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
        const slotToRemove = document.querySelector(`.climate_slot[data-climate-slot="${i}"]`);
        if (slotToRemove) slotToRemove.remove();
      }
    }
    if (count > currentCount) {
      for (let i = currentCount + 1; i <= count; i++) {
        const newSlot = document.createElement('div');
        newSlot.className = 'climate_slot';
        newSlot.setAttribute('data-climate-slot', i);
        newSlot.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
        climateGrid.appendChild(newSlot);
        applyOpacityToNewElement(newSlot);
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
      if (count === 4) {
        offButton.style.left = '50%';
        offButton.style.transform = 'translate(-50%, -50%)';
      } else if (count === 6) {
        offButton.style.left = '33.33%';
        offButton.style.transform = 'translate(-50%, -50%)';
      } else if (count === 8) {
        offButton.style.left = '25%';
        offButton.style.transform = 'translate(-50%, -50%)';
      }
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
        img.style.filter = 'brightness(0) invert(0)';
        img.style.opacity = '0.85';
      }
    });
  }
  
  // Стили для увеличенного QR-кода (добавляем в head, если ещё нет)
  function addQrModalStyles() {
    if (document.getElementById('qr-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'qr-modal-styles';
    style.textContent = `
      .qr-expanded-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(10px);
        z-index: 30000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        cursor: pointer;
      }
      .qr-expanded-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      .qr-expanded-content {
        max-width: 85vw;
        max-height: 85vh;
        background: rgba(30,33,42,0.95);
        border-radius: 2rem;
        padding: 1.5rem;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        transform: scale(0.9);
        transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
      }
      .qr-expanded-overlay.active .qr-expanded-content {
        transform: scale(1);
      }
      .qr-expanded-img {
        width: 100%;
        height: auto;
        max-width: 400px;
        max-height: 70vh;
        border-radius: 1rem;
        background: white;
        padding: 1rem;
        box-sizing: border-box;
      }
      .qr-expanded-text {
        text-align: center;
        margin-top: 1rem;
        font-size: 0.85rem;
        color: rgba(255,255,255,0.7);
      }
      body.light .qr-expanded-content {
        background: rgba(245,248,255,0.95);
        border-color: rgba(0,0,0,0.1);
      }
      body.light .qr-expanded-text {
        color: rgba(50,60,80,0.8);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Функция показа увеличенного QR-кода
  function showExpandedQr(qrImgSrc) {
    addQrModalStyles();
    
    // Удаляем существующий оверлей, если есть
    const existingOverlay = document.querySelector('.qr-expanded-overlay');
    if (existingOverlay) existingOverlay.remove();
    
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
    
    // Закрытие по клику на фон
    overlay.addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    });
    
    // Закрытие по ESC
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);
    
    document.body.appendChild(overlay);
    // Активация анимации
    setTimeout(() => overlay.classList.add('active'), 10);
  }
  
  // НОВАЯ ФУНКЦИЯ: создание QR-кода с возможностью увеличения
  function createQrCode(setting) {
    const container = document.createElement('div');
    container.className = 'settings-qr-container';
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; gap: 0.5rem; cursor: pointer;';
    
    const qrImg = document.createElement('img');
    qrImg.src = 'images/Qrkod.png';
    qrImg.alt = 'QR-код для поддержки автора';
    qrImg.style.cssText = 'width: 120px; height: 120px; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: white; padding: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer;';
    
    // Эффект при наведении/нажатии
    qrImg.addEventListener('mouseenter', () => {
      qrImg.style.transform = 'scale(1.02)';
      qrImg.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
    });
    qrImg.addEventListener('mouseleave', () => {
      qrImg.style.transform = 'scale(1)';
      qrImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
    
    // При клике - увеличиваем
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
    
    // Адаптация для светлой темы
    if (document.body.classList.contains('light')) {
      qrImg.style.borderColor = 'rgba(0,0,0,0.1)';
      qrText.style.color = 'rgba(50,60,80,0.75)';
    }
    
    container.appendChild(qrImg);
    container.appendChild(qrText);
    return container;
  }
  
  // Функции создания элементов управления
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
  
  function createMultiSelect(setting, currentValue) {
    const container = document.createElement('div');
    container.className = 'settings-multiselect-container';
    container.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; flex: 1;';
    const selectedArray = Array.isArray(currentValue) ? currentValue : setting.default;
    setting.options.forEach(opt => {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.75rem; color: rgba(238,242,247,0.85);';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = opt.value;
      checkbox.checked = selectedArray.includes(opt.value);
      checkbox.style.cssText = 'width: 1rem; height: 1rem; cursor: pointer;';
      const span = document.createElement('span');
      span.textContent = opt.label;
      label.appendChild(checkbox);
      label.appendChild(span);
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        let newSelection = selectedArray;
        if (checkbox.checked) {
          if (!newSelection.includes(opt.value)) newSelection = [...newSelection, opt.value];
        } else {
          newSelection = newSelection.filter(v => v !== opt.value);
        }
        saveSetting(setting.id, newSelection);
      });
      container.appendChild(label);
    });
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.5rem;';
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Выбрать все';
    selectAllBtn.className = 'settings-multiselect-btn';
    selectAllBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.65rem; background: rgba(255,255,255,0.1); border: none; border-radius: 0.5rem; cursor: pointer; color: inherit;';
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Снять все';
    deselectAllBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.65rem; background: rgba(255,255,255,0.1); border: none; border-radius: 0.5rem; cursor: pointer; color: inherit;';
    selectAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const allValues = setting.options.map(opt => opt.value);
      saveSetting(setting.id, allValues);
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    deselectAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveSetting(setting.id, []);
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(deselectAllBtn);
    container.appendChild(buttonContainer);
    return container;
  }
  
  function createToggle(setting, currentValue) {
    const toggle = document.createElement('button');
    toggle.className = `settings-toggle ${currentValue ? 'active' : ''}`;
    toggle.innerHTML = currentValue ? 'Вкл' : 'Выкл';
    const newToggle = toggle.cloneNode(true);
    newToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isActive = newToggle.classList.contains('active');
      const newValue = !isActive;
      if (newValue) {
        newToggle.classList.add('active');
        newToggle.innerHTML = 'Вкл';
      } else {
        newToggle.classList.remove('active');
        newToggle.innerHTML = 'Выкл';
      }
      newToggle.blur();
      saveSetting(setting.id, newValue);
    });
    return newToggle;
  }
  
  function createTextInput(setting, currentValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue || setting.default || '';
    input.placeholder = setting.placeholder || '';
    input.style.cssText = `
      flex: 1;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      background: linear-gradient(180deg, rgba(43, 49, 62, 0.68), rgba(21, 25, 33, 0.52));
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.75rem;
      color: rgba(238,242,247,0.85);
      outline: none;
      min-width: 0;
    `;
    if (document.body.classList.contains('light')) {
      input.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(231,236,245,0.52))';
      input.style.borderColor = 'rgba(88,102,134,0.12)';
      input.style.color = 'rgba(45,56,78,0.85)';
    }
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      saveSetting(setting.id, e.target.value);
    });
    input.addEventListener('blur', (e) => {
      saveSetting(setting.id, e.target.value);
    });
    return input;
  }
  
  function createInfo(setting) {
    const info = document.createElement('div');
    info.className = 'settings-info';
    info.textContent = setting.value;
    return info;
  }
  
  function clearAllClimateDevices() {
    console.log('[Settings] Очистка всех устройств климата');
    
    const slots = document.querySelectorAll('.climate_slot');
    slots.forEach(slot => {
      const slotId = slot.dataset.climateSlot;
      if (slotId) {
        storage.remove(`climate_slot_${slotId}`);
      }
    });
    
    if (modules.climate && typeof modules.climate.clearAllClimateDevices === 'function') {
      modules.climate.clearAllClimateDevices();
    } else {
      slots.forEach(slot => {
        slot.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
        slot.classList.remove('active');
      });
    }
  }
  
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
      <button class="settings-close-btn" id="settingsCloseBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    modalContent.appendChild(header);
    const body = document.createElement('div');
    body.className = 'settings-body';
    for (const [categoryKey, category] of Object.entries(settingsConfig)) {
      const section = document.createElement('div');
      section.className = 'settings-section';
      const sectionTitle = document.createElement('h3');
      sectionTitle.className = 'settings-section-title';
      sectionTitle.textContent = category.title;
      section.appendChild(sectionTitle);
      for (const setting of category.settings) {
        if (setting.type === 'qr') {
          const qrContainer = createQrCode(setting);
          section.appendChild(qrContainer);
          continue;
        }
        
        const row = document.createElement('div');
        row.className = 'settings-row';
        const label = document.createElement('label');
        label.className = 'settings-label';
        label.textContent = setting.label;
        label.style.flexShrink = '0';
        row.appendChild(label);
        const currentValue = loadSetting(setting.id);
        switch(setting.type) {
          case 'range': row.appendChild(createRangeInput(setting, currentValue)); break;
          case 'select': row.appendChild(createSelect(setting, currentValue)); break;
          case 'multiselect': row.appendChild(createMultiSelect(setting, currentValue)); break;
          case 'toggle': row.appendChild(createToggle(setting, currentValue)); break;
          case 'text':
            const textInput = createTextInput(setting, currentValue);
            textInput.style.marginLeft = '1rem';
            row.appendChild(textInput);
            break;
          case 'info': row.appendChild(createInfo(setting)); break;
        }
        section.appendChild(row);
      }
      body.appendChild(section);
    }
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.innerHTML = '🔄 Сбросить все настройки';
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (confirm('Сбросить все настройки панели? Это перезагрузит страницу.')) {
        console.log('[Settings] Сброс всех настроек...');
        
        clearAllClimateDevices();
        
        for (const category of Object.values(settingsConfig)) {
          for (const setting of category.settings) {
            if (setting.type !== 'qr') {
              storage.remove(`setting_${setting.id}`);
            }
          }
        }
        
        const slots = document.querySelectorAll('.climate_slot');
        slots.forEach(slot => {
          const slotId = slot.dataset.climateSlot;
          if (slotId) {
            storage.remove(`climate_slot_${slotId}`);
          }
        });
        
        window.location.reload();
      }
    });
    body.appendChild(resetBtn);
    modalContent.appendChild(body);
    modalOverlay.appendChild(modalContent);
    const closeBtn = modalOverlay.querySelector('#settingsCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
      });
    }
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
      setTimeout(() => {
        if (modal && modal.parentNode) modal.remove();
        modal = null;
      }, 300);
    }
    isOpen = false;
    document.body.style.overflow = '';
  }
  
  function init() {
    console.log('[Settings] init()');
    
    applySetting('widgetSize', loadSetting('widgetSize') || 13.5);
    applySetting('widgetOpacity', loadSetting('widgetOpacity') || 1);
    applySetting('widgetBlur', loadSetting('widgetBlur') || 10);
    applySetting('showDate', loadSetting('showDate') !== false);
    applySetting('showWeekday', loadSetting('showWeekday') !== false);
    applySetting('nightModeOnClockTap', loadSetting('nightModeOnClockTap') !== false);
    applySetting('climateOffButton', loadSetting('climateOffButton') !== false);
    applySetting('climateSlotsCount', loadSetting('climateSlotsCount') || '6');
    applySetting('climateIconColor', loadSetting('climateIconColor') || 'Белый');
    applySetting('showNetworkStatus', loadSetting('showNetworkStatus') !== false);
    applySetting('autoWallpaperInterval', loadSetting('autoWallpaperInterval') || '5 минут');
    applySetting('wallpaperServers', loadSetting('wallpaperServers') || ['picsum_proxy', 'picsum']);
    applySetting('playerVolumeStep', loadSetting('playerVolumeStep') || 5);
    applySetting('autoRequestMusicState', loadSetting('autoRequestMusicState') !== false);
    applySetting('appsSlotsCount', loadSetting('appsSlotsCount') || '4');
    applySetting('showAppLabels', loadSetting('showAppLabels') || false);
    applySetting('showFooterText', loadSetting('showFooterText') !== false);
    applySetting('footerText', loadSetting('footerText') || 'ТенеТ Т8 Вместе к новым свершениям ТенеТ Т8');
    applySetting('offModeHideClimate', loadSetting('offModeHideClimate') !== false);
    applySetting('offModeHideApps', loadSetting('offModeHideApps') !== false);
    applySetting('offModeHidePlayer', loadSetting('offModeHidePlayer') !== false);
    applySetting('offModeHideRightButtons', loadSetting('offModeHideRightButtons') !== false);
    
    const settingsBtn = document.getElementById('btnSettings');
    if (settingsBtn) {
      if (settingsBtn._clickHandler) {
        settingsBtn.removeEventListener('click', settingsBtn._clickHandler);
      }
      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('[Settings] Кнопка настроек нажата');
        open();
      };
      settingsBtn._clickHandler = clickHandler;
      settingsBtn.addEventListener('click', clickHandler);
      
      if (typeof attachOemTouchFeedback === 'function') {
        attachOemTouchFeedback(settingsBtn);
      }
      
      console.log('[Settings] Обработчик на кнопку настроек установлен');
    } else {
      console.error('[Settings] btnSettings не найдена в DOM');
    }
  }
  
  return { init, open, close, applyOpacityToNewElement };
})();