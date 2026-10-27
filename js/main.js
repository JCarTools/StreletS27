/**********************************************
 * My Black Window - Dashboard
 * [FIX] Баг #8: двойной тап работает и в не-video режиме.
 * [FIX] Баг #15: attachOemTouchFeedback для новых слотов.
 * [FIX] После onJsReady — принудительно применяем тему мини-карты.
 * [NEW] Настройки разделены: settings.js (модалка) + sidebar-settings.js (аккордеон).
 **********************************************/

let originalOnAndroidEvent = window.onAndroidEvent;

window.onAndroidEvent = function(type, data) {
  if (typeof diag !== 'undefined') diag.onEvent(type, data);

  if (type === "musicInfo") {
    if (modules.player) modules.player.updateMusicInfo(data);
  } else if (type === "climateState") {
    if (modules.climate) modules.climate.updateState(data);
  } else if (type === "carData") {
    if (modules.carData) modules.carData.updateFromEvent(data);
    if (modules.fuel) modules.fuel.updateFromEvent(data);
  } else if (type === "volumeChanged") {
    if (modules.volume) modules.volume.handleVolumeFromSystem(data);
    if (modules.player) modules.player.handleVolumeFromSystem(data);
  }
  
  if (originalOnAndroidEvent && typeof originalOnAndroidEvent === 'function') {
    try { originalOnAndroidEvent(type, data); } catch (e) { /* noop */ }
  }
};

function toggleWidgetsVisibility() {
  document.body.classList.toggle('widgets-hidden');
}

function changeWallpaper() {
  const mode = storage.load("wallpaperMode") || "custom";
  if (mode === "auto") {
    if (modules.wallpaper && modules.wallpaper.setAuto) modules.wallpaper.setAuto(false);
  } else if (mode === "custom") {
    if (modules.wallpaper && modules.wallpaper.nextCustom) modules.wallpaper.nextCustom();
  }
}

function isBackgroundElement(target) {
  if (!target) return false;
  if (target === document.body) return true;
  const excludeSelectors = [
    '.settings-modal-overlay', '.settings-modal-content', '.settings-toggle',
    '.settings-range', '.settings-reset-btn', '.settings-close-btn',
    '.modal-overlay', '.modal-content', '.picker-drawer', '.picker-item',
    '.drawer-close', '#sidebar', '.wallpaper-item', '.close-btn',
    '.custom-wallpaper-btn', '.climate_slot', '.climate-off-all',
    '.app_slot', '.widget_player__btn', '.widget_player__track_line',
    '.widget_player__volume_slider',
    '#btnNetwork', '#btnWallpaper', '#openSidebar', '#btnSettings',
    '#diagOverlay', '#widgetWeather', '#widgetNavigation',
    '.widget_time', '.widget_climate', '.widget_apps', '.widget_player',
    '#widgetPlaceholder', '.dashboard',
    '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content',
    '#openWallpaperManager', '.sidebar-settings-accordion', '.settings-select', '.settings-text-input',
    '.settings-server-row', '.settings-server-cb'
  ];
  for (const selector of excludeSelectors) {
    if (target.closest && target.closest(selector)) return false;
  }
  const dashboard = document.querySelector('.dashboard');
  if (dashboard && dashboard.contains(target)) return false;
  return true;
}

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 40;

function handleTouchStart(e) {
  const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets');
  if (!doubleTapEnabled) return;
  if (!isBackgroundElement(e.target)) return;
  if (!e.touches || e.touches.length !== 1) return;

  const touch = e.touches[0];
  const now = Date.now();
  const dx = touch.clientX - lastTapX;
  const dy = touch.clientY - lastTapY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (now - lastTapTime < DOUBLE_TAP_WINDOW_MS && distance < DOUBLE_TAP_DISTANCE_PX) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    document.body.classList.toggle('widgets-hidden');
    lastTapTime = 0;
    return;
  }

  lastTapTime = now;
  lastTapX = touch.clientX;
  lastTapY = touch.clientY;
}

let isReady = false;
function onAllModulesReady() {
  if (isReady) return;
  isReady = true;
  const preloader = document.getElementById('startup-preloader');
  const appContent = document.getElementById('app-content');
  if (appContent) appContent.classList.add('ready');
  if (preloader) {
    preloader.classList.add('hide');
    setTimeout(() => {
      if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
    }, 500);
  }
}

function cleanupIntervals() {
  if (modules.clock && modules.clock.stop) modules.clock.stop();
  if (modules.volume && modules.volume.stopAutoCheck) modules.volume.stopAutoCheck();
  if (modules.carData && modules.carData.stopAutoUpdate) modules.carData.stopAutoUpdate();
  if (modules.network && modules.network.stopAutoCheck) modules.network.stopAutoCheck();
  if (modules.climate && modules.climate.destroy) modules.climate.destroy();
  if (modules.fuel && modules.fuel.destroy) modules.fuel.destroy();
  if (modules.player && modules.player.destroy) modules.player.destroy();
  if (modules.navigation && modules.navigation.destroy) modules.navigation.destroy();
}
window.addEventListener('beforeunload', cleanupIntervals);

window.rebuildSidebarGrid = async function() {
  const grid = document.querySelector('.wallpaper-grid');
  if (!grid) return;
  const list = modules.wallpaper.getStaticList();
  grid.innerHTML = '';
  
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const div = document.createElement('div');
    div.className = 'wallpaper-item';
    
    let src = item.src;
    if (!item.isBuiltin) {
      src = await modules.wallpaper.resolveStaticSrc(item);
    }
    
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.name;
      div.appendChild(img);
      div.setAttribute('data-id', item.id);
      
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modules.wallpaper && modules.wallpaper.setCustomByIndex) {
           modules.wallpaper.setCustomByIndex(i);
        }
        document.getElementById('sidebar')?.classList.remove('open');
      });
    }
    grid.appendChild(div);
  }
};

