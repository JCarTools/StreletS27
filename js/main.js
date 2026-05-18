/**********************************************
 * My Black Window - Dashboard
 * Точка входа: инициализация всех модулей
 **********************************************/

let originalOnAndroidEvent = window.onAndroidEvent;

window.onAndroidEvent = function(type, data) {
  console.log('[Main] onAndroidEvent:', type, data);
  if (type === "musicInfo") {
    if (modules.player) modules.player.updateMusicInfo(data);
  } else if (type === "climateState") {
    if (modules.climate) modules.climate.updateState(data);
  } else if (type === "carData") {
    if (modules.carData) modules.carData.updateFromEvent(data);
  } else if (type === "volumeChanged") {
    if (modules.volume) modules.volume.handleVolumeFromSystem(data);
    if (modules.player) modules.player.handleVolumeFromSystem(data);
  }
  if (originalOnAndroidEvent && typeof originalOnAndroidEvent === 'function') {
    originalOnAndroidEvent(type, data);
  }
};

function toggleWidgetsVisibility() {
  if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
    document.body.classList.toggle('widgets-hidden');
  }
}

function changeWallpaper() {
  const mode = storage.load("wallpaperMode");
  if (mode === "auto") {
    if (modules.wallpaper && modules.wallpaper.setAuto) modules.wallpaper.setAuto(true);
  } else if (mode === "custom") {
    if (modules.wallpaper && modules.wallpaper.nextCustom) modules.wallpaper.nextCustom();
  }
}

function isBackgroundElement(target) {
  if (target === document.body) return true;
  
  const excludeSelectors = [
    '.settings-modal-overlay',
    '.settings-modal-content',
    '.settings-toggle',
    '.settings-range',
    '.settings-reset-btn',
    '.settings-close-btn',
    '.modal-overlay',
    '.modal-content',
    '.picker-drawer',
    '.picker-item',
    '.drawer-close',
    '#sidebar',
    '.wallpaper-item',
    '.close-btn',
    '.custom-wallpaper-btn',
    '.climate_slot',
    '.climate-off-all',
    '.app_slot',
    '.widget_player__btn',
    '.widget_player__track_line',
    '#btnNetwork',
    '#btnClose',
    '#btnWallpaper',
    '#openSidebar',
    '#btnSettings',
    '.brand-footer'
  ];
  
  for (const selector of excludeSelectors) {
    if (target.closest(selector)) return false;
  }
  
  const dashboard = document.querySelector('.dashboard');
  if (dashboard && dashboard.contains(target)) return false;
  
  return true;
}

let lastTap = 0;
function handleDoubleTap(e) {
  const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets');
  if (!doubleTapEnabled) return;
  
  if (!isBackgroundElement(e.target)) return;
  
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTap;
  if (tapLength < 500 && tapLength > 0) {
    e.stopPropagation();
    e.preventDefault();
    document.body.classList.toggle('widgets-hidden');
    // Не сохраняем состояние, чтобы при перезапуске виджеты всегда были видны
    lastTap = 0;
  } else {
    lastTap = currentTime;
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
    setTimeout(() => preloader.remove(), 500);
  }
  console.log('[Main] Все модули загружены');
}

function cleanupIntervals() {
  console.log('[Main] Очистка интервалов...');
  if (modules.clock && modules.clock.stop) modules.clock.stop();
  if (modules.volume && modules.volume.stopAutoCheck) modules.volume.stopAutoCheck();
  if (modules.carData && modules.carData.stopAutoUpdate) modules.carData.stopAutoUpdate();
  if (modules.network && modules.network.stopAutoCheck) modules.network.stopAutoCheck();
  if (modules.climate && modules.climate.destroy) modules.climate.destroy();
}
window.addEventListener('beforeunload', cleanupIntervals);

function initUI() {
  if (modules.wallpaper) {
    modules.wallpaper.restore();
    modules.wallpaper.initAutoMode();
    // Всегда показываем виджеты при запуске, игнорируя сохранённое состояние
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
  }
  if (modules.clock) modules.clock.start();
  if (modules.draggableNetwork) modules.draggableNetwork.init();
  if (modules.brandEditor) modules.brandEditor.init();
  if (modules.player) modules.player.init();
  if (modules.apps) modules.apps.init();
  if (modules.network) modules.network.init();
  if (modules.settings) modules.settings.init();
  if (modules.carData) modules.carData.init();
  if (modules.volume) modules.volume.init();
  if (modules.volumeSwipe) modules.volumeSwipe.init();

  document.getElementById("btnClose")?.addEventListener("click", (e) => {
    e.stopPropagation();
    android.onClose();
  });

  const btnWallpaper = document.getElementById("btnWallpaper");
  btnWallpaper?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (modules.wallpaper && modules.wallpaper.toggleAutoMode) modules.wallpaper.toggleAutoMode();
  });
  if (storage.load("wallpaperMode") === "auto") btnWallpaper?.classList.add("active");

  // Обработчик клика для off-mode
  document.body.addEventListener("click", (e) => {
    // Если мы в off-mode
    if (document.body.classList.contains('off-mode')) {
      const excludeSelectors = [
        '.settings-modal-overlay',
        '.settings-modal-content',
        '.modal-overlay',
        '.modal-content',
        '.picker-drawer',
        '#sidebar',
        '#btnNetwork',
        '#btnClose'
      ];
      
      for (const selector of excludeSelectors) {
        if (e.target.closest(selector)) return;
      }
      
      if (modules.wallpaper && modules.wallpaper.exitOffMode) {
        e.stopPropagation();
        modules.wallpaper.exitOffMode();
      }
      return;
    }
    
    // Обычный режим
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
  document.body.addEventListener("click", (e) => {
    const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets');
    if (doubleTapEnabled && e.detail === 2) {
      if (!isBackgroundElement(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      document.body.classList.toggle('widgets-hidden');
      // Не сохраняем состояние
    }
  });

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.add("open");
  });
  document.getElementById("closeSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.remove("open");
  });
  
  document.querySelectorAll(".wallpaper-item").forEach((it, index)=>{
    it.addEventListener("click", (e)=>{ 
      e.stopPropagation();
      if (modules.wallpaper && modules.wallpaper.setCustomByIndex) modules.wallpaper.setCustomByIndex(index);
      sidebar.classList.remove("open"); 
    });
  });

  document.getElementById('presetVideoKamin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modules.wallpaper && modules.wallpaper.setVideoBackground) modules.wallpaper.setVideoBackground('images/kaminHD.mp4');
    sidebar.classList.remove('open');
  });

  attachOemTouchFeedback(".widget_buttons, #btnNetwork, #btnClose, .widget_player__btn, .close-btn, .drawer-close, .climate-off-all, .app_slot, .climate_slot, .settings-toggle, .settings-close-btn, .settings-reset-btn");

  document.addEventListener("contextmenu", e=>e.preventDefault());
  android.onJsReady();
  setTimeout(onAllModulesReady, 500);
}

async function start() {
  console.log('[Main] Загрузка климата...');
  if (modules.climate) await modules.climate.init();
  console.log('[Main] Климат загружен');
  initUI();
}

document.addEventListener("DOMContentLoaded", start);