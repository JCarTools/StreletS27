/**********************************************
 * Модуль: Обои (статические, авто, видео)
 * Исправлено: видео появляется только после реального старта воспроизведения
 **********************************************/

modules.wallpaper = (function() {
  const staticWallpapers = Array.from(document.querySelectorAll('.wallpaper-item')).map(item => item.dataset.src);
  let customWallpaperIndex = 0;
  const CACHE_KEY = 'wallpaper_cache', CACHE_INDEX_KEY = 'wallpaper_cache_index', MAX_CACHE_SIZE = 10;
  const IMAGE_SOURCES = [
    { name: 'Picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
    { name: 'LoremFlickr', url: (w, h) => `https://loremflickr.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
    { name: 'PlaceKitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` },
    { name: 'JCARTools', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` }
  ];
  let preloadImage = null, preloadAbortController = null;

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
    // Изначально скрыто и без прозрачности – появится только после playing
    videoElement.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:-1; pointer-events:none; display:none;';
    document.body.appendChild(videoElement);
  }

  let videoWatchdogInterval = null;
  let videoReadyToShow = false;

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

  function getRandomSource() { return IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)]; }
  
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
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.style.display = 'none';
      videoElement.style.opacity = '';
      videoElement.removeEventListener('ended', handleVideoEnded);
      // удаляем временных слушателей
      const newVideo = videoElement.cloneNode(true);
      videoElement.parentNode.replaceChild(newVideo, videoElement);
      videoElement = newVideo;
      // перепривязываем стили
      videoElement.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:-1; pointer-events:none; display:none;';
    }
    document.body.classList.remove('has-video-background');
  }

  function setVideoBackground(fileOrUrl) {
    const url = typeof fileOrUrl === 'string' ? encodeURI(fileOrUrl) : URL.createObjectURL(fileOrUrl);
    clearVideoBackground(); // полностью пересоздаём video элемент
    
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
      // небольшая задержка для apply styles
      setTimeout(() => {
        videoElement.style.transition = 'opacity 0.6s ease';
        videoElement.style.opacity = '1';
      }, 20);
    };
    
    const onPlaying = () => {
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('canplay', onPlaying);
      showVideo();
    };
    
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onPlaying);
    // запасной вариант: если видео уже готово
    if (videoElement.readyState >= 2) {
      onPlaying();
    }
    
    const startPlay = () => {
      videoElement.play().catch(e => warn('Video play failed:', e));
    };
    
    // Запускаем воспроизведение
    startPlay();
    
    setupVideoLoop();
    document.body.style.backgroundImage = 'none';
    document.body.classList.add('has-video-background');
    document.body.classList.remove('off-mode');
    storage.save('wallpaperMode', 'video');
    storage.save('wallpaperVideo', url);
  }

  async function setAuto(showLoader = true) {
    clearVideoBackground();
    const w = window.innerWidth, h = window.innerHeight;
    if (preloadImage) {
      applyWallpaper(preloadImage);
      addToCache(preloadImage);
      preloadImage = null;
      preloadNextWallpaper();
      return;
    }
    const cached = getNextFromCache();
    if (cached) {
      applyWallpaper(cached);
      preloadNextWallpaper();
      return;
    }
    if (showLoader) loader.show();
    try {
      const source = getRandomSource();
      const base64 = await fetchImage(source.url(w, h));
      applyWallpaper(base64);
      addToCache(base64);
      resetCacheIndex();
      preloadNextWallpaper();
    } catch (e) {
      if (showLoader) showToast('Не удалось загрузить обои', 3000);
      try {
        const fb = IMAGE_SOURCES.find(s => s.name === 'Picsum');
        const base64 = await fetchImage(fb.url(w, h));
        applyWallpaper(base64);
        addToCache(base64);
        resetCacheIndex();
      } catch { setCustomByIndex(0); }
    } finally { if (showLoader) loader.hide(); }
  }

  function setOff() {
    clearVideoBackground();
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "#0F0D13";
    document.body.classList.add('off-mode');
    const tw = document.querySelector('.widget_time');
    if (tw) { tw.classList.add('glowing'); setTimeout(() => tw.classList.remove('glowing'), 5000); }
  }

  function setCustomByIndex(index) {
    clearVideoBackground();
    if (!staticWallpapers.length) return;
    const src = staticWallpapers[index % staticWallpapers.length];
    document.body.style.backgroundImage = `url(${src})`;
    document.body.classList.remove('off-mode', 'has-video-background');
    storage.save('wallpaperMode', 'custom');
    storage.save('wallpaperCustom', src);
    storage.save('customWallpaperIndex', index);
    customWallpaperIndex = index;
  }

  function nextCustom() {
    if (storage.load('wallpaperMode') !== 'custom') return;
    let idx = storage.load('customWallpaperIndex') || 0;
    if (idx === -1) return;
    setCustomByIndex((idx + 1) % staticWallpapers.length);
  }

  function restore() {
    const mode = storage.load('wallpaperMode');
    if (mode === 'custom') {
      clearVideoBackground();
      const bg = storage.load('wallpaperCustom'), idx = storage.load('customWallpaperIndex');
      if (bg) document.body.style.backgroundImage = `url(${bg})`;
      if (idx !== undefined) customWallpaperIndex = idx;
      document.body.classList.remove('off-mode');
    } else if (mode === 'auto') {
      clearVideoBackground();
      const saved = storage.load('wallpaperImage');
      if (saved) { applyWallpaper(saved); preloadNextWallpaper(); }
      else setAuto(false);
    } else if (mode === 'video') {
      const savedVideo = storage.load('wallpaperVideo');
      if (savedVideo) {
        setVideoBackground(savedVideo);
      } else { setCustomByIndex(0); }
    } else { setTimeout(() => setCustomByIndex(0), 100); }
  }

  function toggleOffMode() {
    if (document.body.classList.contains('off-mode')) {
      const savedMode = storage.load('wallpaperMode') || 'custom';
      if (savedMode === 'auto') setAuto(true);
      else if (savedMode === 'custom') setCustomByIndex(storage.load('customWallpaperIndex') || 0);
      else if (savedMode === 'video') {
        const url = storage.load('wallpaperVideo');
        if (url) setVideoBackground(url);
      }
      document.body.classList.remove('off-mode');
    } else { setOff(); }
  }

  function toggleAutoMode() {
    const currentMode = storage.load('wallpaperMode') || 'custom';
    if (currentMode === 'auto') {
      const idx = storage.load('customWallpaperIndex') || 0;
      setCustomByIndex(idx);
    } else { setAuto(true); }
    const btn = document.getElementById('btnWallpaper');
    if (btn) btn.classList.toggle('active', storage.load('wallpaperMode') === 'auto');
  }

  function initAutoMode() { if (storage.load('wallpaperMode') === 'auto') preloadNextWallpaper(); }

  return { setOff, setAuto, setCustomByIndex, nextCustom, restore, toggleOffMode, toggleAutoMode, initAutoMode, setVideoBackground };
})();