/**********************************************
 * Main entry.
 * [NEW] Инициализация layoutProfile (портрет/ландшафт).
 * [FIX] scheduleOnboarding: единая точка запуска онбординга,
 *       убрана гонка между orientationPicker и initUI().
 * [FIX] checkDashboardFit: троттлинг toast'а — не чаще одного раза в 10 секунд,
 *       чтобы не спамить при resize/перетаскивании окна.
 * [NEW] init compass + destroy в cleanupIntervals.
 * [FIX] scheduleOnboarding: setInterval(250) теперь сохраняется в модуле
 *       и снимается в cleanupIntervals(). Добавлен safety-timeout 30 с:
 *       если orientationPicker не разрешился — интервал снимается,
 *       онбординг запускается по общему правилу.
 * [FIX] checkDashboardFit: при отсутствии переполнения lastOverflowToastAt
 *       сбрасывается в 0 — следующий toast покажется сразу, без ожидания 10 с.
 * [FIX] initUI: body-обработчики (click, touch*, mouse*) вынесены в именованные
 *       функции и снимаются перед повторным навешиванием — защита от накопления.
 * [FIX] cleanupIntervals: снимает onboarding-интервал, _fitTimer, body-обработчики.
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
  storage.save('widgetsHiddenByUser', document.body.classList.contains('widgets-hidden'));
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
    '#diagOverlay', '#widgetWeather', '#widgetNavigation', '#widgetCompass',
    '.widget_time', '.widget_climate', '.widget_apps', '.widget_player',
    '#widgetPlaceholder', '.dashboard',
    '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content',
    '#openWallpaperManager', '.sidebar-settings-accordion', '.settings-select', '.settings-text-input',
    '.settings-server-row', '.settings-server-cb',
    '.settings-header-link',
    '.climate-temp-zone', '.climate-temp-carousel',
    '#climate-temp-zone-left', '#climate-temp-zone-right', '#climate-temp-carousel',
    '#speedtest-overlay', '.volume-indicator', '.volume-hint',
    '.onboarding-overlay', '.onboarding-content',
    '.orientation-picker-overlay', '.orientation-picker-content'
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

// [FIX] Реестр body-обработчиков из initUI — чтобы снять при повторном initUI/cleanup.
let bodyClickHandler = null;
let bodyTouchStartHandler = null;
let bodyTouchEndHandler = null;
let bodyTouchCancelHandler = null;
let bodyTouchMoveHandler = null;
let bodyMouseDownHandler = null;
let bodyMouseUpHandler = null;
let bodyMouseMoveHandler = null;
let bodyMouseLeaveHandler = null;

// [FIX] Интервал ожидания разрешения orientationPicker.
let onboardingWaitInterval = null;
let onboardingWaitTimeout = null;

function detachBodyHandlers() {
  if (bodyClickHandler) { document.body.removeEventListener('click', bodyClickHandler); bodyClickHandler = null; }
  if (bodyTouchStartHandler) { document.body.removeEventListener('touchstart', bodyTouchStartHandler); bodyTouchStartHandler = null; }
  if (bodyTouchEndHandler) { document.body.removeEventListener('touchend', bodyTouchEndHandler); bodyTouchEndHandler = null; }
  if (bodyTouchCancelHandler) { document.body.removeEventListener('touchcancel', bodyTouchCancelHandler); bodyTouchCancelHandler = null; }
  if (bodyTouchMoveHandler) { document.body.removeEventListener('touchmove', bodyTouchMoveHandler); bodyTouchMoveHandler = null; }
  if (bodyMouseDownHandler) { document.body.removeEventListener('mousedown', bodyMouseDownHandler); bodyMouseDownHandler = null; }
  if (bodyMouseUpHandler) { document.body.removeEventListener('mouseup', bodyMouseUpHandler); bodyMouseUpHandler = null; }
  if (bodyMouseMoveHandler) { document.body.removeEventListener('mousemove', bodyMouseMoveHandler); bodyMouseMoveHandler = null; }
  if (bodyMouseLeaveHandler) { document.body.removeEventListener('mouseleave', bodyMouseLeaveHandler); bodyMouseLeaveHandler = null; }
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
  if (modules.compass && modules.compass.destroy) modules.compass.destroy();
  if (modules.widgetsReorder && modules.widgetsReorder.destroy) modules.widgetsReorder.destroy();
  if (modules.weather && modules.weather.destroy) modules.weather.destroy();
  if (modules.settings && modules.settings.destroy) modules.settings.destroy();

  // [FIX] Снимаем body-обработчики из initUI.
  detachBodyHandlers();

  // [FIX] Снимаем интервал ожидания orientationPicker и его safety-timeout.
  if (onboardingWaitInterval) { clearInterval(onboardingWaitInterval); onboardingWaitInterval = null; }
  if (onboardingWaitTimeout) { clearTimeout(onboardingWaitTimeout); onboardingWaitTimeout = null; }

  // [FIX] Снимаем таймер fit-проверки.
  if (window._fitTimer) { clearTimeout(window._fitTimer); window._fitTimer = null; }
}
window.addEventListener('beforeunload', cleanupIntervals);

window.rebuildSidebarGrid = async function() {
  const grid = document.querySelector('.wallpaper-grid');
  if (!grid) return;

  if (modules.wallpaper && typeof modules.wallpaper.rebuildStaticWallpapers === 'function') {
    await modules.wallpaper.rebuildStaticWallpapers();
  }

  let list = [];
  if (modules.wallpaper && typeof modules.wallpaper.getStaticList === 'function') {
    list = modules.wallpaper.getStaticList();
  }

  grid.innerHTML = '';

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const div = document.createElement('div');
    div.className = 'wallpaper-item';

    let src = item.src;
    if (!item.isBuiltin && modules.wallpaper && typeof modules.wallpaper.resolveStaticSrc === 'function') {
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

// [FIX] Троттлинг показа toast при переполнении dashboard.
let lastOverflowToastAt = 0;
const OVERFLOW_TOAST_INTERVAL_MS = 10000;

function checkDashboardFit() {
  const dashboard = document.querySelector('.dashboard');
  if (!dashboard) return;

  if (document.body.classList.contains('layout-portrait')) return;

  requestAnimationFrame(() => {
    const isOverflowing = dashboard.scrollWidth > dashboard.clientWidth + 10;

    if (isOverflowing) {
      // [FIX] Toast не чаще раза в 10 секунд.
      const now = Date.now();
      if (now - lastOverflowToastAt >= OVERFLOW_TOAST_INTERVAL_MS) {
        lastOverflowToastAt = now;
        if (typeof showToast === 'function') {
          showToast('Виджеты не помещаются. Отключите лишние в настройках.', 4000);
        }
      }
    } else {
      // [FIX] При отсутствии переполнения сбрасываем таймер — следующий toast
      // покажется сразу, без ожидания 10 с с прошлого переполнения.
      lastOverflowToastAt = 0;
    }
  });
}

async function initUI() {
  if (typeof diag !== 'undefined') diag.init();

  if (modules.icons && typeof modules.icons.init === 'function') {
    modules.icons.init();
  }

  if (modules.wallpaper) {
    try { await modules.wallpaper.restore(); }
    catch (e) { console.warn('[Main] wallpaper.restore error:', e); }
    try { modules.wallpaper.initAutoMode(); }
    catch (e) { console.warn('[Main] wallpaper.initAutoMode error:', e); }
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
  }

  await window.rebuildSidebarGrid();

  if (modules.settings) modules.settings.init();
  if (modules.sidebarSettings) modules.sidebarSettings.init();

  if (modules.clock) modules.clock.start();
  if (modules.player) modules.player.init();
  if (modules.apps) modules.apps.init();
  if (modules.network) modules.network.init();
  if (modules.fuel) modules.fuel.init();
  if (modules.weather) modules.weather.init();
  if (modules.compass) modules.compass.init();
  if (modules.carData) modules.carData.init();
  if (modules.volume) modules.volume.init();
  if (modules.volumeSwipe) modules.volumeSwipe.init();
  if (modules.navigation) modules.navigation.init();
  if (modules.wallpaperManager) modules.wallpaperManager.init();
  if (modules.climateTemp) modules.climateTemp.init();
  if (modules.widgetsReorder) modules.widgetsReorder.init();

  // [NOTE] Онбординг управляется scheduleOnboarding() в start().

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

  // [FIX] Снимаем старые body-обработчики перед повторным навешиванием.
  detachBodyHandlers();

  bodyClickHandler = (e) => {
    if (modules.weather) modules.weather.fetchWeather();
    if (bgLongPressTriggered) return;

    if (document.body.classList.contains('off-mode')) {
      const exclude = [
        '.settings-modal-overlay', '.settings-modal-content',
        '.modal-overlay', '.modal-content', '.picker-drawer',
        '#sidebar', '#btnNetwork', '#diagOverlay', '#widgetWeather', '#widgetNavigation', '#widgetCompass',
        '.wm-overlay', '.wm-content', '.wm-picker-overlay', '.wm-picker-content',
        '.climate-temp-zone', '.climate-temp-carousel',
        '.onboarding-overlay', '.onboarding-content',
        '.orientation-picker-overlay', '.orientation-picker-content'
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

    const doubleTapEnabled = storage.load('setting_doubleTapToHideWidgets') === true;
    const tapToChangeEnabled = storage.load('setting_tapToChangeWallpaper') !== false;

    if (document.body.classList.contains('widgets-hidden')) {
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
      } else {
        toggleWidgetsVisibility();
      }
      return;
    }

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
          changeWallpaper();
        }
      }, DOUBLE_CLICK_MS);

    } else {
      if (tapToChangeEnabled) {
        changeWallpaper();
      }
    }
  };
  document.body.addEventListener("click", bodyClickHandler);

  bodyTouchStartHandler = handleBackgroundLongPressStart;
  bodyTouchEndHandler = handleBackgroundLongPressEnd;
  bodyTouchCancelHandler = handleBackgroundLongPressEnd;
  bodyTouchMoveHandler = handleBackgroundLongPressMove;
  bodyMouseDownHandler = handleBackgroundLongPressStart;
  bodyMouseUpHandler = handleBackgroundLongPressEnd;
  bodyMouseMoveHandler = handleBackgroundLongPressMove;
  bodyMouseLeaveHandler = handleBackgroundLongPressEnd;

  document.body.addEventListener("touchstart", bodyTouchStartHandler, { passive: true });
  document.body.addEventListener("touchend", bodyTouchEndHandler);
  document.body.addEventListener("touchcancel", bodyTouchCancelHandler);
  document.body.addEventListener("touchmove", bodyTouchMoveHandler, { passive: true });
  document.body.addEventListener("mousedown", bodyMouseDownHandler);
  document.body.addEventListener("mouseup", bodyMouseUpHandler);
  document.body.addEventListener("mousemove", bodyMouseMoveHandler);
  document.body.addEventListener("mouseleave", bodyMouseLeaveHandler);

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
    if (e.key === 'appsSlotsCount' || e.key === 'climateSlotsCount' ||
        e.key === 'setting_appsSlotsCount' || e.key === 'setting_climateSlotsCount') {
      setTimeout(refreshOemFeedbackOnSlots, 100);
    }
    if (e.key === 'setting_layoutProfile') {
      const stored = storage.load('setting_layoutProfile');
      if (modules.layoutProfile && typeof modules.layoutProfile.apply === 'function') {
        modules.layoutProfile.apply(stored);
      }
    }
  });

  document.addEventListener("contextmenu", e => e.preventDefault());
  if (typeof android.onJsReady === 'function') android.onJsReady();

  setTimeout(() => {
    if (modules.navigation && typeof modules.navigation.applyThemeNow === 'function') {
      modules.navigation.applyThemeNow();
    }
  }, 150);

  setTimeout(checkDashboardFit, 1000);
  window.addEventListener('resize', () => {
    clearTimeout(window._fitTimer);
    window._fitTimer = setTimeout(checkDashboardFit, 500);
  });
}

/**
 * [FIX] Единая точка запуска онбординга.
 * Логика:
 * 1. Если выбор ориентации ещё не был сделан — показываем orientationPicker.
 *    Ждём, пока пользователь определится. Онбординг запустится:
 *    - если нажал "Пройти обучение" (pendingOnboarding = true),
 *    - если нажал "Продолжить" и онбординг не завершён ранее.
 * 2. Если выбор ориентации уже сделан — запускаем onboarding.init()
 *    один раз, если он не завершён.
 *
 * [FIX] setInterval(250) сохраняется в onboardingWaitInterval и снимается
 *       в cleanupIntervals(). Добавлен safety-timeout 30 с: если
 *       orientationPicker так и не разрешился — интервал снимается,
 *       онбординг запускается по общему правилу.
 */
