/**********************************************
 * Модуль: Логика настроек
 **********************************************/

modules.settings = (function() {
  let isApplyingSetting = false;

  console.log('[Settings Core] Модуль загружен');

  const STORAGE_PREFIX = 'setting_';
  const WIDGET_HIDDEN_CLASS = 'widget-hidden';
  const TEXT_SYS_SETTINGS_UNAVAILABLE = 'Системные настройки недоступны';
  const TOAST_DURATION_SHORT = 2000;
  const RESIZE_DEBOUNCE_MS = 200;

  function loadSetting(key) {
    for (const category of Object.values(modules.settingsConfig.schema)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.type === 'info') {
          return setting.value;
        }
      }
    }

    const saved = storage.load(`${STORAGE_PREFIX}${key}`);
    if (saved !== null && saved !== undefined) return saved;
    
    for (const category of Object.values(modules.settingsConfig.schema)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.default !== undefined) return setting.default;
      }
    }
    return null;
  }

  function saveSetting(key, value) {
    storage.save(`${STORAGE_PREFIX}${key}`, value);
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
    if (stored === 'night' || stored === 'Ночь') return 'Ночь';
    if (stored === 'auto' || stored === 'Авто') return 'Авто';
    if (stored === 'day' || stored === 'День') return 'День';
    return 'Ночь';
  }

  function applySetting(key, value) {
    if (isApplyingSetting) return;
    isApplyingSetting = true;
    try {
      switch (key) {
        case 'widgetSize': {
          document.documentElement.style.setProperty('--widget-size', value + 'rem');
          document.documentElement.style.setProperty('--clock-digit-size', `calc(${value}rem * 0.2)`);
          setTimeout(() => {
            try {
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
            } catch (e) { console.warn('[Settings] widgetSize post-apply:', e); }
          }, 10);
          break;
        }
        case 'widgetOpacity': applyOpacity(value); break;
        case 'widgetBlur':
          document.querySelectorAll('.widget, .picker-drawer, .sidebar, .modal-content, .settings-modal-content, .right-buttons').forEach(el => {
            el.style.backdropFilter = `blur(${value}px)`;
          });
          break;
        case 'widgetBottomMargin':
          document.documentElement.style.setProperty('--dashboard-bottom', value + 'rem');
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
        case 'showClimateTemp':
          storage.save('setting_showClimateTemp', value);
          break;
        case 'climateTempOpacity':
          storage.save('setting_climateTempOpacity', value);
          document.documentElement.style.setProperty('--climate-temp-opacity', value);
          break;
        case 'climateTempFontSize':
          storage.save('setting_climateTempFontSize', value);
          document.documentElement.style.setProperty('--climate-temp-font-size', value + 'rem');
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
          if (clockWidget) clockWidget.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showClimate': {
          storage.save('setting_showClimate', value);
          const climateWidget = document.querySelector('.widget_climate');
          if (climateWidget) climateWidget.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showApps': {
          storage.save('setting_showApps', value);
          const appsWidget = document.querySelector('.widget_apps');
          if (appsWidget) appsWidget.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showPlayer': {
          storage.save('setting_showPlayer', value);
          const playerWidget = document.querySelector('.widget_player');
          if (playerWidget) playerWidget.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showWeather': {
          storage.save('setting_showWeather', value);
          const weatherWidget = document.getElementById('widgetWeather');
          if (weatherWidget) weatherWidget.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showNetworkStatus': {
          storage.save('setting_showNetworkStatus', value);
          const networkWrapper = document.getElementById('networkWidgetWrapper');
          if (networkWrapper) networkWrapper.classList.toggle(WIDGET_HIDDEN_CLASS, !value);
          if (modules.network && typeof modules.network.setVisible === 'function') {
            modules.network.setVisible();
          }
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
    document.body.classList.toggle('climate-icons-white', isWhite);
    document.body.classList.toggle('climate-icons-black', !isWhite);
  }

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
    console.log('[Settings Core] Полный сброс...');
    document.querySelectorAll('.climate_slot').forEach(slot => {
      const slotId = slot.dataset.climateSlot;
      if (slotId) storage.remove(`climate_slot_${slotId}`);
    });
    await clearAllAppIcons();
    for (const category of Object.values(modules.settingsConfig.schema)) {
      for (const setting of category.settings) {
        if (setting.type !== 'qr' && setting.type !== 'info' && setting.type !== 'button') {
          storage.remove(`${STORAGE_PREFIX}${setting.id}`);
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
      'climateTrunkOpen', 'setting_user_custom_url', 'setting_user_custom_enabled',
      'widgetOrder', 'onboarding_completed'
    ];
    runtimeKeys.forEach(k => storage.remove(k));
    try { await idbStore.clear(); } catch (e) { console.warn(e); }
  }

  function openSystemSettings() {
    try {
      if (typeof window.androidApi !== 'undefined' && typeof window.androidApi.onSettings === 'function') {
        window.androidApi.onSettings(getToken());
        return true;
      }
      if (typeof android !== 'undefined' && typeof android.onSettings === 'function') {
        android.onSettings();
        return true;
      }
    } catch (e) {
      console.warn('[Settings Core] onSettings error:', e);
    }
    if (typeof showToast === 'function') showToast(TEXT_SYS_SETTINGS_UNAVAILABLE, TOAST_DURATION_SHORT);
    return false;
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
    }, RESIZE_DEBOUNCE_MS);
  }

  function init() {
    console.log('[Settings Core] init()');
    applySetting('widgetSize', loadSetting('widgetSize') || 13.5);
    applySetting('widgetOpacity', loadSetting('widgetOpacity') || 1);
    applySetting('widgetBlur', loadSetting('widgetBlur') || 10);
    applySetting('widgetBottomMargin', loadSetting('widgetBottomMargin') || 0.5);
    applySetting('showClockWeather', loadSetting('showClockWeather') !== false);
    applySetting('showDate', loadSetting('showDate') !== false);
    applySetting('showWeekday', loadSetting('showWeekday') !== false);
    applySetting('nightModeOnClockTap', loadSetting('nightModeOnClockTap') !== false);
    applySetting('climateOffButton', loadSetting('climateOffButton') !== false);
    applySetting('climateSlotsCount', loadSetting('climateSlotsCount') || '6');
    applySetting('climateIconColor', loadSetting('climateIconColor') || 'Белый');
    applySetting('showClimateTemp', loadSetting('showClimateTemp') !== false);
    applySetting('climateTempOpacity', loadSetting('climateTempOpacity') || 0.4);
    applySetting('climateTempFontSize', loadSetting('climateTempFontSize') || 8);
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
    applySetting('showNetworkStatus', loadSetting('showNetworkStatus') !== false);
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
        modules.settingsUI.open();
      };
      settingsBtn._clickHandler = clickHandler;
      settingsBtn.addEventListener('click', clickHandler);

      if (typeof attachOemTouchFeedback === 'function') {
        attachOemTouchFeedback(settingsBtn);
      }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  return {
    init,
    open: () => modules.settingsUI.open(),
    close: () => modules.settingsUI.close(),
    applyOpacityToNewElement,
    loadSetting,
    saveSetting,
    applySetting,
    openSystemSettings,
    performFullReset,
    fuelDisplayModeToUi,
    miniMapThemeFromStorage
  };
})();