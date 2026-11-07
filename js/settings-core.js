/**********************************************
 * Модуль: Логика настроек — ядро
 * Часть 1 из 2. Слоты — в settings-slots.js.
 * Точка входа и публичный API — в settings.js.
 * [NEW] screenOrientation: хранение 'portrait'|'landscape', UI — 'Горизонтальный'|'Вертикальный'.
 **********************************************/

modules.settingsCore = (function() {
  const STORAGE_PREFIX = 'setting_';
  const WIDGET_HIDDEN_CLASS = 'widget-hidden';
  const TEXT_SYS_SETTINGS_UNAVAILABLE = 'Системные настройки недоступны';
  const TOAST_DURATION_SHORT = 2000;

  const CLIMATE_COLOR_MAP = {
    'Белый':       { hex: '#ffffff', rgb: '255,255,255' },
    'Черный':      { hex: '#000000', rgb: '0,0,0' },
    'Чёрный':      { hex: '#000000', rgb: '0,0,0' },
    'Красный':     { hex: '#ff453a', rgb: '255,69,58' },
    'Оранжевый':   { hex: '#ff8a3c', rgb: '255,138,60' },
    'Жёлтый':      { hex: '#ffd60a', rgb: '255,214,10' },
    'Желтый':      { hex: '#ffd60a', rgb: '255,214,10' },
    'Зелёный':     { hex: '#30d158', rgb: '48,209,88' },
    'Зеленый':     { hex: '#30d158', rgb: '48,209,88' },
    'Голубой':     { hex: '#64d2ff', rgb: '100,210,255' },
    'Синий':       { hex: '#0a84ff', rgb: '10,132,255' },
    'Фиолетовый':  { hex: '#bf5af2', rgb: '191,90,242' }
  };

  function getClimateColorInfo(name) {
    return CLIMATE_COLOR_MAP[name] || CLIMATE_COLOR_MAP['Белый'];
  }

  let isApplyingSetting = false;

  // Хелперы конвертации ориентации
  function orientationToStorage(uiValue) {
    if (uiValue === 'Вертикальный') return 'portrait';
    if (uiValue === 'Горизонтальный') return 'landscape';
    return 'landscape';
  }
  function orientationFromStorage(stored) {
    if (stored === 'portrait') return 'Вертикальный';
    if (stored === 'landscape') return 'Горизонтальный';
    return 'Горизонтальный';
  }

  function loadSetting(key) {
    for (const category of Object.values(modules.settingsConfig.schema)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.type === 'info') {
          return setting.value;
        }
      }
    }

    // Ориентация хранится отдельно (setting_layoutProfile)
    if (key === 'screenOrientation') {
      const stored = storage.load('setting_layoutProfile');
      return orientationFromStorage(stored);
    }

    const saved = storage.load(`${STORAGE_PREFIX}${key}`);
    if (saved !== null && saved !== undefined && saved !== '') return saved;

    for (const category of Object.values(modules.settingsConfig.schema)) {
      for (const setting of category.settings) {
        if (setting.id === key && setting.default !== undefined) return setting.default;
      }
    }
    return null;
  }

  function saveSetting(key, value) {
    // Ориентация — сохраняем как layoutProfile
    if (key === 'screenOrientation') {
      const stored = orientationToStorage(value);
      storage.save('setting_layoutProfile', stored);
      modules.settings.applySetting(key, value);
      return;
    }
    storage.save(`${STORAGE_PREFIX}${key}`, value);
    modules.settings.applySetting(key, value);
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

  function applyOpacity(value) {
    const opacity = parseFloat(value);
    if (isNaN(opacity)) return;
    document.documentElement.style.setProperty('--widget-opacity', opacity);
    storage.save('currentOpacity', opacity);
    const widgets = document.querySelectorAll(
      '.widget, .right-buttons, .widget-wrapper, #widgetNavigation, #networkWidgetWrapper'
    );
    widgets.forEach(el => {
      el.style.opacity = opacity;
      el.style.setProperty('--widget-opacity', opacity);
    });
  }

  function applyOpacityToNewElement(element) {
    if (!element) return;
    const opacity = loadSetting('widgetOpacity');
    const val = (opacity !== null && opacity !== undefined) ? parseFloat(opacity) : 1;
    element.style.opacity = val;
    element.style.setProperty('--widget-opacity', val);
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
          if (setting.id === 'screenOrientation') continue; // отдельный ключ
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
      'widgetOrder', 'onboarding_completed',
      'setting_layoutProfile'
    ];
    runtimeKeys.forEach(k => storage.remove(k));
    try { await idbStore.clear(); } catch (e) { console.warn(e); }
  }

  return {
    STORAGE_PREFIX,
    WIDGET_HIDDEN_CLASS,
    TEXT_SYS_SETTINGS_UNAVAILABLE,
    TOAST_DURATION_SHORT,
    CLIMATE_COLOR_MAP,
    isApplyingSetting: () => isApplyingSetting,
    setApplying: (v) => { isApplyingSetting = v; },
    loadSetting,
    saveSetting,
    normalizeFuelDisplayMode,
    fuelDisplayModeToUi,
    miniMapThemeToStorage,
    miniMapThemeFromStorage,
    applyOpacity,
    applyOpacityToNewElement,
    openSystemSettings,
    clearAllAppIcons,
    performFullReset,
    getClimateColorInfo,
    orientationToStorage,
    orientationFromStorage
  };
})();