function scheduleOnboarding() {
  const hasOverlay = !!document.getElementById('onboardingOverlay');
  if (hasOverlay) return;

  if (modules.orientationPicker && !modules.orientationPicker.isResolved()) {
    modules.orientationPicker.show();

    // [FIX] Снимаем старые таймеры перед новыми.
    if (onboardingWaitInterval) { clearInterval(onboardingWaitInterval); onboardingWaitInterval = null; }
    if (onboardingWaitTimeout) { clearTimeout(onboardingWaitTimeout); onboardingWaitTimeout = null; }

    onboardingWaitInterval = setInterval(() => {
      if (!modules.orientationPicker.isResolved()) return;
      clearInterval(onboardingWaitInterval);
      onboardingWaitInterval = null;
      if (onboardingWaitTimeout) { clearTimeout(onboardingWaitTimeout); onboardingWaitTimeout = null; }

      const wantOnboarding = modules.orientationPicker.consumePendingOnboarding();
      if (!wantOnboarding && storage.load('onboarding_completed')) return;
      setTimeout(() => {
        if (modules.onboarding && typeof modules.onboarding.init === 'function') {
          modules.onboarding.init();
        }
      }, 350);
    }, 250);

    // [FIX] Safety-timeout: если по какой-то причине orientationPicker не
    // разрешился за 30 с — снимаем интервал и запускаем онбординг по общему правилу.
    onboardingWaitTimeout = setTimeout(() => {
      if (onboardingWaitInterval) {
        clearInterval(onboardingWaitInterval);
        onboardingWaitInterval = null;
      }
      onboardingWaitTimeout = null;
      if (!storage.load('onboarding_completed')) {
        if (modules.onboarding && typeof modules.onboarding.init === 'function') {
          modules.onboarding.init();
        }
      }
    }, 30000);

    return;
  }

  if (!storage.load('onboarding_completed')) {
    setTimeout(() => {
      if (modules.onboarding && typeof modules.onboarding.init === 'function') {
        modules.onboarding.init();
      }
    }, 1000);
  }
}

async function start() {
  try {
    if (modules.layoutProfile && typeof modules.layoutProfile.init === 'function') {
      modules.layoutProfile.init();
    }

    if (modules.climate) await modules.climate.init();
    await initUI();

    scheduleOnboarding();
  } catch (e) {
    console.error('[Main] Ошибка инициализации:', e);
  } finally {
    setTimeout(onAllModulesReady, 500);
  }
}

document.addEventListener("DOMContentLoaded", start);