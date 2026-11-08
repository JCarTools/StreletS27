/**********************************************
 * Модуль: Логика настроек — точка входа
 * [FIX] applySetting('screenOrientation'): fallback-ветка тоже вызывает
 *       widgetsReorder.refresh() — иначе при отсутствии layoutProfile
 *       виджеты не перестраивались.
 * [FIX] applyDataWidgetVisibility: синхронизирует видимость #btnNetwork
 *       с showNetworkStatus, а не только родительскую строку.
 * [NEW] showClimateTempCarousel: включение/выключение карусели температуры.
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

  let autoDimInterval = null;
  let autoDimSunTimes = { sunrise: null, sunset: null };
  let autoDimLastDate = null;

  async function fetchSunTimes(lat, lon) {
    try {
      const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'OK' && data.results) {
        return {
          sunrise: new Date(data.results.sunrise),
          sunset: new Date(data.results.sunset)
        };
      }
    } catch (e) {
      console.warn('[Settings] Sun times error:', e);
    }
    return null;
  }

  function applyThemeBasedOnTime() {
    const mode = loadSetting('screenDimMode') || 'День';
    if (mode === 'День') { document.body.classList.remove('screen-dimmed'); return; }
    if (mode === 'Ночь') { document.body.classList.add('screen-dimmed'); return; }

    const now = new Date();
    const today = now.toDateString();

    if (autoDimLastDate !== today) {
      autoDimLastDate = today;
      autoDimSunTimes = { sunrise: null, sunset: null };

      if (modules.weather && typeof modules.weather.getCoords === 'function') {
        const coords = modules.weather.getCoords();
        if (coords && coords.lat && coords.lon) {
          fetchSunTimes(coords.lat, coords.lon).then(times => {
            if (times) { autoDimSunTimes = times; applyThemeBasedOnTime(); }
          });
        }
      } else {
        const savedLat = storage.load('weather_lat');
        const savedLon = storage.load('weather_lon');
        if (savedLat && savedLon) {
          fetchSunTimes(savedLat, savedLon).then(times => {
            if (times) { autoDimSunTimes = times; applyThemeBasedOnTime(); }
          });
        }
      }
    }

    let sunrise = autoDimSunTimes.sunrise;
    let sunset = autoDimSunTimes.sunset;
    if (!sunrise || !sunset) {
      sunrise = new Date(); sunrise.setHours(7, 0, 0, 0);
      sunset = new Date(); sunset.setHours(19, 0, 0, 0);
    }
    const isDay = now >= sunrise && now < sunset;
    document.body.classList.toggle('screen-dimmed', !isDay);
  }

  function startAutoDim() {
    stopAutoDim();
    applyThemeBasedOnTime();
    autoDimInterval = setInterval(() => {
      if (loadSetting('screenDimMode') === 'Авто по солнцу') applyThemeBasedOnTime();
    }, 60000);
  }

  function stopAutoDim() {
    if (autoDimInterval) { clearInterval(autoDimInterval); autoDimInterval = null; }
  }

  function applyClimateColors(colorName) {
    const info = getClimateColorInfo(colorName);
    document.documentElement.style.setProperty('--climate-icon-color', info.hex);
    document.documentElement.style.setProperty('--climate-temp-rgb', info.rgb);
    const isWhite = colorName === 'Белый';
    document.body.classList.toggle('climate-icons-white', isWhite);
    document.body.classList.toggle('climate-icons-black', !isWhite);
  }

  // [FIX] Синхронизируем видимость #btnNetwork с showNetworkStatus.
  function applyDataWidgetVisibility() {
    const wrapper = document.getElementById('networkWidgetWrapper');
    if (!wrapper) return;

    const showDataWidget = loadSetting('showDataWidget') !== false;
    const showNetwork = loadSetting('showNetworkStatus') !== false;
    const showFuel = loadSetting('showFuel') !== false;
    const showBattery = loadSetting('showBattery') !== false;
    const showStorage = loadSetting('showStorage') !== false;

    const allInternalOff = !showNetwork && !showFuel && !showBattery && !showStorage;
    const wrapperHidden = !showDataWidget || allInternalOff;
    wrapper.classList.toggle(Core.WIDGET_HIDDEN_CLASS, wrapperHidden);

    const topRow = document.querySelector('.widget_placeholder__top');
    const centerRow = document.querySelector('.widget_placeholder__center');
    const bottomRow = document.querySelector('.widget_placeholder__bottom');
    const storageRow = document.querySelector('.widget_placeholder__storage');

    if (topRow) topRow.classList.toggle('is-hidden', !showNetwork);
    if (centerRow) centerRow.classList.toggle('is-hidden', !showFuel);
    if (bottomRow) bottomRow.classList.toggle('is-hidden', !showBattery);
    if (storageRow) storageRow.classList.toggle('is-hidden', !showStorage);

    // [FIX] Явно скрываем/показываем саму кнопку сети.
    const btnNetwork = document.getElementById('btnNetwork');
    if (btnNetwork) {
      if (!showNetwork) {
        btnNetwork.style.display = 'none';
      } else {
        btnNetwork.style.display = '';
      }
    }

    if (modules.network && typeof modules.network.setVisible === 'function') modules.network.setVisible();
  }

  function applySetting(key, value) {
    if (Core.isApplyingSetting()) return;
    Core.setApplying(true);
    try {
      switch (key) {
        case 'screenOrientation': {
          const profile = value === 'Вертикальный' ? 'portrait' : 'landscape';
          if (modules.layoutProfile && typeof modules.layoutProfile.set === 'function') {
            modules.layoutProfile.set(profile, { toast: false });
          } else {
            storage.save('setting_layoutProfile', profile);
            document.body.classList.remove('layout-portrait', 'layout-landscape');
            document.body.classList.add(profile === 'portrait' ? 'layout-portrait' : 'layout-landscape');
            // [FIX] Fallback: явно перестраиваем виджеты.
            setTimeout(() => {
              if (modules.widgetsReorder && typeof modules.widgetsReorder.refresh === 'function') {
                modules.widgetsReorder.refresh();
              }
            }, 30);
          }
          break;
        }
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
        case 'screenDimMode':
          applyThemeBasedOnTime();
          startAutoDim();
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
        case 'showClimateTempCarousel':
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
          if (mode !== value) storage.save('setting_fuelDisplayMode', mode);
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
        case 'showCompass': {
          const compassWidget = document.getElementById('widgetCompass');
          if (compassWidget) compassWidget.classList.toggle(Core.WIDGET_HIDDEN_CLASS, !value);
          break;
        }
        case 'showMiniMap':
          if (modules.navigation && typeof modules.navigation.refresh === 'function') modules.navigation.refresh();
          break;
        case 'miniMapTheme': {
          const storedTheme = miniMapThemeToStorage(value);
          if (storedTheme !== value) storage.save('setting_miniMapTheme', storedTheme);
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
        case 'offModeHideWeather':
        case 'offModeHideCompass':
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
    applySetting('widgetSize', loadSetting('widgetSize') || 12.5);
    applySetting('widgetOpacity', loadSetting('widgetOpacity') || 0.85);
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
    applySetting('showClimateTempCarousel', loadSetting('showClimateTempCarousel') !== false);
    applySetting('climateTempOpacity', loadSetting('climateTempOpacity') || 0.25);
    applySetting('climateTempFontSize', loadSetting('climateTempFontSize') || 7.5);
    applySetting('fuelTankSize', loadSetting('fuelTankSize') || '57');
    applySetting('fuelDisplayMode', loadSetting('fuelDisplayMode') || 'Литры');
    applySetting('showWeather', loadSetting('showWeather') === true);
    applySetting('showCompass', loadSetting('showCompass') === true);
    applySetting('showMiniMap', loadSetting('showMiniMap') === true);

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
    applySetting('showApps', loadSetting('showApps') === true);
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
    applySetting('offModeHideWeather', loadSetting('offModeHideWeather') !== false);
    applySetting('offModeHideCompass', loadSetting('offModeHideCompass') !== false);

    applySetting('screenDimMode', loadSetting('screenDimMode') || 'Авто по солнцу');
    startAutoDim();

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
      if (typeof attachOemTouchFeedback === 'function') attachOemTouchFeedback(settingsBtn);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  function destroy() { stopAutoDim(); }

  return {
    init,
    destroy,
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