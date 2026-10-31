/**********************************************
 * My Black Window - Dashboard
 **********************************************/

(function installModuleEventBindings() {
  if (typeof EventBus === 'undefined') return;

  EventBus.on('musicInfo', (data) => {
    if (modules.player) modules.player.updateMusicInfo(data);
  });
  EventBus.on('climateState', (data) => {
    if (modules.climate) modules.climate.updateState(data);
  });
  EventBus.on('carData', (data) => {
    if (modules.carData) modules.carData.updateFromEvent(data);
    if (modules.fuel) modules.fuel.updateFromEvent(data);
  });
  EventBus.on('volumeChanged', (data) => {
    if (modules.volume) modules.volume.handleVolumeFromSystem(data);
    if (modules.player) modules.player.handleVolumeFromSystem(data);
  });
})();

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
    '.settings-server-row', '.settings-server-cb',
    '.settings-header-link',
    '.climate-temp-zone', '.climate-temp-carousel',
    '#climate-temp-zone-left', '#climate-temp-zone-right', '#climate-temp-carousel',
    '#speedtest-overlay', '.volume-indicator', '.volume-hint',
    '.onboarding-overlay', '.onboarding-content'
  ];
  for (const selector of excludeSelectors) {
    if (target.closest && target.closest(selector)) return false;
  }
  const dashboard = document.querySelector('.dashboard');
  if (dashboard && dashboard.contains(target)) return false;
  return true;
}

let bgLongPressTriggered = false;
let bgLongPressTimer = null;
let bgLongPressStartX = 0;
let bgLongPressStartY = 0;
let bgLongPressMoved = false;

function handleBackgroundLongPressStart(e) {
  if (!isBackgroundElement(e.target)) return;
  if (document.body.classList.contains('off-mode')) return;
  if (document.body.classList.contains('widgets-hidden')) return;
  if (e.touches && e.touches.length !== 1) return;

  const point = e.touches ? e.touches[0] : e;
  if (!point) return;

  bgLongPressStartX = point.clientX;
  bgLongPressStartY = point.clientY;
  bgLongPressTriggered = false;
  bgLongPressMoved = false;

  bgLongPressTimer = setTimeout(() => {
    if (bgLongPressMoved) return;
    bgLongPressTriggered = true;
    if (navigator.vibrate) {
      try { navigator.vibrate(20); } catch (err) {}
    }
    const shouldSave = confirm('Сохранить текущие обои в «Ваши обои»?');
    if (shouldSave) {
      if (modules.wallpaper && typeof modules.wallpaper.saveCurrentAsUserWallpaper === 'function') {
        modules.wallpaper.saveCurrentAsUserWallpaper();
      }
    }
    setTimeout(() => { bgLongPressTriggered = false; }, 100);
  }, 1400); 
}

function handleBackgroundLongPressMove(e) {
  if (!bgLongPressTimer) return;
  const point = e.touches ? e.touches[0] : e;
  if (!point) return;
  const dx = Math.abs(point.clientX - bgLongPressStartX);
  const dy = Math.abs(point.clientY - bgLongPressStartY);
  if (dx > 10 || dy > 10) {
    bgLongPressMoved = true;
    clearTimeout(bgLongPressTimer);
    bgLongPressTimer = null;
  }
}

function handleBackgroundLongPressEnd(e) {
  if (bgLongPressTimer) {
    clearTimeout(bgLongPressTimer);
    bgLongPressTimer = null;
  }
  if (bgLongPressTriggered && e && e.cancelable) {
    e.preventDefault();
    e.stopPropagation();
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
  if (modules.climateTemp && modules.climateTemp.destroy) modules.climateTemp.destroy();
  if (modules.fuel && modules.fuel.destroy) modules.fuel.destroy();
  if (modules.player && modules.player.destroy) modules.player.destroy();
  if (modules.navigation && modules.navigation.destroy) modules.navigation.destroy();
  if (modules.widgetsReorder && modules.widgetsReorder.destroy) modules.widgetsReorder.destroy();
}
window.addEventListener('beforeunload', cleanupIntervals);

window.rebuildSidebarGrid = async function() {
  const grid = document.querySelector('.wallpaper-grid');
  if (!grid) return;
  if (!modules.wallpaper || typeof modules.wallpaper.getStaticList !== 'function') return;
  const list = modules.wallpaper.getStaticList();
  grid.innerHTML = '';

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const div = document.createElement('div');
    div.className = 'wallpaper-item';

    let src = item.src;
    if (!item.isBuiltin) {
      try { src = await modules.wallpaper.resolveStaticSrc(item); } catch (e) { src = null; }
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
        closeSidebar();
      });
    }
    grid.appendChild(div);
  }
};

function refreshOemFeedbackOnSlots() {
  attachOemTouchFeedback('.widget_buttons, .widget_player__btn, .close-btn, .drawer-close, .climate-off-all, .app_slot, .climate_slot, .settings-toggle, .settings-close-btn, .settings-reset-btn, .custom-wallpaper-btn, .accordion-header');
}

