/**********************************************
 * Модуль: Обои — видео и off-mode
 * Часть 2 из 3. Публичный API собирается в wallpaper-main.js.
 * [FIX] setVideoBackground: снимаем старые обработчики playing/canplay перед добавлением новых (утечка).
 * [FIX] clearVideoBackground: полный сброс обработчиков и watchdog.
 * [FIX] updateOffModeWidgetVisibility: добавлено скрытие виджета погоды и обёрток (компас).
 **********************************************/

modules.wallpaperVideo = (function() {
  const C = modules.wallpaperCore;

  let videoElement = document.getElementById('video-background');
  if (!videoElement) {
    videoElement = document.createElement('video');
    videoElement.id = 'video-background';
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.preload = 'auto';
    videoElement.controls = false;
    videoElement.disablePictureInPicture = true;
    videoElement.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:-1; pointer-events:none; display:none;';
    document.body.appendChild(videoElement);
  }

  let currentVideoObjectUrl = null;
  let videoWatchdogInterval = null;
  let isVideoModeActive = false;
  let glowTimeout = null;

  let activePlayingHandlers = null;

  function stopWatchdog() {
    if (videoWatchdogInterval) { clearInterval(videoWatchdogInterval); videoWatchdogInterval = null; }
  }

  function startWatchdog() {
    stopWatchdog();
    videoWatchdogInterval = setInterval(() => {
      if (videoElement && videoElement.style.display === 'block' && videoElement.paused && videoElement.currentTime > 0) {
        videoElement.play().catch(e => warn('Watchdog play failed:', e));
      }
    }, 1000);
  }

  function setupVideoLoop() {
    videoElement.removeEventListener('ended', handleVideoEnded);
    videoElement.addEventListener('ended', handleVideoEnded);
    startWatchdog();
  }

  function handleVideoEnded() {
    videoElement.currentTime = 0;
    videoElement.play().catch(e => warn('Video replay failed:', e));
  }

  function clearActivePlayingHandlers() {
    if (!activePlayingHandlers) return;
    videoElement.removeEventListener('playing', activePlayingHandlers.onPlaying);
    videoElement.removeEventListener('canplay', activePlayingHandlers.onPlaying);
    activePlayingHandlers = null;
  }

  function clearVideoBackground() {
    stopWatchdog();
    isVideoModeActive = false;
    if (videoElement) {
      try { videoElement.pause(); } catch (e) {}
      videoElement.src = '';
      videoElement.style.display = 'none';
      videoElement.style.opacity = '';
      videoElement.removeEventListener('ended', handleVideoEnded);
      clearActivePlayingHandlers();
    }
    if (currentVideoObjectUrl) {
      try { URL.revokeObjectURL(currentVideoObjectUrl); } catch (e) {}
      currentVideoObjectUrl = null;
    }
    document.body.classList.remove('has-video-background');
  }

  function setVideoBackground(source) {
    let url;
    let createdObjectUrl = false;
    let persistentSource = null;

    if (source && typeof source === 'object' && source.preset) {
      if (source.preset === 'kamin') {
        url = C.PRESET_KAMIN_SRC;
        persistentSource = C.PRESET_KAMIN;
      } else {
        url = '';
      }
    } else if (source && typeof source === 'object' && source.file instanceof Blob) {
      url = URL.createObjectURL(source.file);
      createdObjectUrl = true;
      persistentSource = null;
    } else if (typeof source === 'string') {
      url = source;
      if (/^https?:\/\//i.test(source) || /^images\//i.test(source) || /^\.?\//.test(source)) {
        persistentSource = source;
      }
    } else {
      url = '';
    }

    if (!url) return;

    clearVideoBackground();

    if (createdObjectUrl) {
      currentVideoObjectUrl = url;
    }

    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.preload = 'auto';
    videoElement.controls = false;
    videoElement.disablePictureInPicture = true;
    videoElement.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:-1; pointer-events:none; display:none;';
    videoElement.src = url;

    const showVideo = () => {
      videoElement.style.display = 'block';
      videoElement.style.opacity = '0';
      setTimeout(() => {
        videoElement.style.transition = 'opacity 0.6s ease';
        videoElement.style.opacity = '1';
      }, 20);
    };
    const onPlaying = () => {
      clearActivePlayingHandlers();
      isVideoModeActive = true;
      showVideo();
    };

    activePlayingHandlers = { onPlaying };
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onPlaying);
    if (videoElement.readyState >= 2) onPlaying();

    videoElement.play().catch(e => warn('Video play failed:', e));
    setupVideoLoop();
    document.body.style.backgroundImage = 'none';
    document.body.classList.add('has-video-background');
    document.body.classList.remove('off-mode');
    storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'video');
    if (persistentSource) {
      storage.save(C.STORAGE_KEY_VIDEO_SOURCE, persistentSource);
      storage.save(C.STORAGE_KEY_VIDEO_PRESET, persistentSource === C.PRESET_KAMIN ? 'kamin' : null);
    } else {
      storage.remove(C.STORAGE_KEY_VIDEO_SOURCE);
      storage.remove(C.STORAGE_KEY_VIDEO_PRESET);
    }
  }

  function isVideoMode() { return isVideoModeActive; }

  function restoreVideoFromStorage() {
    const preset = storage.load(C.STORAGE_KEY_VIDEO_PRESET);
    if (preset === 'kamin') {
      setVideoBackground({ preset: 'kamin' });
      return true;
    }
    const source = storage.load(C.STORAGE_KEY_VIDEO_SOURCE);
    if (typeof source === 'string' && source && !/^blob:/i.test(source)) {
      setVideoBackground(source);
      return true;
    }
    storage.remove(C.STORAGE_KEY_VIDEO_SOURCE);
    storage.remove(C.STORAGE_KEY_VIDEO_PRESET);
    storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'custom');
    return false;
  }

  function updateOffModeWidgetVisibility() {
    if (!document.body.classList.contains('off-mode')) return;

    const hideClimate = storage.load('setting_offModeHideClimate') !== false;
    const hideApps = storage.load('setting_offModeHideApps') !== false;
    const hidePlayer = storage.load('setting_offModeHidePlayer') !== false;
    const hideNetwork = storage.load('setting_offModeHideNetwork') !== false;
    const hideMiniMap = storage.load('setting_offModeHideMiniMap') !== false;
    const hideRightButtons = storage.load('setting_offModeHideRightButtons') !== false;
    const hideWeather = storage.load('setting_offModeHideWeather') !== false;
    const hideCompass = storage.load('setting_offModeHideCompass') !== false;

    const climateWidget = document.querySelector('.widget_climate');
    const appsWidget = document.querySelector('.widget_apps');
    const playerWidget = document.querySelector('.widget_player');
    const networkWrapper = document.getElementById('networkWidgetWrapper');
    const miniMapWidget = document.getElementById('widgetNavigation');
    const rightButtons = document.querySelector('.right-buttons');
    const weatherWidget = document.getElementById('widgetWeather');
    const compassWidget = document.getElementById('widgetCompass');

    if (climateWidget) climateWidget.classList.toggle('off-mode-hidden', hideClimate);
    if (appsWidget) appsWidget.classList.toggle('off-mode-hidden', hideApps);
    if (playerWidget) playerWidget.classList.toggle('off-mode-hidden', hidePlayer);
    if (networkWrapper) networkWrapper.classList.toggle('off-mode-hidden', hideNetwork);
    if (miniMapWidget) miniMapWidget.classList.toggle('off-mode-hidden', hideMiniMap);
    if (rightButtons) rightButtons.classList.toggle('off-mode-hidden', hideRightButtons);
    if (weatherWidget) weatherWidget.classList.toggle('off-mode-hidden', hideWeather);
    if (compassWidget) compassWidget.classList.toggle('off-mode-hidden', hideCompass);
  }

  function showOffModeHint() {
    const existing = document.querySelector('.off-mode-hint');
    if (existing) existing.remove();
    const hint = document.createElement('div');
    hint.className = 'off-mode-hint';
    hint.textContent = 'Тапните по экрану, чтобы выйти';
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 6200);
  }

  function setOff() {
    clearVideoBackground();
    if (modules.wallpaperMain && modules.wallpaperMain.stopAllTimers) {
      modules.wallpaperMain.stopAllTimers();
    }
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#0F0D13';
    document.body.classList.add('off-mode');
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);

    const twPre = document.querySelector('.widget_time');
    if (twPre) twPre.classList.remove('animation-done');
    document.body.classList.remove('returning-from-off');

    updateOffModeWidgetVisibility();
    showOffModeHint();

    if (glowTimeout) clearTimeout(glowTimeout);
    const tw = document.querySelector('.widget_time');
    if (tw) {
      tw.classList.add('glowing');
      glowTimeout = setTimeout(() => {
        tw.classList.remove('glowing');
        glowTimeout = null;
      }, 5000);
    }
  }

  function exitOffMode() {
    if (!document.body.classList.contains('off-mode')) return;
    const savedMode = storage.load(C.STORAGE_KEY_WALLPAPER_MODE) || 'custom';
    const main = modules.wallpaperMain;

    if (savedMode === 'auto') {
      if (main) main.setAuto(false);
    } else if (savedMode === 'custom') {
      const idx = storage.load('customWallpaperIndex') || 0;
      if (main) main.setCustomByIndex(idx);
    } else if (savedMode === 'video') {
      restoreVideoFromStorage();
    } else {
      if (main) main.setCustomByIndex(0);
    }

    document.body.classList.remove('off-mode');
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);

    const hint = document.querySelector('.off-mode-hint');
    if (hint) hint.remove();

    document.querySelectorAll('.widget_climate, .widget_apps, .widget_player, .right-buttons, #networkWidgetWrapper, #widgetNavigation, #widgetWeather, #widgetCompass')
      .forEach(w => w.classList.remove('off-mode-hidden'));

    const tw = document.querySelector('.widget_time');
    if (tw) {
      tw.classList.remove('animation-done');
      document.body.classList.add('returning-from-off');
      const onAnimEnd = (e) => {
        if (e.animationName === 'moonSet') {
          document.body.classList.remove('returning-from-off');
          tw.classList.add('animation-done');
          tw.removeEventListener('animationend', onAnimEnd);
        }
      };
      tw.addEventListener('animationend', onAnimEnd);
      setTimeout(() => {
        if (document.body.classList.contains('returning-from-off')) {
          document.body.classList.remove('returning-from-off');
          tw.removeEventListener('animationend', onAnimEnd);
          tw.classList.add('animation-done');
        }
      }, 1500);
    }
  }

  function toggleOffMode() {
    if (document.body.classList.contains('off-mode')) exitOffMode();
    else setOff();
  }

  return {
    setVideoBackground,
    clearVideoBackground,
    isVideoMode,
    restoreVideoFromStorage,
    updateOffModeWidgetVisibility,
    setOff,
    exitOffMode,
    toggleOffMode,
    showOffModeHint
  };
})();