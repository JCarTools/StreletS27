/**********************************************
 * My Black Window - Dashboard
 * [DIAG] Визуальная диагностика для машины.
 * [FIX] carData больше НЕ прокидывается в climate.
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
  if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
    document.body.classList.toggle('widgets-hidden');
  }
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
    '#btnNetwork', '#btnClose', '#btnWallpaper', '#openSidebar', '#btnSettings',
    '.brand-footer', '#diagOverlay'
  ];
  for (const selector of excludeSelectors) {
    if (target.closest && target.closest(selector)) return false;
  }
  const dashboard = document.querySelector('.dashboard');
  if (dashboard && dashboard.contains(target)) return false;
  return true;
}

let lastTap = 0;
let lastTapX = 0, lastTapY = 0;
const DOUBLE_TAP_MS = 500;
const DOUBLE_TAP_DISTANCE = 60;

function handleDoubleTap(e) {
  const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets');
  if (!doubleTapEnabled) return;
  if (!isBackgroundElement(e.target)) return;
  const point = e.touches?.[0] || e;
  const x = point?.clientX ?? 0;
  const y = point?.clientY ?? 0;
  const currentTime = Date.now();
  const tapLength = currentTime - lastTap;
  const dx = x - lastTapX, dy = y - lastTapY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (tapLength < DOUBLE_TAP_MS && tapLength > 0 && dist < DOUBLE_TAP_DISTANCE) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    document.body.classList.toggle('widgets-hidden');
    lastTap = 0; lastTapX = 0; lastTapY = 0;
  } else {
    lastTap = currentTime; lastTapX = x; lastTapY = y;
  }
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
}
window.addEventListener('beforeunload', cleanupIntervals);

async function initUI() {
  if (typeof diag !== 'undefined') diag.init();

  if (modules.wallpaper) {
    try { await modules.wallpaper.restore(); }
    catch (e) { warn('[Main] wallpaper.restore error:', e); }
    try { modules.wallpaper.initAutoMode(); }
    catch (e) { warn('[Main] wallpaper.initAutoMode error:', e); }
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
  }
  if (modules.clock) modules.clock.start();
  if (modules.brandEditor) modules.brandEditor.init();
  if (modules.player) modules.player.init();
  if (modules.apps) modules.apps.init();
  if (modules.network) modules.network.init();
  if (modules.fuel) modules.fuel.init();
  if (modules.settings) modules.settings.init();
  if (modules.carData) modules.carData.init();
  if (modules.volume) modules.volume.init();
  if (modules.volumeSwipe) modules.volumeSwipe.init();

  document.getElementById("btnClose")?.addEventListener("click", (e) => {
    e.stopPropagation();
    android.onClose();
  });

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
    if (document.body.classList.contains('off-mode')) {
      const exclude = [
        '.settings-modal-overlay', '.settings-modal-content',
        '.modal-overlay', '.modal-content', '.picker-drawer',
        '#sidebar', '#btnNetwork', '#btnClose', '#diagOverlay'
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
    if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
      toggleWidgetsVisibility();
    } else {
      changeWallpaper();
    }
  });

  document.body.addEventListener("touchstart", handleDoubleTap);
  document.body.addEventListener("mousedown", handleDoubleTap);

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar?.classList.add("open");
  });
  document.getElementById("closeSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar?.classList.remove("open");
  });

  document.querySelectorAll(".wallpaper-item").forEach((it, index) => {
    it.addEventListener("click", (e) => {
      e.stopPropagation();
      if (modules.wallpaper && modules.wallpaper.setCustomByIndex) modules.wallpaper.setCustomByIndex(index);
      sidebar?.classList.remove("open");
    });
  });

  document.getElementById('presetVideoKamin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modules.wallpaper && modules.wallpaper.setVideoBackground) {
      modules.wallpaper.setVideoBackground('images/kaminHD.mp4');
    }
    sidebar?.classList.remove('open');
  });

  attachOemTouchFeedback(
    ".widget_buttons, #btnClose, .widget_player__btn, .close-btn, " +
    ".drawer-close, .climate-off-all, .app_slot, .climate_slot, .settings-toggle, " +
    ".settings-close-btn, .settings-reset-btn"
  );

  document.addEventListener("contextmenu", e => e.preventDefault());
  android.onJsReady();
}

async function start() {
  try {
    console.log('[Main] Загрузка климата...');
    if (modules.climate) await modules.climate.init();
    console.log('[Main] Климат загружен');
    await initUI();
  } catch (e) {
    console.error('[Main] Ошибка инициализации:', e);
  } finally {
    setTimeout(onAllModulesReady, 500);
  }
}

document.addEventListener("DOMContentLoaded", start);