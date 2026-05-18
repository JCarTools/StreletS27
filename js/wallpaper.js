/**********************************************
 * Модуль: Обои (статические, авто, видео)
 * Исправлено: off-mode – виджеты скрыты, часы видны
 * Одиночный клик по экрану в off-mode возвращает в обычный режим
 **********************************************/

modules.wallpaper = (function() {
  const staticWallpapers = Array.from(document.querySelectorAll('.wallpaper-item')).map(item => item.dataset.src);
  let customWallpaperIndex = 0;
  const CACHE_KEY = 'wallpaper_cache', CACHE_INDEX_KEY = 'wallpaper_cache_index', MAX_CACHE_SIZE = 10;
  
  // Список доступных серверов
  const IMAGE_SOURCES = [
    { name: 'Picsum', id: 'picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
    { name: 'Picsum Proxy (Россия)', id: 'picsum_proxy', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` },
    { name: 'LoremFlickr', id: 'loremflickr', url: (w, h) => `https://loremflickr.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
    { name: 'PlaceKitten', id: 'placekitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` },
    { name: 'LoremFlickr CN (Россия)', id: 'loremflickrcn', url: (w, h) => `https://loremflickrcn.com/${w}/${h}/landscape?random&lock=${Date.now()}` }
  ];
  
  let activeServers = [];
  let preloadImage = null, preloadAbortController = null;
  let isLoading = false;
  let autoTimer = null;

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

  let videoWatchdogInterval = null;
  let isVideoModeActive = false;

  function stopWatchdog() { if (videoWatchdogInterval) { clearInterval(videoWatchdogInterval); videoWatchdogInterval = null; } }
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

  function updateServers(selectedIds) {
    if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
      activeServers = IMAGE_SOURCES.filter(s => selectedIds.includes(s.id));
    } else {
      activeServers = [...IMAGE_SOURCES];
    }
    if (activeServers.length === 0) activeServers = [...IMAGE_SOURCES];
  }
  
  function getRandomSource() {
    if (activeServers.length === 0) updateServers(storage.load('wallpaperServers'));
    return activeServers[Math.floor(Math.random() * activeServers.length)];
  }
  
  async function fetchImage(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size < 10000) throw new Error('Image too small');
      return new Promise(r => { const fr = new FileReader(); fr.onloadend = () => r(fr.result); fr.readAsDataURL(blob); });
    } finally { clearTimeout(timeout); }
  }
  
  function getCache() { return storage.load(CACHE_KEY) || []; }
  function saveCache(cache) {
    const unique = [...new Set(cache)];
    if (unique.length > MAX_CACHE_SIZE) unique.length = MAX_CACHE_SIZE;
    storage.save(CACHE_KEY, unique);
  }
  function addToCache(base64) {
    const cache = getCache().filter(item => item !== base64);
    cache.unshift(base64);
    saveCache(cache);
  }
  function getNextFromCache() {
    const cache = getCache();
    if (!cache.length) return null;
    let index = storage.load(CACHE_INDEX_KEY) || 0;
    if (index >= cache.length) index = 0;
    const img = cache[index];
    storage.save(CACHE_INDEX_KEY, (index + 1) % cache.length);
    return img;
  }
  function resetCacheIndex() { storage.save(CACHE_INDEX_KEY, 0); }
  
  async function preloadNextWallpaper() {
    if (preloadAbortController) preloadAbortController.abort();
    preloadAbortController = new AbortController();
    const w = window.innerWidth, h = window.innerHeight;
    const source = getRandomSource();
    try {
      const base64 = await fetchImage(source.url(w, h), 10000);
      preloadImage = base64;
      addToCache(base64);
      resetCacheIndex();
    } catch (e) { preloadImage = null; }
    finally { preloadAbortController = null; }
  }
  
  function applyWallpaper(base64) {
    clearVideoBackground();
    document.body.style.backgroundImage = `url("${base64}")`;
    document.body.classList.remove('off-mode');
    storage.save('wallpaperMode', 'auto');
    storage.save('wallpaperImage', base64);
  }

  function clearVideoBackground() {
    stopWatchdog();
    isVideoModeActive = false;
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.style.display = 'none';
      videoElement.style.opacity = '';
      videoElement.removeEventListener('ended', handleVideoEnded);
    }
    document.body.classList.remove('has-video-background');
  }

  function setVideoBackground(fileOrUrl) {
    const url = typeof fileOrUrl === 'string' ? encodeURI(fileOrUrl) : URL.createObjectURL(fileOrUrl);
    clearVideoBackground();
    stopAutoTimer();
    
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
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('canplay', onPlaying);
      isVideoModeActive = true;
      showVideo();
    };
    
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onPlaying);
    if (videoElement.readyState >= 2) onPlaying();
    
    const startPlay = () => {
      videoElement.play().catch(e => warn('Video play failed:', e));
    };
    startPlay();
    setupVideoLoop();
    document.body.style.backgroundImage = 'none';
    document.body.classList.add('has-video-background');
    document.body.classList.remove('off-mode');
    storage.save('wallpaperMode', 'video');
    storage.save('wallpaperVideo', url);
  }

  function isVideoMode() {
    return isVideoModeActive;
  }

  function startAutoTimer() {
    stopAutoTimer();
    const intervalText = storage.load('autoWallpaperInterval') || '5 минут';
    let intervalMs = 300000;
    switch(intervalText) {
      case '30 секунд': intervalMs = 30000; break;
      case '1 минута': intervalMs = 60000; break;
      case '2 минуты': intervalMs = 120000; break;
      case '5 минут': intervalMs = 300000; break;
      case '10 минут': intervalMs = 600000; break;
      case '30 минут': intervalMs = 1800000; break;
      case '1 час': intervalMs = 3600000; break;
    }
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (storage.load('wallpaperMode') === 'auto') {
        setAuto(true);
      }
    }, intervalMs);
  }
  
  function stopAutoTimer() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }
  
  async function setAuto(showLoader = true) {
    if (isLoading) return;
    isLoading = true;
    
    clearVideoBackground();
    startAutoTimer();
    
    const w = window.innerWidth, h = window.innerHeight;
    const savedServers = storage.load('wallpaperServers');
    updateServers(savedServers);
    
    const wasHidden = document.body.classList.contains('widgets-hidden');
    
    if (preloadImage) {
      applyWallpaper(preloadImage);
      addToCache(preloadImage);
      preloadImage = null;
      preloadNextWallpaper();
    } else {
      const cached = getNextFromCache();
      if (cached) {
        applyWallpaper(cached);
        preloadNextWallpaper();
      } else {
        if (showLoader) loader.show();
        let success = false;
        for (const source of activeServers) {
          try {
            const base64 = await fetchImage(source.url(w, h));
            applyWallpaper(base64);
            addToCache(base64);
            resetCacheIndex();
            preloadNextWallpaper();
            success = true;
            break;
          } catch (e) {
            console.warn(`[Wallpaper] Ошибка загрузки с ${source.name}:`, e);
          }
        }
        if (!success) {
          try {
            const fb = activeServers[0] || IMAGE_SOURCES[0];
            const base64 = await fetchImage(fb.url(w, h));
            applyWallpaper(base64);
            addToCache(base64);
            resetCacheIndex();
          } catch { 
            setCustomByIndex(0); 
          }
        }
        if (showLoader) loader.hide();
      }
    }
    
    if (wasHidden) {
      document.body.classList.add('widgets-hidden');
    } else {
      document.body.classList.remove('widgets-hidden');
    }
    
    isLoading = false;
  }

  // Обновление видимости виджетов в OFF-mode согласно настройкам
  function updateOffModeWidgetVisibility() {
    if (!document.body.classList.contains('off-mode')) return;
    
    const hideClimate = storage.load('setting_offModeHideClimate') !== false;
    const hideApps = storage.load('setting_offModeHideApps') !== false;
    const hidePlayer = storage.load('setting_offModeHidePlayer') !== false;
    const hideRightButtons = storage.load('setting_offModeHideRightButtons') !== false;
    
    const climateWidget = document.querySelector('.widget_climate');
    const appsWidget = document.querySelector('.widget_apps');
    const playerWidget = document.querySelector('.widget_player');
    const rightButtons = document.querySelector('.right-buttons');
    
    if (climateWidget) {
      if (hideClimate) climateWidget.classList.add('off-mode-hidden');
      else climateWidget.classList.remove('off-mode-hidden');
    }
    if (appsWidget) {
      if (hideApps) appsWidget.classList.add('off-mode-hidden');
      else appsWidget.classList.remove('off-mode-hidden');
    }
    if (playerWidget) {
      if (hidePlayer) playerWidget.classList.add('off-mode-hidden');
      else playerWidget.classList.remove('off-mode-hidden');
    }
    if (rightButtons) {
      if (hideRightButtons) rightButtons.classList.add('off-mode-hidden');
      else rightButtons.classList.remove('off-mode-hidden');
    }
  }

  function setOff() {
    clearVideoBackground();
    stopAutoTimer();
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "#0F0D13";
    document.body.classList.add('off-mode');
    // В off-mode dashboard больше не скрывается целиком – скрываем только выбранные виджеты
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
    
    // Применяем настройки видимости виджетов
    updateOffModeWidgetVisibility();
    
    const tw = document.querySelector('.widget_time');
    if (tw) { tw.classList.add('glowing'); setTimeout(() => tw.classList.remove('glowing'), 5000); }
  }

  // Выход из off-mode и показ всех виджетов
  function exitOffMode() {
    if (!document.body.classList.contains('off-mode')) return;
    
    const savedMode = storage.load('wallpaperMode') || 'custom';
    if (savedMode === 'auto') {
      setAuto(true);
    } else if (savedMode === 'custom') {
      const idx = storage.load('customWallpaperIndex') || 0;
      setCustomByIndex(idx);
    } else if (savedMode === 'video') {
      const url = storage.load('wallpaperVideo');
      if (url) setVideoBackground(url);
    } else {
      setCustomByIndex(0);
    }
    
    document.body.classList.remove('off-mode');
    // При выходе из off-mode показываем все виджеты
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);
    
    // Убираем классы скрытия со всех виджетов
    const widgetsToReset = document.querySelectorAll('.widget_climate, .widget_apps, .widget_player, .right-buttons');
    widgetsToReset.forEach(w => w.classList.remove('off-mode-hidden'));
    
    setTimeout(() => restoreButtonsPosition(), 100);
  }

  function setCustomByIndex(index) {
    clearVideoBackground();
    stopAutoTimer();
    if (!staticWallpapers.length) return;
    const safeIndex = Math.max(0, Math.min(index, staticWallpapers.length - 1));
    customWallpaperIndex = safeIndex;
    const src = staticWallpapers[safeIndex];
    document.body.style.backgroundImage = `url(${src})`;
    document.body.classList.remove('off-mode', 'has-video-background');
    storage.save('wallpaperMode', 'custom');
    storage.save('wallpaperCustom', src);
    storage.save('customWallpaperIndex', safeIndex);
  }

  function nextCustom() {
    const currentMode = storage.load('wallpaperMode');
    if (currentMode !== 'custom') return;
    let idx = storage.load('customWallpaperIndex');
    if (idx === null || idx === undefined) {
      const currentBg = document.body.style.backgroundImage;
      if (currentBg && currentBg !== 'none') {
        const match = currentBg.match(/url\("?(.+?)"?\)/);
        if (match && match[1]) {
          const foundIndex = staticWallpapers.findIndex(src => match[1].includes(src.replace(/^.*[\\\/]/, '')));
          if (foundIndex !== -1) idx = foundIndex;
        }
      }
      if (idx === null || idx === undefined) idx = customWallpaperIndex;
      if (idx === null || idx === undefined) idx = 0;
    }
    let nextIdx = (idx + 1) % staticWallpapers.length;
    setCustomByIndex(nextIdx);
  }

  function restore() {
    const mode = storage.load('wallpaperMode');
    const savedServers = storage.load('wallpaperServers');
    updateServers(savedServers);
    
    if (mode === 'custom') {
      clearVideoBackground();
      stopAutoTimer();
      let savedIdx = storage.load('customWallpaperIndex');
      const bg = storage.load('wallpaperCustom');
      if (savedIdx !== null && savedIdx !== undefined && savedIdx >= 0 && savedIdx < staticWallpapers.length) {
        customWallpaperIndex = savedIdx;
        const src = staticWallpapers[savedIdx];
        document.body.style.backgroundImage = `url(${src})`;
      } 
      else if (bg && bg !== 'none') {
        document.body.style.backgroundImage = `url(${bg})`;
        const foundIndex = staticWallpapers.findIndex(src => bg.includes(src.replace(/^.*[\\\/]/, '')));
        if (foundIndex !== -1) {
          customWallpaperIndex = foundIndex;
          storage.save('customWallpaperIndex', foundIndex);
        }
      } 
      else {
        setCustomByIndex(0);
      }
      document.body.classList.remove('off-mode');
    } else if (mode === 'auto') {
      clearVideoBackground();
      startAutoTimer();
      const saved = storage.load('wallpaperImage');
      if (saved) { 
        applyWallpaper(saved); 
        preloadNextWallpaper(); 
      } else { 
        setAuto(false); 
      }
    } else if (mode === 'video') {
      clearVideoBackground();
      stopAutoTimer();
      const savedVideo = storage.load('wallpaperVideo');
      if (savedVideo) {
        setVideoBackground(savedVideo);
      } else { 
        setCustomByIndex(0); 
      }
    } else { 
      setCustomByIndex(0); 
    }
    
    const wasHidden = storage.load('widgetsHiddenByUser');
    if (wasHidden) {
      document.body.classList.add('widgets-hidden');
    } else {
      document.body.classList.remove('widgets-hidden');
    }
  }

  function restoreButtonsPosition() {
    const savedPos = storage.load('networkPos');
    const networkBtn = document.getElementById('btnNetwork');
    if (savedPos && networkBtn) {
      networkBtn.style.left = savedPos.left + 'px';
      networkBtn.style.top = savedPos.top + 'px';
      networkBtn.style.right = 'auto';
      networkBtn.style.bottom = 'auto';
    }
  }

  function toggleOffMode() {
    if (document.body.classList.contains('off-mode')) {
      exitOffMode();
    } else { 
      setOff(); 
    }
  }

  function toggleAutoMode() {
    const currentMode = storage.load('wallpaperMode') || 'custom';
    if (currentMode === 'auto') {
      const idx = storage.load('customWallpaperIndex') || 0;
      setCustomByIndex(idx);
    } else { 
      setAuto(true); 
    }
    const btn = document.getElementById('btnWallpaper');
    if (btn) btn.classList.toggle('active', storage.load('wallpaperMode') === 'auto');
  }

  function initAutoMode() { 
    const savedServers = storage.load('wallpaperServers');
    updateServers(savedServers);
    if (storage.load('wallpaperMode') === 'auto') {
      startAutoTimer();
      preloadNextWallpaper();
    }
  }
  
  function restartAutoMode() {
    if (storage.load('wallpaperMode') === 'auto') {
      stopAutoTimer();
      startAutoTimer();
      setAuto(true);
    }
  }

  return { 
    setOff, setAuto, setCustomByIndex, nextCustom, restore, 
    toggleOffMode, toggleAutoMode, initAutoMode, setVideoBackground,
    isVideoMode, updateServers, restartAutoMode, restoreButtonsPosition,
    exitOffMode,
    updateOffModeWidgetVisibility  // экспортируем для вызова из настроек
  };
})();