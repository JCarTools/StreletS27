/**********************************************
 * My Black Window - Dashboard
 * Точка входа: инициализация всех модулей
 **********************************************/

window.onAndroidEvent = function(type, data) {
  if (type === "musicInfo") modules.player.updateMusicInfo(data);
  else if (type === "climateState") modules.climate.updateState(data);
};

// Функция для скрытия/показа виджетов (только в видео-режиме)
function toggleWidgetsVisibility() {
  if (modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
    document.body.classList.toggle('widgets-hidden');
  }
}

// Функция для смены обоев в статичном/авто-режиме
function changeWallpaper() {
  const mode = storage.load("wallpaperMode");
  if (mode === "auto") {
    modules.wallpaper.setAuto(true);
  } else if (mode === "custom") {
    modules.wallpaper.nextCustom();
  }
}

function initUI() {
  modules.wallpaper.restore();
  modules.wallpaper.initAutoMode();
  modules.clock.start();
  modules.draggableNetwork.init();
  modules.brandEditor.init();
  modules.player.init();
  modules.apps.init();
  modules.network.init();

  document.getElementById("btnClose")?.addEventListener("click", ()=> android.onClose());
  document.getElementById("btnSettings")?.addEventListener("click", ()=> android.onSettings());

  const btnWallpaper = document.getElementById("btnWallpaper");
  btnWallpaper?.addEventListener("click", () => { modules.wallpaper.toggleAutoMode(); });
  if (storage.load("wallpaperMode") === "auto") { btnWallpaper?.classList.add("active"); }

  // Единый обработчик клика по body
  document.body.addEventListener("click", (e) => {
    // Если клик по интерактивным элементам дашборда – ничего не делаем
    const dashboard = document.querySelector('.dashboard');
    if (dashboard && dashboard.contains(e.target)) return;
    
    // Проверяем, активен ли видео-режим
    if (modules.wallpaper.isVideoMode && modules.wallpaper.isVideoMode()) {
      toggleWidgetsVisibility();
    } else {
      changeWallpaper();
    }
  });

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", ()=>sidebar.classList.add("open"));
  document.getElementById("closeSidebar")?.addEventListener("click", ()=>sidebar.classList.remove("open"));
  document.querySelectorAll(".wallpaper-item").forEach((it,i)=>{
    it.addEventListener("click", ()=>{ modules.wallpaper.setCustomByIndex(i); sidebar.classList.remove("open"); });
  });

  document.getElementById('presetVideoKamin')?.addEventListener('click', () => {
    modules.wallpaper.setVideoBackground('images/kaminHD.mp4');
    sidebar.classList.remove('open');
  });

  document.querySelector('.widget_time')?.addEventListener('click', () => { modules.wallpaper.toggleOffMode(); });

  // Включаем OEM-эффекты для всех интерактивных элементов
  attachOemTouchFeedback(".widget_buttons, #btnNetwork, #btnClose, .widget_player__btn, .close-btn, .drawer-close, .climate-off-all, .app_slot, .climate_slot");

  document.addEventListener("contextmenu", e=>e.preventDefault());
  android.onJsReady();
}

async function start() {
  await modules.climate.init();
  initUI();
}

document.addEventListener("DOMContentLoaded", start);