// Перепривязка ripple-эффекта на динамически созданные слоты
function refreshOemFeedbackOnSlots() {
  attachOemTouchFeedback('.widget_buttons, .widget_player__btn, .close-btn, .drawer-close, .climate-off-all, .app_slot, .climate_slot, .settings-toggle, .settings-close-btn, .settings-reset-btn, .custom-wallpaper-btn, .accordion-header');
}

async function initUI() {
  if (typeof diag !== 'undefined') diag.init();

  if (modules.wallpaper) {
    try { await modules.wallpaper.restore(); }
    catch (e) { console.warn('[Main] wallpaper.restore error:', e); }
    try { modules.wallpaper.initAutoMode(); }
    catch (e) { console.warn('[Main] wallpaper.initAutoMode error:', e); }
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
  }

  await window.rebuildSidebarGrid();

  if (modules.clock) modules.clock.start();
  if (modules.player) modules.player.init();
  if (modules.apps) modules.apps.init();
  if (modules.network) modules.network.init();
  if (modules.fuel) modules.fuel.init();
  if (modules.weather) modules.weather.init();
  if (modules.settings) modules.settings.init();
  if (modules.sidebarSettings) modules.sidebarSettings.init();
  if (modules.carData) modules.carData.init();
  if (modules.volume) modules.volume.init();
  if (modules.volumeSwipe) modules.volumeSwipe.init();
  if (modules.navigation) modules.navigation.init();
  if (modules.wallpaperManager) modules.wallpaperManager.init();

  const btnWallpaper = document.getElementById("btnWallpaper");
  if (btnWallpaper) {
    if (btnWallpaper._wallpaperClickHandler) {
      btnWallpaper.removeEventListener("click", btnWallpaper._wallpaperClickHandler);
    }
    const wallpaperClickHandler = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!modules.wallpaper || !modules.wallpaper.toggleAutoMode) {
        if (typeof showToast === 'function') showToast('Модуль обоев не загружен', 2000);
        return;
      }
      try {
        await modules.wallpaper.toggleAutoMode();
      } catch (err) {
        console.error('[Main] toggleAutoMode error:', err);
        if (typeof showToast === 'function') showToast('Ошибка переключения обоев', 2000);
      }
    };
    btnWallpaper._wallpaperClickHandler = wallpaperClickHandler;
    btnWallpaper.addEventListener("click", wallpaperClickHandler);
  }
  if (storage.load("wallpaperMode") === "auto") btnWallpaper?.classList.add("active");

  document.body.addEventListener("click", (e) => {
    if (modules.weather) modules.weather.fetchWeather();

    if (document.body.classList.contains('off-mode')) {
      const exclude = [
        '.settings-modal-overlay', '.settings-modal-content',
        '.modal-overlay', '.modal-content', '.picker-drawer',
        '#sidebar', '#btnNetwork', '#diagOverlay', '#widgetWeather', '#widgetNavigation',
        '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content'
      ];
      for (const selector of exclude) {
        if (e.target.closest(selector)) return;
      }
      if (modules.wallpaper && modules.wallpaper.exitOffMode) {
        e.stopPropagation();
        modules.wallpaper.exitOffMode();
      }
      return;
    }
    
    const tapToChangeEnabled = storage.load('setting_tapToChangeWallpaper');
    if (tapToChangeEnabled === false) return;
    if (!isBackgroundElement(e.target)) return;
    
    if (document.body.classList.contains('widgets-hidden')) {
       toggleWidgetsVisibility();
       return;
    }

    if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
      toggleWidgetsVisibility();
    } else {
      changeWallpaper();
    }
  });

  document.body.addEventListener("touchstart", handleTouchStart, { passive: false });

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar?.classList.add("open");
    
    // [NEW] Сайдбар-настройки теперь в отдельном модуле
    if (modules.sidebarSettings && typeof modules.sidebarSettings.render === 'function') {
      modules.sidebarSettings.render();
    }
  });
  
  document.getElementById("closeSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar?.classList.remove("open");
  });

  document.getElementById('presetVideoKamin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modules.wallpaper && modules.wallpaper.setVideoBackground) {
      modules.wallpaper.setVideoBackground('images/kaminHD.mp4');
    }
    sidebar?.classList.remove('open');
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (modules.player && typeof android.requestMusicState === 'function') {
        android.requestMusicState();
      }
      if (modules.weather) modules.weather.fetchWeather();
      if (modules.navigation && typeof modules.navigation.refresh === 'function') {
        modules.navigation.refresh();
      }
    }
  });

  refreshOemFeedbackOnSlots();

  // Перепривязка ripple после изменения количества слотов
  window.addEventListener('storage', (e) => {
    if (e.key === 'appsSlotsCount' || e.key === 'climateSlotsCount') {
      setTimeout(refreshOemFeedbackOnSlots, 100);
    }
  });

  document.addEventListener("contextmenu", e => e.preventDefault());
  if (typeof android.onJsReady === 'function') android.onJsReady();

  // После готовности моста — принудительно применяем тему мини-карты.
  // Это гарантирует, что setMiniMapTheme уйдёт уже в готовый Android.
  setTimeout(() => {
    if (modules.navigation && typeof modules.navigation.applyThemeNow === 'function') {
      modules.navigation.applyThemeNow();
    }
  }, 150);
}

async function start() {
  try {
    if (modules.climate) await modules.climate.init();
    await initUI();
  } catch (e) {
    console.error('[Main] Ошибка инициализации:', e);
  } finally {
    setTimeout(onAllModulesReady, 500);
  }
}

document.addEventListener("DOMContentLoaded", start);