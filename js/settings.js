/**********************************************
 * Модуль: Логика настроек — точка входа
 * [FIX] showDataWidget — общий выключатель виджета данных.
 *       showNetworkStatus — только значок сети (не скрывает весь виджет).
 **********************************************/

modules.settings = (function() {
  const Core = modules.settingsCore;
  const Slots = modules.settingsSlots;

  const {
    loadSetting,
    saveSetting,
    normalizeFuelDisplayMode,
    fuelDisplayModeToUi,
    miniMapThemeToStorage,
    miniMapThemeFromStorage,
    applyOpacity,
    applyOpacityToNewElement,
    openSystemSettings,
    performFullReset,
    getClimateColorInfo
  } = Core;

  const RESIZE_DEBOUNCE_MS = 200;

  console.log('[Settings] Модуль загружен');

  function applyClimateColors(colorName) {
    const info = getClimateColorInfo(colorName);
    document.documentElement.style.setProperty('--climate-icon-color', info.hex);
    document.documentElement.style.setProperty('--climate-temp-rgb', info.rgb);
    const isWhite = colorName === 'Белый';
    document.body.classList.toggle('climate-icons-white', isWhite);
    document.body.classList.toggle('climate-icons-black', !isWhite);
  }

  function applyDataWidgetVisibility() {
    const wrapper = document.getElementById('networkWidgetWrapper');
    if (!wrapper) return;

    // Общий выключатель (раздел «Виджеты»)
    const showDataWidget = loadSetting('showDataWidget') !== false;

    // Внутри виджета данных
    const showNetwork = loadSetting('showNetworkStatus') !== false;
    const showFuel = loadSetting('showFuel') !== false;
    const showBattery = loadSetting('showBattery') !== false;
    const showStorage = loadSetting('showStorage') !== false;

    // Скрываем сам виджет, только если:
    // - «Показывать виджет данных» выключено, ИЛИ
    // - все 4 внутренних выключателя выключены
    const allInternalOff = !showNetwork && !showFuel && !showBattery && !showStorage;
    const wrapperHidden = !showDataWidget || allInternalOff;

    wrapper.classList.toggle(Core.WIDGET_HIDDEN_CLASS, wrapperHidden);

    // Строки внутри
    const topRow = document.querySelector('.widget_placeholder__top');
    const centerRow = document.querySelector('.widget_placeholder__center');
    const bottomRow = document.querySelector('.widget_placeholder__bottom');
    const storageRow = document.querySelector('.widget_placeholder__storage');

    if (topRow) topRow.classList.toggle('is-hidden', !showNetwork);
    if (centerRow) centerRow.classList.toggle('is-hidden', !showFuel);
    if (bottomRow) bottomRow.classList.toggle('is-hidden', !showBattery);
    if (storageRow) storageRow.classList.toggle('is-hidden', !showStorage);

    // Синхронизируем network.js
    if (modules.network && typeof modules.network.setVisible === 'function') {
      modules.network.setVisible();
    }
  }

  function applySetting(key, value) {
    if (Core.isApplyingSetting()) return;
    Core.setApplying(true);
    try {
      switch (key) {
        case 'widgetSize': {
          document.documentElement.style.setProperty('--widget-size', value + 'rem');
          document.documentElement.style.setProperty('--clock-digit-size', `calc(${value}rem * 0.2)`);
          setTimeout(() => {
            try {
              const appsCount = loadSetting('appsSlotsCount');
              if (appsCount) Slots.updateAppsSlotsCount(parseInt(appsCount, 10));
              const climateCount = loadSetting('climateSlotsCount');
              if (climateCount) Slots.updateClimateSlotsCount(parseInt(climateCount, 10));
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
        case 'tapToChangeWallpaper':
          storage.save('tapToChangeWallpaper', value);
          break;
        case 'nightModeOnClockTap':
          storage.save('setting_nightModeOnClockTap', value);
          Slots.updateClockTapHandler();
          break;
        case 'climateOffButton':
          Slots.updateClimateOffButton();
          break;
        case 'climateSlotsCount':
          Slots.updateClimateSlotsCount(parseInt(value, 10));
          break;
        case 'climateIconColor':
          applyClimateColors(value);
          Slots.updateClimateIconColor(value);
          if (modules.climate && typeof modules.climate.updateIconColors === 'function') {
            modules.climate.updateIconColors();
          }
          break;
        case 'showClimateTemp':
          if (modules.climateTempZones && typeof modules.climateTempZones.applyVisibility === 'function') {
            modules.climateTempZones.applyVisibility();
          }
          break;
        case 'climateTempOpacity':
          document.documentElement.style.setProperty('--climate-temp-opacity', value);
          break;
        case 'climateTempFontSize':
          document.documentElement.style.setProperty('--climate-temp-font-size', value + 'rem');
          break;
        case 'fuelTankSize':
          if (modules.fuel && typeof modules.fuel.refreshDisplay === 'function') modules.fuel.refreshDisplay();
          break;
        case 'fuelDisplayMode': {
          const mode = normalizeFuelDisplayMode(value);
          if (mode !== value) {
            storage.save('setting_fuelDisplayMode', mode);
          }
          if (modules.fuel && typeof modules.fuel.refreshDisplay === 'function') modules.fuel.refreshDisplay();
          break;
        }
        case 'showFuel':
        case 'showBattery':
        case 'showStorage':
        case 'showNetworkStatus':
        case 'showDataWidget':
          applyDataWidgetVisibility();
          break;
        case 'showClockWeather':
          if (modules.weather && typeof modules.weather.refreshClockDisplay === 'function') {
            modules.weather.refreshClockDisplay();
          }
          break;
        case 'showClock': {
          const clockWidget = document.querySelector('.widget_time');
          if (clockWidget) clockWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showClimate': {
          const climateWidget = document.querySelector('.widget_climate');
          if (climateWidget) climateWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showApps': {
          const appsWidget = document.querySelector('.widget_apps');
          if (appsWidget) appsWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showPlayer': {
          const playerWidget = document.querySelector('.widget_player');
          if (playerWidget) playerWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showWeather': {
          const weatherWidget = document.getElementById('widgetWeather');
          if (weatherWidget) weatherWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showMiniMap':
          if (modules.navigation && typeof modules.navigation.refresh === 'function') {
            modules.navigation.refresh();
          }
          break;
        case 'miniMapTheme': {
          const storedTheme = miniMapThemeToStorage(value);
          if (storedTheme !== value) {
            storage.save('setting_miniMapTheme', storedTheme);
          }
          if (modules.navigation && typeof modules.navigation.applyThemeNow === 'function') {
            modules.navigation.applyThemeNow();
          } else if (modules.navigation && typeof modules.navigation.refresh === 'function') {
            modules.navigation.refresh();
          }
          break;
        }
        case 'playerVolumeStep':
          break;
        case 'autoRequestMusicState':
          break;
        case 'volumeSwipeEnabled':
          if (modules.volumeSwipe && typeof modules.volumeSwipe.setEnabled === 'function') {
            modules.volumeSwipe.setEnabled(value);
          }
          break;
        case 'appsSlotsCount':
          Slots.updateAppsSlotsCount(parseInt(value, 10));
          break;
        case 'showAppLabels':
          Slots.updateAppLabels(value);
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
          if (modules.wallpaper && typeof modules.wallpaper.updateOffModeWidgetVisibility === 'function') {
            modules.wallpaper.updateOffModeWidgetVisibility();
          }
          break;
      }
    } finally {
      Core.setApplying(false);
    }
  }

  let resizeTimeout = null;
  function handleResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      try {
        const appsCount = loadSetting('appsSlotsCount');
        if (appsCount) Slots.updateAppsSlotsCount(parseInt(appsCount, 10));
        const climateCount = loadSetting('climateSlotsCount');
        if (climateCount) Slots.updateClimateSlotsCount(parseInt(climateCount, 10));
      } catch (e) { console.warn(e); }
    }, RESIZE_DEBOUNCE_MS);
  }

  function init() {
    console.log('[Settings] init()');
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
    applySetting('fuelTankSize', loadSetting('fuelTankSize') || '57');
    applySetting('fuelDisplayMode', loadSetting('fuelDisplayMode') || 'Литры');
    applySetting('showWeather', loadSetting('showWeather') === true);
    applySetting('showMiniMap', loadSetting('showMiniMap') === true);

    // Виджет данных — единый блок
    applySetting('showDataWidget', loadSetting('showDataWidget') !== false);
    applySetting('showNetworkStatus', loadSetting('showNetworkStatus') !== false);
    applySetting('showFuel', loadSetting('showFuel') !== false);
    applySetting('showBattery', loadSetting('showBattery') !== false);
    applySetting('showStorage', loadSetting('showStorage') !== false);

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

    applyDataWidgetVisibility();

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
    miniMapThemeFromStorage,
    getClimateColorInfo
  };
})();