function forceResetSwipe() {
  if (modules.volumeSwipe && typeof modules.volumeSwipe.resetSwipeState === 'function') {
    modules.volumeSwipe.resetSwipeState();
  }
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  sidebar?.classList.remove("open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("visible");
  if (modules.sidebarSettings && typeof modules.sidebarSettings.collapse === 'function') {
    modules.sidebarSettings.collapse();
  }
}

let bgClickTimer = null;
let lastClickTime = 0;
let lastClickX = 0;
let lastClickY = 0;
const DOUBLE_CLICK_MS = 300;
const DOUBLE_CLICK_DIST = 40;

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
  if (modules.climateTemp) modules.climateTemp.init();
  if (modules.widgetsReorder) modules.widgetsReorder.init();

  if (modules.onboarding) {
    setTimeout(() => {
      modules.onboarding.init();
    }, 1000);
  }

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
    if (bgLongPressTriggered) return;

    if (document.body.classList.contains('off-mode')) {
      const exclude = [
        '.settings-modal-overlay', '.settings-modal-content',
        '.modal-overlay', '.modal-content', '.picker-drawer',
        '#sidebar', '#btnNetwork', '#diagOverlay', '#widgetWeather', '#widgetNavigation',
        '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content',
        '.climate-temp-zone', '.climate-temp-carousel',
        '.onboarding-overlay', '.onboarding-content'
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

    if (!isBackgroundElement(e.target)) return;

    if (document.body.classList.contains('widgets-hidden')) {
       toggleWidgetsVisibility();
       return;
    }

    const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets') === true;
    const tapToChangeEnabled = storage.load('setting_tapToChangeWallpaper') !== false;

    if (doubleTapEnabled) {
      const now = Date.now();
      const dx = e.clientX - lastClickX;
      const dy = e.clientY - lastClickY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (now - lastClickTime < DOUBLE_CLICK_MS && dist < DOUBLE_CLICK_DIST) {
        clearTimeout(bgClickTimer);
        bgClickTimer = null;
        lastClickTime = 0;
        toggleWidgetsVisibility();
        return;
      }

      lastClickTime = now;
      lastClickX = e.clientX;
      lastClickY = e.clientY;

      bgClickTimer = setTimeout(() => {
        lastClickTime = 0;
        if (tapToChangeEnabled) {
          if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
            toggleWidgetsVisibility();
          } else {
            changeWallpaper();
          }
        }
      }, DOUBLE_CLICK_MS);

    } else {
      if (tapToChangeEnabled) {
        if (modules.wallpaper && modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
          toggleWidgetsVisibility();
        } else {
          changeWallpaper();
        }
      }
    }
  });

  document.body.addEventListener("touchstart", handleBackgroundLongPressStart, { passive: true });
  document.body.addEventListener("touchend", handleBackgroundLongPressEnd);
  document.body.addEventListener("touchcancel", handleBackgroundLongPressEnd);
  document.body.addEventListener("touchmove", handleBackgroundLongPressMove, { passive: true });
  document.body.addEventListener("mousedown", handleBackgroundLongPressStart);
  document.body.addEventListener("mouseup", handleBackgroundLongPressEnd);
  document.body.addEventListener("mousemove", handleBackgroundLongPressMove);
  document.body.addEventListener("mouseleave", handleBackgroundLongPressEnd);

  window.addEventListener('blur', forceResetSwipe);
  window.addEventListener('focus', forceResetSwipe);

  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  document.getElementById("openSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar?.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("visible");

    if (modules.sidebarSettings && typeof modules.sidebarSettings.render === 'function') {
      modules.sidebarSettings.render();
    }
  });

  document.getElementById("closeSidebar")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSidebar();
  });

  // Закрытие только по оверлею (фон вне сайдбара)
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      closeSidebar();
    });
  }

  document.getElementById('presetVideoKamin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modules.wallpaper && modules.wallpaper.setVideoBackground) {
      modules.wallpaper.setVideoBackground('images/kaminHD.mp4');
    }
    closeSidebar();
  });

  const btnSaveCurrentWallpaper = document.getElementById('btnSaveCurrentWallpaper');
  if (btnSaveCurrentWallpaper) {
    if (btnSaveCurrentWallpaper._saveHandler) {
      btnSaveCurrentWallpaper.removeEventListener('click', btnSaveCurrentWallpaper._saveHandler);
    }
    const saveHandler = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!modules.wallpaper || typeof modules.wallpaper.saveCurrentAsUserWallpaper !== 'function') {
        if (typeof showToast === 'function') showToast('Модуль обоев не загружен', 2000);
        return;
      }
      try {
        await modules.wallpaper.saveCurrentAsUserWallpaper();
      } catch (err) {
        console.warn('[Main] saveCurrentAsUserWallpaper error:', err);
        if (typeof showToast === 'function') showToast('Ошибка сохранения обоев', 2500);
      }
    };
    btnSaveCurrentWallpaper._saveHandler = saveHandler;
    btnSaveCurrentWallpaper.addEventListener('click', saveHandler);
    if (typeof attachOemTouchFeedback === 'function') {
      attachOemTouchFeedback(btnSaveCurrentWallpaper);
    }
  }

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

  window.addEventListener('storage', (e) => {
    if (e.key === 'appsSlotsCount' || e.key === 'climateSlotsCount') {
      setTimeout(refreshOemFeedbackOnSlots, 100);
    }
  });

  document.addEventListener("contextmenu", e => e.preventDefault());
  if (typeof android.onJsReady === 'function') android.onJsReady();

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