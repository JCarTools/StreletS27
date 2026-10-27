/**********************************************
 * Модуль: Обои (статические, авто, видео)
 * [FIX] Поддержка пользовательского сервера (user_custom).
 * [FIX] Откат индекса при неудаче.
 * [FIX] Убран стандартный сервер Яндекса из дефолтных.
 * [NEW] Добавлены серверы: Любовь, Легкий стиль, Милые животные, Динамичные.
 **********************************************/

modules.wallpaper = (function() {
  const IDB_CUSTOM_WALLPAPERS_KEY = 'wallpaper_custom_list';
  const IDB_CUSTOM_WALLPAPER_DATA_PREFIX = 'wallpaper_custom_data_';
  const HIDDEN_BUILTINS_KEY = 'wallpaper_hidden_builtins';

  const builtinWallpapersMeta = Array.from(document.querySelectorAll('.wallpaper-item')).map((item, idx) => ({
    id: `builtin_${idx}`,
    name: (item.querySelector('img')?.alt) || `Обои ${idx + 1}`,
    src: item.dataset.src,
    isBuiltin: true
  }));

  let staticWallpapers = []; 
  let customWallpaperIndex = 0;
  const MAX_CACHE_SIZE = 10;
  const MAX_CACHE_BYTES = 24 * 1024 * 1024;
  const IDB_CACHE_KEY = 'wallpaper_cache';
  const IDB_CURRENT_KEY = 'wallpaper_current';
  const CACHE_INDEX_KEY = 'wallpaper_cache_index';

  // Кастомные серверы
  const FIXED_PEIZAZHI_URL = 'https://bingw.jasonzeng.dev/?resolution=1920x1080&index=random';
  const FIXED_CARS_URL = 'https://api.icofun.cn/API/360bz.php?n=10&type=image';
  const FIXED_LOVE_URL = 'https://api.icofun.cn/API/360bz.php?n=3&type=image';
  const FIXED_THEME_URL = 'https://api.icofun.cn/API/360bz.php?n=5&type=image';
  const FIXED_ANIMALS_URL = 'https://api.icofun.cn/API/360bz.php?n=8&type=image';
  const FIXED_DYNAMIC_URL = 'https://api.icofun.cn/API/360bz.php?n=13&type=image';

  // Резервные (если пользователь их выберет)
  const IMAGE_SOURCES = [
    { name: 'LoremFlickr CN (Россия)', id: 'loremflickrcn', url: (w, h) => `https://loremflickrcn.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
    { name: 'Picsum Proxy (Россия)', id: 'picsum_proxy', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` },
    { name: 'Picsum', id: 'picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
    { name: 'PlaceKitten', id: 'placekitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` }
  ];

  let activeServers = [];
  let preloadImage = null, preloadAbortController = null;
  let isLoading = false;
  let autoTimer = null;
  let builtinAutoTimer = null;
  let glowTimeout = null;

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

  function getCustomServerSource(key, name) {
    const raw = storage.load(`setting_${key}`);
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return {
      name: name,
      id: key.replace('wallpaperCustomServer', 'custom'),
      url: (w, h) => {
        let result = trimmed;
        result = result.replace(/\{w\}/g, String(w)).replace(/\{h\}/g, String(h));
        result = result.replace(/%w%/g, String(w)).replace(/%h%/g, String(h));
        if (!/[?&](t|lock|random)=/i.test(result)) {
          result += (result.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
        return result;
      }
    };
  }

  function getCustomServerSourceUser() {
    const raw = storage.load('setting_user_custom_url');
    const enabled = storage.load('setting_user_custom_enabled') === true;
    if (!enabled || !raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return {
      name: 'Свой сервер',
      id: 'user_custom',
      url: (w, h) => {
        let result = trimmed;
        result = result.replace(/\{w\}/g, String(w)).replace(/\{h\}/g, String(h));
        result = result.replace(/%w%/g, String(w)).replace(/%h%/g, String(h));
        if (!/[?&](t|lock|random)=/i.test(result)) {
          result += (result.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
        return result;
      }
    };
  }

  function isCustomEnabled(which) {
    return storage.load(`setting_${which}Enabled`) === true;
  }

  function updateServers(selectedIds) {
    const custom1  = isCustomEnabled('wallpaperCustomServer')  ? getCustomServerSource('wallpaperCustomServer', 'Пейзажи')  : null;
    const custom2 = isCustomEnabled('wallpaperCustomServer2') ? getCustomServerSource('wallpaperCustomServer2', 'Автомобили') : null;
    const custom3 = isCustomEnabled('wallpaperCustomServer3') ? getCustomServerSource('wallpaperCustomServer3', 'Любовь') : null;
    const custom4 = isCustomEnabled('wallpaperCustomServer4') ? getCustomServerSource('wallpaperCustomServer4', 'Легкий стиль') : null;
    const custom5 = isCustomEnabled('wallpaperCustomServer5') ? getCustomServerSource('wallpaperCustomServer5', 'Милые животные') : null;
    const custom6 = isCustomEnabled('wallpaperCustomServer6') ? getCustomServerSource('wallpaperCustomServer6', 'Динамичные') : null;
    const customUser = getCustomServerSourceUser();
    
    let built = [];

    if (custom1)  built.push(custom1);
    if (custom2) built.push(custom2);
    if (custom3) built.push(custom3);
    if (custom4) built.push(custom4);
    if (custom5) built.push(custom5);
    if (custom6) built.push(custom6);
    if (customUser) built.push(customUser);

    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      built = built.concat(IMAGE_SOURCES.filter(s => selectedIds.includes(s.id)));
    }

    activeServers = built;
  }

  function getRandomSource() {
    if (activeServers.length === 0) updateServers(storage.load('wallpaperServers'));
    if (activeServers.length === 0) return null;
    return activeServers[Math.floor(Math.random() * activeServers.length)];
  }

  async function fetchImage(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size < 10000) throw new Error('Image too small');
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.onerror = () => reject(new Error('FileReader error'));
        fr.readAsDataURL(blob);
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getCache() {
    const arr = await idbStore.get(IDB_CACHE_KEY);
    return Array.isArray(arr) ? arr : [];
  }
  async function saveCache(cache) {
    const unique = [...new Set(cache)];
    if (unique.length > MAX_CACHE_SIZE) unique.length = MAX_CACHE_SIZE;
    let total = 0;
    const limited = [];
    for (const item of unique) {
      const size = item ? item.length : 0;
      if (total + size > MAX_CACHE_BYTES) break;
      limited.push(item);
      total += size;
    }
    await idbStore.set(IDB_CACHE_KEY, limited);
  }
  async function addToCache(base64) {
    const cache = (await getCache()).filter(item => item !== base64);
    cache.unshift(base64);
    await saveCache(cache);
  }
  async function getNextFromCache() {
    const cache = await getCache();
    if (!cache.length) return null;
    let index = storage.load(CACHE_INDEX_KEY) || 0;
    if (index >= cache.length) index = 0;
    const img = cache[index];
    storage.save(CACHE_INDEX_KEY, (index + 1) % cache.length);
    return img;
  }
  function resetCacheIndex() { storage.save(CACHE_INDEX_KEY, 0); }

  async function clearCache() {
    try {
      await idbStore.remove(IDB_CACHE_KEY);
      await idbStore.remove(IDB_CURRENT_KEY);
      storage.remove(CACHE_INDEX_KEY);
      preloadImage = null;
      if (preloadAbortController) {
        try { preloadAbortController.abort(); } catch (e) { /* noop */ }
        preloadAbortController = null;
      }
    } catch (e) {}
  }

  function testImageViaImageElement(url, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let settled = false;
      const img = new Image();
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        img.src = '';
        resolve({ ok: false, reason: 'Таймаут (8с)', details: 'Image() не загрузился' });
      }, timeoutMs);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({ ok: true, reason: 'OK', details: `Image() ${img.naturalWidth}x${img.naturalHeight}` });
        } else {
          resolve({ ok: false, reason: 'Пустое изображение', details: '' });
        }
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'Image() error', details: 'Не удалось загрузить как <img>' });
      };
      img.src = url;
    });
  }

  async function testServerUrl(rawUrl) {
    const result = { ok: false, reason: '', details: '' };

    if (!rawUrl || typeof rawUrl !== 'string') {
      result.reason = 'URL не задан';
      return result;
    }
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      result.reason = 'URL пустой';
      return result;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      result.reason = 'URL должен начинаться с http:// или https://';
      return result;
    }

    let testUrl = trimmed
      .replace(/\{w\}/g, '1280').replace(/\{h\}/g, '720')
      .replace(/%w%/g, '1280').replace(/%h%/g, '720');
    if (!/[?&](t|lock|random)=/i.test(testUrl)) {
      testUrl += (testUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(testUrl, {
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!res.ok) {
        result.reason = `HTTP ${res.status}`;
        result.details = res.statusText || '';
        return result;
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        result.reason = `Не картинка (Content-Type: ${contentType || 'не указан'})`;
        return result;
      }

      const blob = await res.blob();
      if (blob.size < 1000) {
        result.reason = `Слишком маленький ответ (${blob.size} байт)`;
        return result;
      }

      result.ok = true;
      result.reason = 'OK';
      result.details = `${contentType}, ${Math.round(blob.size / 1024)} КБ`;
      return result;
    } catch (e) {
      const name = e && e.name ? e.name : '';
      const isCors = name === 'TypeError';
      if (name === 'AbortError') {
        result.reason = 'Таймаут (8с)';
        return result;
      }
      if (isCors) {
        const fallback = await testImageViaImageElement(testUrl, 8000);
        if (fallback.ok) {
          result.ok = true;
          result.reason = 'OK (через <img>)';
          result.details = fallback.details;
        } else {
          result.reason = 'Сеть/CORS: запрос заблокирован';
          result.details = 'Сервер должен разрешать CORS или быть доступен как <img>';
        }
        return result;
      }
      result.reason = (e && e.message) ? e.message : 'Неизвестная ошибка';
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function preloadNextWallpaper() {
    if (storage.load('wallpaperMode') !== 'auto') return;
    if (preloadAbortController) {
      try { preloadAbortController.abort(); } catch (e) {}
    }
    const localController = new AbortController();
    preloadAbortController = localController;
    const w = window.innerWidth, h = window.innerHeight;
    const source = getRandomSource();
    if (!source) return;
    try {
      const base64 = await fetchImage(source.url(w, h), 10000);
      preloadImage = base64;
      await addToCache(base64);
      resetCacheIndex();
    } catch (e) {
      preloadImage = null;
    } finally {
      if (preloadAbortController === localController) {
        preloadAbortController = null;
      }
    }
  }

  async function applyWallpaper(base64) {
    clearVideoBackground();
    document.body.style.backgroundImage = `url("${base64}")`;
    document.body.classList.remove('off-mode');
    storage.save('wallpaperMode', 'auto');
    await idbStore.set(IDB_CURRENT_KEY, base64);
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
    }
    if (currentVideoObjectUrl) {
      try { URL.revokeObjectURL(currentVideoObjectUrl); } catch (e) {}
      currentVideoObjectUrl = null;
    }
    document.body.classList.remove('has-video-background');
  }

  function setVideoBackground(fileOrUrl) {
    let url;
    let createdObjectUrl = false;
    if (typeof fileOrUrl === 'string') {
      url = fileOrUrl;
    } else {
      url = URL.createObjectURL(fileOrUrl);
      createdObjectUrl = true;
    }
    clearVideoBackground();
    stopAutoTimer();
    stopBuiltinAutoTimer();

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
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('canplay', onPlaying);
      isVideoModeActive = true;
      showVideo();
    };
    videoElement.addEventListener('playing', onPlaying);
    videoElement.addEventListener('canplay', onPlaying);
    if (videoElement.readyState >= 2) onPlaying();

    videoElement.play().catch(e => warn('Video play failed:', e));
    setupVideoLoop();
    document.body.style.backgroundImage = 'none';
    document.body.classList.add('has-video-background');
    document.body.classList.remove('off-mode');
    storage.save('wallpaperMode', 'video');
    storage.save('wallpaperVideo', url);
  }

  function isVideoMode() { return isVideoModeActive; }

  function startAutoTimer() {
    stopAutoTimer();
    const intervalText = storage.load('autoWallpaperInterval') || '5 минут';
    if (intervalText === 'Никогда') return;

    let intervalMs = 300000;
    switch (intervalText) {
      case '30 секунд': intervalMs = 30000; break;
      case '1 минута': intervalMs = 60000; break;
      case '2 минуты': intervalMs = 120000; break;
      case '5 минут': intervalMs = 300000; break;
      case '10 минут': intervalMs = 600000; break;
      case '30 минут': intervalMs = 1800000; break;
      case '1 час': intervalMs = 3600000; break;
    }
    if (intervalMs <= 0) return;
    autoTimer = setInterval(() => {
      if (storage.load('wallpaperMode') === 'auto') setAuto(false);
    }, intervalMs);
  }

  function stopAutoTimer() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  function startBuiltinAutoTimer() {
    stopBuiltinAutoTimer();
    const intervalText = storage.load('builtinWallpaperInterval') || 'Никогда';
    if (intervalText === 'Никогда') return;

    let intervalMs = 300000;
    switch (intervalText) {
      case '30 секунд': intervalMs = 30000; break;
      case '1 минута': intervalMs = 60000; break;
      case '2 минуты': intervalMs = 120000; break;
      case '5 минут': intervalMs = 300000; break;
      case '10 минут': intervalMs = 600000; break;
      case '30 минут': intervalMs = 1800000; break;
      case '1 час': intervalMs = 3600000; break;
    }
    if (intervalMs <= 0) return;
    builtinAutoTimer = setInterval(() => {
      if (storage.load('wallpaperMode') === 'custom') nextCustom();
    }, intervalMs);
  }

  function stopBuiltinAutoTimer() {
    if (builtinAutoTimer) { clearInterval(builtinAutoTimer); builtinAutoTimer = null; }
  }

  function syncButtonState(success) {
    const btn = document.getElementById('btnWallpaper');
    if (!btn) return;
    const isAuto = storage.load('wallpaperMode') === 'auto';
    btn.classList.toggle('active', isAuto && success);
  }

  async function setAuto(showLoader = true) {
    if (isLoading) return false;
    isLoading = true;

    if (showLoader) loader.show();

    let success = false;
    let lastError = null;

    try {
      clearVideoBackground();
      startAutoTimer();
      stopBuiltinAutoTimer();

      const w = window.innerWidth, h = window.innerHeight;
      updateServers(storage.load('wallpaperServers'));

      if (activeServers.length === 0) {
        lastError = new Error('Нет доступных серверов');
      } else {
        const wasHidden = document.body.classList.contains('widgets-hidden');

        if (preloadImage) {
          try {
            await applyWallpaper(preloadImage);
            await addToCache(preloadImage);
            preloadImage = null;
            preloadNextWallpaper();
            success = true;
          } catch (e) {
            preloadImage = null;
          }
        }

        if (!success) {
          try {
            const cached = await getNextFromCache();
            if (cached) {
              await applyWallpaper(cached);
              preloadNextWallpaper();
              success = true;
            }
          } catch (e) {}
        }

        if (!success) {
          for (const source of activeServers) {
            try {
              const url = source.url(w, h);
              const base64 = await fetchImage(url, 6000);
              await applyWallpaper(base64);
              await addToCache(base64);
              resetCacheIndex();
              preloadNextWallpaper();
              success = true;
              break;
            } catch (e) {
              lastError = e;
            }
          }
        }

        if (wasHidden && success) document.body.classList.add('widgets-hidden');
      }
    } catch (e) {
      lastError = e;
    } finally {
      if (showLoader) loader.hide();
      isLoading = false;
      syncButtonState(success);

      if (showLoader) {
        if (success) {
          if (typeof showToast === 'function') showToast('Обои обновлены', 1500);
        } else {
          const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
          const msg = offline ? 'Нет подключения к интернету' : 'Не удалось загрузить обои';
          if (typeof showToast === 'function') showToast(msg, 3000);
        }
      }
    }

    return success;
  }

  function updateOffModeWidgetVisibility() {
    if (!document.body.classList.contains('off-mode')) return;
    
    const hideClimate = storage.load('setting_offModeHideClimate') !== false;
    const hideApps = storage.load('setting_offModeHideApps') !== false;
    const hidePlayer = storage.load('setting_offModeHidePlayer') !== false;
    const hideNetwork = storage.load('setting_offModeHideNetwork') !== false;
    const hideMiniMap = storage.load('setting_offModeHideMiniMap') !== false;
    const hideRightButtons = storage.load('setting_offModeHideRightButtons') !== false;

    const climateWidget = document.querySelector('.widget_climate');
    const appsWidget = document.querySelector('.widget_apps');
    const playerWidget = document.querySelector('.widget_player');
    const networkWrapper = document.getElementById('networkWidgetWrapper');
    const networkBtn = document.getElementById('btnNetwork'); 
    const miniMapWidget = document.getElementById('widgetNavigation');
    const rightButtons = document.querySelector('.right-buttons');

    if (climateWidget) climateWidget.classList.toggle('off-mode-hidden', hideClimate);
    if (appsWidget) appsWidget.classList.toggle('off-mode-hidden', hideApps);
    if (playerWidget) playerWidget.classList.toggle('off-mode-hidden', hidePlayer);
    
    if (networkWrapper) {
      networkWrapper.classList.toggle('off-mode-hidden', hideNetwork);
      if (networkBtn) {
        networkBtn.style.display = hideNetwork ? 'none' : 'flex';
      }
    }
    
    if (miniMapWidget) miniMapWidget.classList.toggle('off-mode-hidden', hideMiniMap);
    if (rightButtons) rightButtons.classList.toggle('off-mode-hidden', hideRightButtons);
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
    stopAutoTimer();
    stopBuiltinAutoTimer();
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "#0F0D13";
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
    const savedMode = storage.load('wallpaperMode') || 'custom';
    if (savedMode === 'auto') setAuto(false);
    else if (savedMode === 'custom') {
      const idx = storage.load('customWallpaperIndex') || 0;
      setCustomByIndex(idx);
    } else if (savedMode === 'video') {
      const url = storage.load('wallpaperVideo');
      if (url) setVideoBackground(url);
    } else setCustomByIndex(0);

    document.body.classList.remove('off-mode');
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);

    const hint = document.querySelector('.off-mode-hint');
    if (hint) hint.remove();

    const networkWrapper = document.getElementById('networkWidgetWrapper');
    const networkBtn = document.getElementById('btnNetwork');
    if (networkWrapper) {
      networkWrapper.classList.remove('widget-hidden');
      networkWrapper.classList.remove('off-mode-hidden');
    }
    if (networkBtn) {
      networkBtn.classList.remove('widget-hidden');
      networkBtn.style.display = 'flex';
    }

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

    document.querySelectorAll('.widget_climate, .widget_apps, .widget_player, .right-buttons, #networkWidgetWrapper, #widgetNavigation')
      .forEach(w => w.classList.remove('off-mode-hidden'));
  }

  async function resolveStaticSrc(item) {
    if (!item) return null;
    if (item.isBuiltin) return item.src;
    const data = await idbStore.get(IDB_CUSTOM_WALLPAPER_DATA_PREFIX + item.id);
    return data || null;
  }

  async function setCustomByIndex(index, restartTimer = false) {
    clearVideoBackground();
    stopAutoTimer();
    if (!restartTimer) stopBuiltinAutoTimer();

    if (!staticWallpapers.length) return;
    const prevIndex = storage.load('customWallpaperIndex');
    const safeIndex = Math.max(0, Math.min(index, staticWallpapers.length - 1));
    const item = staticWallpapers[safeIndex];
    if (!item) return;
    const src = await resolveStaticSrc(item);
    if (!src) {
      if (typeof prevIndex === 'number' && prevIndex >= 0 && prevIndex < staticWallpapers.length) {
        customWallpaperIndex = prevIndex;
      }
      return;
    }
    
    customWallpaperIndex = safeIndex;
    document.body.style.backgroundImage = `url("${src}")`;
    document.body.classList.remove('off-mode', 'has-video-background');
    storage.save('wallpaperMode', 'custom');
    storage.save('wallpaperCustom', src);
    storage.save('wallpaperCustomId', item.id);
    storage.save('customWallpaperIndex', safeIndex);
    syncButtonState(false);
    
    if (restartTimer) startBuiltinAutoTimer();
  }

  function nextCustom() {
    if (storage.load('wallpaperMode') !== 'custom') return;
    let idx = storage.load('customWallpaperIndex');
    if (idx === null || idx === undefined) idx = customWallpaperIndex;
    if (idx === null || idx === undefined) idx = 0;
    const next = (idx + 1) % Math.max(staticWallpapers.length, 1);
    setCustomByIndex(next, true);
  }

  async function rebuildStaticWallpapers() {
    const hiddenRaw = storage.load(HIDDEN_BUILTINS_KEY);
    const hidden = Array.isArray(hiddenRaw) ? hiddenRaw : [];

    const visibleBuiltins = builtinWallpapersMeta.filter(b => !hidden.includes(b.id));

    let userList = [];
    try {
      const raw = await idbStore.get(IDB_CUSTOM_WALLPAPERS_KEY);
      if (Array.isArray(raw)) userList = raw;
    } catch (e) {}

    userList.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    staticWallpapers = [
      ...visibleBuiltins.map(b => ({ id: b.id, name: b.name, src: b.src, isBuiltin: true })),
      ...userList.map(u => ({ id: u.id, name: u.name, src: null, isBuiltin: false }))
    ];

    const savedIdx = storage.load('customWallpaperIndex');
    if (savedIdx !== null && savedIdx !== undefined) {
      if (savedIdx >= staticWallpapers.length) {
        customWallpaperIndex = 0;
        storage.save('customWallpaperIndex', 0);
      } else {
        customWallpaperIndex = savedIdx;
      }
    }
  }

  async function restore() {
    if (storage.load('wallpaperImage')) {
      storage.remove('wallpaperImage');
      storage.remove('wallpaper_cache');
    }

    let mode = storage.load('wallpaperMode');
    if (!mode) {
      mode = 'custom';
      storage.save('wallpaperMode', 'custom');
    }
    updateServers(storage.load('wallpaperServers'));

    await rebuildStaticWallpapers();

    if (mode === 'custom') {
      clearVideoBackground();
      stopAutoTimer();
      stopBuiltinAutoTimer();
      let savedIdx = storage.load('customWallpaperIndex');
      if (savedIdx !== null && savedIdx !== undefined && savedIdx >= 0 && savedIdx < staticWallpapers.length) {
        await setCustomByIndex(savedIdx, true);
      } else {
        await setCustomByIndex(0, true);
      }
      document.body.classList.remove('off-mode');
    } else if (mode === 'auto') {
      clearVideoBackground();
      startAutoTimer();
      stopBuiltinAutoTimer();
      const saved = await idbStore.get(IDB_CURRENT_KEY);
      if (saved) {
        await applyWallpaper(saved);
        preloadNextWallpaper();
      } else {
        await setAuto(false);
      }
    } else if (mode === 'video') {
      clearVideoBackground();
      stopAutoTimer();
      stopBuiltinAutoTimer();
      const savedVideo = storage.load('wallpaperVideo');
      if (savedVideo) setVideoBackground(savedVideo);
      else await setCustomByIndex(0);
    } else {
      await setCustomByIndex(0, true);
    }

    const wasHidden = storage.load('widgetsHiddenByUser');
    document.body.classList.toggle('widgets-hidden', !!wasHidden);
    syncButtonState(true);
  }

  function toggleOffMode() {
    if (document.body.classList.contains('off-mode')) exitOffMode();
    else setOff();
  }

  async function toggleAutoMode() {
    const currentMode = storage.load('wallpaperMode') || 'custom';
    const btn = document.getElementById('btnWallpaper');

    if (currentMode === 'auto') {
      const idx = storage.load('customWallpaperIndex') || 0;
      await setCustomByIndex(idx, true);
      if (btn) btn.classList.remove('active');
      if (typeof showToast === 'function') showToast('Автосмена обоев выключена', 1500);
      return false;
    }

    if (btn) btn.classList.add('active');
    const ok = await setAuto(true);
    if (!ok && btn) btn.classList.remove('active');
    return ok;
  }

  function initAutoMode() {
    updateServers(storage.load('wallpaperServers'));
    if (storage.load('wallpaperMode') === 'auto') {
      startAutoTimer();
      preloadNextWallpaper();
    }
    if (storage.load('wallpaperMode') === 'custom') {
      startBuiltinAutoTimer();
    }
    syncButtonState(true);
  }

  function restartAutoMode() {
    if (storage.load('wallpaperMode') === 'auto') {
      stopAutoTimer();
      startAutoTimer();
      const intervalText = storage.load('autoWallpaperInterval');
      if (intervalText !== 'Никогда') setAuto(false);
    }
  }

  async function saveUserWallpaperInternal(name, base64) {
    const list = (await idbStore.get(IDB_CUSTOM_WALLPAPERS_KEY)) || [];
    if (!Array.isArray(list)) return null;
    const id = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const meta = { id, name, addedAt: Date.now() };
    await idbStore.set(IDB_CUSTOM_WALLPAPER_DATA_PREFIX + id, base64);
    list.push(meta);
    await idbStore.set(IDB_CUSTOM_WALLPAPERS_KEY, list);
    return meta;
  }

  async function deleteUserWallpaperInternal(id) {
    const list = (await idbStore.get(IDB_CUSTOM_WALLPAPERS_KEY)) || [];
    const filtered = list.filter(item => item.id !== id);
    await idbStore.set(IDB_CUSTOM_WALLPAPERS_KEY, filtered);
    await idbStore.remove(IDB_CUSTOM_WALLPAPER_DATA_PREFIX + id);
  }

  function hideBuiltinInternal(id) {
    const raw = storage.load(HIDDEN_BUILTINS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    if (!list.includes(id)) {
      list.push(id);
      storage.save(HIDDEN_BUILTINS_KEY, list);
    }
  }

  function restoreBuiltinInternal(id) {
    const raw = storage.load(HIDDEN_BUILTINS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    const filtered = list.filter(x => x !== id);
    storage.save(HIDDEN_BUILTINS_KEY, filtered);
  }

  function getHiddenBuiltins() {
    const raw = storage.load(HIDDEN_BUILTINS_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  return {
    setOff, setAuto, setCustomByIndex, nextCustom, restore,
    toggleOffMode, toggleAutoMode, initAutoMode, setVideoBackground,
    isVideoMode, updateServers, restartAutoMode,
    exitOffMode,
    updateOffModeWidgetVisibility,
    clearCache,
    testServerUrl,
    rebuildStaticWallpapers,
    getStaticList: () => staticWallpapers.slice(),
    getBuiltinMeta: () => builtinWallpapersMeta.slice(),
    saveUserWallpaperInternal,
    deleteUserWallpaperInternal,
    hideBuiltinInternal,
    restoreBuiltinInternal,
    getHiddenBuiltins,
    resolveStaticSrc,
    restartBuiltinAutoTimer: startBuiltinAutoTimer,
    FIXED_PEIZAZHI_URL,
    FIXED_CARS_URL,
    FIXED_LOVE_URL,
    FIXED_THEME_URL,
    FIXED_ANIMALS_URL,
    FIXED_DYNAMIC_URL
  };
})();