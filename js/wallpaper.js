/**********************************************
 * Модуль: Обои (статические, авто, видео)
 * [FIX] Fallback wallpaperMode при первом запуске
 * [PERF] Лимит кеша по размеру (MAX_CACHE_BYTES)
 * [FIX] testServerUrl: fallback на Image() при CORS-ошибке
 * [UX] restoreButtonsPosition удалён — позиция сети больше не сохраняется
 **********************************************/

modules.wallpaper = (function() {
  const staticWallpapers = Array.from(document.querySelectorAll('.wallpaper-item')).map(item => item.dataset.src);
  let customWallpaperIndex = 0;
  const MAX_CACHE_SIZE = 10;
  const MAX_CACHE_BYTES = 24 * 1024 * 1024; // [PERF] ~24 МБ
  const IDB_CACHE_KEY = 'wallpaper_cache';
  const IDB_CURRENT_KEY = 'wallpaper_current';
  const CACHE_INDEX_KEY = 'wallpaper_cache_index';

  const IMAGE_SOURCES = [
    { name: 'LoremFlickr', id: 'loremflickr', url: (w, h) => `https://loremflickr.com/${w}/${h}/landscape/all?lock=${Date.now()}` },
    { name: 'LoremFlickr CN (Россия)', id: 'loremflickrcn', url: (w, h) => `https://loremflickrcn.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
    { name: 'Picsum Proxy (Россия)', id: 'picsum_proxy', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` },
    { name: 'Picsum', id: 'picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
    { name: 'PlaceKitten', id: 'placekitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` }
  ];

  let activeServers = [];
  let preloadImage = null, preloadAbortController = null;
  let isLoading = false;
  let autoTimer = null;
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

  function getCustomServerSource() {
    const raw = storage.load('setting_wallpaperCustomServer');
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      warn('[Wallpaper] Кастомный сервер: URL должен начинаться с http(s)://');
      return null;
    }
    return {
      name: 'Свой сервер',
      id: 'custom',
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

  function updateServers(selectedIds) {
    const custom = getCustomServerSource();
    let built = [];

    if (custom) built.push(custom);

    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      built = built.concat(IMAGE_SOURCES.filter(s => selectedIds.includes(s.id)));
    } else {
      built = built.concat(IMAGE_SOURCES);
    }

    if (built.length === 0) built = [...IMAGE_SOURCES];
    activeServers = built;
    console.log('[Wallpaper] active servers:', activeServers.map(s => s.id).join(', '));
  }

  function getRandomSource() {
    if (activeServers.length === 0) updateServers(storage.load('wallpaperServers'));
    return activeServers[Math.floor(Math.random() * activeServers.length)];
  }

  async function fetchImage(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      console.log('[Wallpaper] fetch:', url);
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      });
      console.log('[Wallpaper] response:', res.status, res.type);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      console.log('[Wallpaper] blob size:', blob.size);
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
    // [PERF] Лимит по количеству
    if (unique.length > MAX_CACHE_SIZE) unique.length = MAX_CACHE_SIZE;
    // [PERF] Лимит по суммарному размеру base64
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
      console.log('[Wallpaper] Кеш обоев очищен');
    } catch (e) {
      warn('[Wallpaper] clearCache error:', e);
    }
  }

  // [FIX] Fallback-проверка через Image() если CORS заблокировал fetch
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
      console.log('[Wallpaper] testServerUrl fetch:', testUrl);
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
        // [FIX] Fallback на Image()
        console.log('[Wallpaper] CORS error, fallback to Image()');
        const fallback = await testImageViaImageElement(testUrl, 8000);
        if (fallback.ok) {
          result.ok = true;
          result.reason = 'OK (через <img>)';
          result.details = fallback.details;
        } else {
          result.reason = 'Сеть/CORS: запрос заблокирован';
          result.details = 'Сервер должен разрешать CORS (Access-Control-Allow-Origin) или быть доступен как <img>';
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
    // [PERF] Не прелоадим, если не в auto-режиме
    if (storage.load('wallpaperMode') !== 'auto') return;
    if (preloadAbortController) preloadAbortController.abort();
    preloadAbortController = new AbortController();
    const w = window.innerWidth, h = window.innerHeight;
    const source = getRandomSource();
    try {
      const base64 = await fetchImage(source.url(w, h), 10000);
      preloadImage = base64;
      await addToCache(base64);
      resetCacheIndex();
    } catch (e) {
      preloadImage = null;
    } finally {
      preloadAbortController = null;
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

    if (intervalText === 'Никогда') {
      console.log('[Wallpaper] Автосмена: никогда (таймер не запущен)');
      return;
    }

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
    if (intervalMs <= 0) {
      console.log('[Wallpaper] Автосмена: интервал <= 0, таймер не запущен');
      return;
    }
    autoTimer = setInterval(() => {
      if (storage.load('wallpaperMode') === 'auto') setAuto(false);
    }, intervalMs);
  }

  function stopAutoTimer() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  function syncButtonState(success) {
    const btn = document.getElementById('btnWallpaper');
    if (!btn) return;
    const isAuto = storage.load('wallpaperMode') === 'auto';
    btn.classList.toggle('active', isAuto && success);
  }

  async function setAuto(showLoader = true) {
    if (isLoading) {
      warn('[Wallpaper] setAuto уже выполняется');
      return false;
    }
    isLoading = true;

    if (showLoader) loader.show();

    let success = false;
    let lastError = null;

    try {
      clearVideoBackground();
      startAutoTimer();

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
            warn('[Wallpaper] applyWallpaper(preload) error:', e);
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
          } catch (e) {
            warn('[Wallpaper] getNextFromCache error:', e);
          }
        }

        if (!success) {
          for (const source of activeServers) {
            try {
              console.log('[Wallpaper] trying source:', source.name);
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
              console.warn(`[Wallpaper] Ошибка загрузки с ${source.name}:`, e && (e.message || e));
            }
          }
        }

        if (wasHidden && success) document.body.classList.add('widgets-hidden');
      }
    } catch (e) {
      lastError = e;
      console.error('[Wallpaper] setAuto fatal:', e);
    } finally {
      if (showLoader) loader.hide();
      isLoading = false;
      syncButtonState(success);

      if (showLoader) {
        if (success) {
          if (typeof showToast === 'function') showToast('Обои обновлены', 1500);
        } else {
          const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
          const msg = offline
            ? 'Нет подключения к интернету'
            : 'Не удалось загрузить обои — проверьте сеть';
          if (typeof showToast === 'function') showToast(msg, 3000);
          console.warn('[Wallpaper] setAuto failed:', lastError);
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
    const hideRightButtons = storage.load('setting_offModeHideRightButtons') !== false;

    const climateWidget = document.querySelector('.widget_climate');
    const appsWidget = document.querySelector('.widget_apps');
    const playerWidget = document.querySelector('.widget_player');
    const rightButtons = document.querySelector('.right-buttons');

    if (climateWidget) climateWidget.classList.toggle('off-mode-hidden', hideClimate);
    if (appsWidget) appsWidget.classList.toggle('off-mode-hidden', hideApps);
    if (playerWidget) playerWidget.classList.toggle('off-mode-hidden', hidePlayer);
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
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "#0F0D13";
    document.body.classList.add('off-mode');
    document.body.classList.remove('widgets-hidden');
    storage.save('widgetsHiddenByUser', false);

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

    const tw = document.querySelector('.widget_time');
    if (tw) {
      tw.classList.add('moon-returning');
      const cleanup = () => {
        tw.classList.remove('moon-returning');
        tw.removeEventListener('animationend', cleanup);
      };
      tw.addEventListener('animationend', cleanup);
      setTimeout(() => {
        if (tw.classList.contains('moon-returning')) cleanup();
      }, 1500);
    }

    document.querySelectorAll('.widget_climate, .widget_apps, .widget_player, .right-buttons')
      .forEach(w => w.classList.remove('off-mode-hidden'));

    // [UX] Позиция кнопки сети больше не восстанавливается — она встроена в плеер
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
    syncButtonState(false);
  }

  function nextCustom() {
    if (storage.load('wallpaperMode') !== 'custom') return;
    let idx = storage.load('customWallpaperIndex');
    if (idx === null || idx === undefined) {
      const currentBg = document.body.style.backgroundImage;
      if (currentBg && currentBg !== 'none') {
        const match = currentBg.match(/url\("?(.+?)"?\)/);
        if (match && match[1]) {
          const foundIndex = staticWallpapers.findIndex(src =>
            match[1].includes(src.replace(/^.*[\\\/]/, '')));
          if (foundIndex !== -1) idx = foundIndex;
        }
      }
      if (idx === null || idx === undefined) idx = customWallpaperIndex;
      if (idx === null || idx === undefined) idx = 0;
    }
    setCustomByIndex((idx + 1) % staticWallpapers.length);
  }

  async function restore() {
    if (storage.load('wallpaperImage')) {
      storage.remove('wallpaperImage');
      storage.remove('wallpaper_cache');
      console.log('[Wallpaper] stale localStorage cache cleaned');
    }

    let mode = storage.load('wallpaperMode');
    // [FIX] Fallback при первом запуске
    if (!mode) {
      mode = 'custom';
      storage.save('wallpaperMode', 'custom');
    }
    updateServers(storage.load('wallpaperServers'));

    if (mode === 'custom') {
      clearVideoBackground();
      stopAutoTimer();
      let savedIdx = storage.load('customWallpaperIndex');
      const bg = storage.load('wallpaperCustom');
      if (savedIdx !== null && savedIdx !== undefined && savedIdx >= 0 && savedIdx < staticWallpapers.length) {
        customWallpaperIndex = savedIdx;
        document.body.style.backgroundImage = `url(${staticWallpapers[savedIdx]})`;
      } else if (bg && bg !== 'none') {
        document.body.style.backgroundImage = `url(${bg})`;
        const foundIndex = staticWallpapers.findIndex(src => bg.includes(src.replace(/^.*[\\\/]/, '')));
        if (foundIndex !== -1) {
          customWallpaperIndex = foundIndex;
          storage.save('customWallpaperIndex', foundIndex);
        }
      } else {
        setCustomByIndex(0);
      }
      document.body.classList.remove('off-mode');
    } else if (mode === 'auto') {
      clearVideoBackground();
      startAutoTimer();
      const saved = await idbStore.get(IDB_CURRENT_KEY);
      if (saved) {
        await applyWallpaper(saved);
        preloadNextWallpaper();
      } else {
        setAuto(false);
      }
    } else if (mode === 'video') {
      clearVideoBackground();
      stopAutoTimer();
      const savedVideo = storage.load('wallpaperVideo');
      if (savedVideo) setVideoBackground(savedVideo);
      else setCustomByIndex(0);
    } else {
      setCustomByIndex(0);
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
      setCustomByIndex(idx);
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
    syncButtonState(true);
  }

  function restartAutoMode() {
    if (storage.load('wallpaperMode') === 'auto') {
      stopAutoTimer();
      startAutoTimer();
      const intervalText = storage.load('autoWallpaperInterval');
      if (intervalText !== 'Никогда') {
        setAuto(false);
      }
    }
  }

  return {
    setOff, setAuto, setCustomByIndex, nextCustom, restore,
    toggleOffMode, toggleAutoMode, initAutoMode, setVideoBackground,
    isVideoMode, updateServers, restartAutoMode,
    exitOffMode,
    updateOffModeWidgetVisibility,
    clearCache,
    testServerUrl
  };
})();