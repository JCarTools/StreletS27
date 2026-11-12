/**********************************************
 * Модуль: Обои — главный (статика, авто, публичный API)
 * [FIX 20] Улучшено логирование ошибок, чтобы понимать, почему не грузятся обои.
 **********************************************/

modules.wallpaperMain = (function() {
  const C = modules.wallpaperCore;
  const V = modules.wallpaperVideo;

  let staticWallpapers = [];
  let customWallpaperIndex = 0;

  let autoTimer = null;
  let builtinAutoTimer = null;

  let isPreloading = false;
  let preloadPending = false;

  function stopAutoTimer() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
  function stopBuiltinAutoTimer() { if (builtinAutoTimer) { clearInterval(builtinAutoTimer); builtinAutoTimer = null; } }
  function stopAllTimers() { stopAutoTimer(); stopBuiltinAutoTimer(); }

  function preloadImage(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(); return; }
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function startAutoTimer() {
    stopAutoTimer();
    const intervalText = storage.load(C.STORAGE_KEY_AUTO_INTERVAL) || '5 минут';
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
      if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto') setAuto(false);
    }, intervalMs);
  }

  function startBuiltinAutoTimer() {
    stopBuiltinAutoTimer();
    const intervalText = storage.load(C.STORAGE_KEY_BUILTIN_INTERVAL) || 'Никогда';
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
      if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'custom') nextCustom();
    }, intervalMs);
  }

  function syncButtonState(success) {
    const btn = document.getElementById('btnWallpaper');
    if (!btn) return;
    const isAuto = storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto';
    btn.classList.toggle('active', isAuto && success);
  }

  async function applyWallpaper(base64) {
    V.clearVideoBackground();
    await preloadImage(base64);
    document.body.style.backgroundImage = `url("${base64}")`;
    document.body.classList.remove('off-mode');
    storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'auto');
    await idbStore.set(C.IDB_CURRENT_KEY, base64);
  }

  async function preloadNextWallpaper() {
    if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) !== 'auto') return;
    if (isPreloading) { preloadPending = true; return; }

    isPreloading = true;
    const oldController = C.getPreloadAbortController();
    if (oldController) { try { oldController.abort(); } catch (e) {} }

    const localController = new AbortController();
    C.setPreloadAbortController(localController);

    const w = window.innerWidth, h = window.innerHeight;
    const source = C.getRandomSource();
    if (!source) {
      isPreloading = false; preloadPending = false; C.setPreloadAbortController(null);
      return;
    }

    try {
      const base64 = await C.fetchImage(source.url(w, h), 10000, localController.signal);
      if (localController.signal.aborted) return;
      C.setPreloadImage(base64);
      await C.addToCache(base64);
      C.resetCacheIndex();
    } catch (e) {
      if (!localController.signal.aborted) C.setPreloadImage(null);
    } finally {
      if (C.getPreloadAbortController() === localController) C.setPreloadAbortController(null);
      isPreloading = false;
      if (preloadPending) {
        preloadPending = false;
        if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto') setTimeout(preloadNextWallpaper, 0);
      }
    }
  }

  let isLoading = false;

  async function setAuto(showLoader = true) {
    if (isLoading) return false;
    isLoading = true;
    if (showLoader) loader.show();

    let success = false;

    try {
      V.clearVideoBackground();
      startAutoTimer();
      stopBuiltinAutoTimer();

      const w = window.innerWidth, h = window.innerHeight;
      C.updateServers(storage.load('wallpaperServers'));

      if (C.getActiveServers().length === 0) {
        console.warn('[Wallpaper] Нет выбранных серверов для загрузки');
      } else {
        const wasHidden = document.body.classList.contains('widgets-hidden');
        const preloadImageData = C.getPreloadImage();

        if (preloadImageData) {
          try {
            await applyWallpaper(preloadImageData);
            await C.addToCache(preloadImageData);
            C.setPreloadImage(null);
            preloadNextWallpaper();
            success = true;
          } catch (e) { C.setPreloadImage(null); }
        }

        if (!success) {
          try {
            const cached = await C.getNextFromCache();
            if (cached) {
              await applyWallpaper(cached);
              preloadNextWallpaper();
              success = true;
            }
          } catch (e) {}
        }

        if (!success) {
          for (const source of C.getActiveServers()) {
            try {
              const url = source.url(w, h);
              const base64 = await C.fetchImage(url, 10000); // Увеличили таймаут
              await applyWallpaper(base64);
              await C.addToCache(base64);
              C.resetCacheIndex();
              preloadNextWallpaper();
              success = true;
              break;
            } catch (e) { 
              console.warn('[Wallpaper] Ошибка сервера ' + source.name + ':', e.message);
            }
          }
        }

        if (wasHidden && success) document.body.classList.add('widgets-hidden');
      }
    } catch (e) {
      console.error('[Wallpaper] Критическая ошибка setAuto:', e);
    } finally {
      if (showLoader) loader.hide();
      isLoading = false;

      if (!success) {
        const currentBg = document.body.style.backgroundImage;
        const hasAnyBg = currentBg && currentBg !== 'none' && currentBg.includes('url(');
        if (!hasAnyBg) storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'custom');
      }

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

  async function resolveStaticSrc(item) {
    if (!item) return null;
    if (item.isBuiltin) return item.src;
    const data = await idbStore.get(C.IDB_CUSTOM_WALLPAPER_DATA_PREFIX + item.id);
    return data || null;
  }

  async function setCustomByIndex(index, restartTimer = false) {
    V.clearVideoBackground();
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

    await preloadImage(src);

    customWallpaperIndex = safeIndex;
    document.body.style.backgroundImage = `url("${src}")`;
    document.body.classList.remove('off-mode', 'has-video-background');
    storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'custom');
    storage.save('wallpaperCustom', src);
    storage.save('wallpaperCustomId', item.id);
    storage.save('customWallpaperIndex', safeIndex);
    syncButtonState(false);

    if (restartTimer) startBuiltinAutoTimer();
  }

  function nextCustom() {
    if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) !== 'custom') return;
    let idx = storage.load('customWallpaperIndex');
    if (idx === null || idx === undefined) idx = customWallpaperIndex;
    if (idx === null || idx === undefined) idx = 0;
    const next = (idx + 1) % Math.max(staticWallpapers.length, 1);
    setCustomByIndex(next, true);
  }

  async function rebuildStaticWallpapers() {
    const hiddenRaw = storage.load(C.HIDDEN_BUILTINS_KEY);
    const hidden = Array.isArray(hiddenRaw) ? hiddenRaw : [];

    if (C.getBuiltinMeta().length === 0) C.initBuiltinMeta();

    const allBuiltinMeta = C.getBuiltinMeta();
    const visibleBuiltins = allBuiltinMeta.filter(b => !hidden.includes(b.id));

    let userList = [];
    try {
      const raw = await idbStore.get(C.IDB_CUSTOM_WALLPAPERS_KEY);
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

    await C.loadServers();
    C.initBuiltinMeta();

    let mode = storage.load(C.STORAGE_KEY_WALLPAPER_MODE);
    if (!mode) {
      mode = 'custom';
      storage.save(C.STORAGE_KEY_WALLPAPER_MODE, 'custom');
    }
    C.updateServers(storage.load('wallpaperServers'));

    await rebuildStaticWallpapers();

    if (mode === 'custom') {
      V.clearVideoBackground();
      document.body.classList.remove('has-video-background');
      stopAutoTimer();
      stopBuiltinAutoTimer();
      isPreloading = false;
      preloadPending = false;
      let savedIdx = storage.load('customWallpaperIndex');
      if (savedIdx !== null && savedIdx !== undefined && savedIdx >= 0 && savedIdx < staticWallpapers.length) {
        await setCustomByIndex(savedIdx, true);
      } else {
        await setCustomByIndex(0, true);
      }
      document.body.classList.remove('off-mode');
    } else if (mode === 'auto') {
      V.clearVideoBackground();
      document.body.classList.remove('has-video-background');
      startAutoTimer();
      stopBuiltinAutoTimer();
      const saved = await idbStore.get(C.IDB_CURRENT_KEY);
      if (saved) {
        await applyWallpaper(saved);
        preloadNextWallpaper();
      } else {
        await setAuto(false);
      }
    } else if (mode === 'video') {
      V.clearVideoBackground();
      stopAutoTimer();
      stopBuiltinAutoTimer();
      const restored = V.restoreVideoFromStorage();
      if (!restored) {
        document.body.classList.remove('has-video-background');
        await setCustomByIndex(0, true);
      }
    } else {
      await setCustomByIndex(0, true);
    }

    const wasHidden = storage.load('widgetsHiddenByUser');
    document.body.classList.toggle('widgets-hidden', !!wasHidden);
    syncButtonState(true);
  }

  async function toggleAutoMode() {
    const currentMode = storage.load(C.STORAGE_KEY_WALLPAPER_MODE) || 'custom';
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
    C.updateServers(storage.load('wallpaperServers'));
    if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto') {
      startAutoTimer();
      preloadNextWallpaper();
    }
    if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'custom') {
      startBuiltinAutoTimer();
    }
    syncButtonState(true);
  }

  function restartAutoMode() {
    if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto') {
      stopAutoTimer();
      startAutoTimer();
      const intervalText = storage.load(C.STORAGE_KEY_AUTO_INTERVAL);
      if (intervalText !== 'Никогда') setAuto(false);
    }
  }

  function setIntervalSetting(key, value) {
    if (key === 'auto') {
      storage.save(C.STORAGE_KEY_AUTO_INTERVAL, value);
      if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'auto') {
        stopAutoTimer();
        startAutoTimer();
      }
    } else if (key === 'builtin') {
      storage.save(C.STORAGE_KEY_BUILTIN_INTERVAL, value);
      if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'custom') {
        stopBuiltinAutoTimer();
        startBuiltinAutoTimer();
      }
    }
  }

  async function saveUserWallpaperInternal(name, base64) {
    const list = (await idbStore.get(C.IDB_CUSTOM_WALLPAPERS_KEY)) || [];
    if (!Array.isArray(list)) return null;
    const id = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const meta = { id, name, addedAt: Date.now() };
    await idbStore.set(C.IDB_CUSTOM_WALLPAPER_DATA_PREFIX + id, base64);
    list.push(meta);
    await idbStore.set(C.IDB_CUSTOM_WALLPAPERS_KEY, list);
    return meta;
  }

  async function deleteUserWallpaperInternal(id) {
    const list = (await idbStore.get(C.IDB_CUSTOM_WALLPAPERS_KEY)) || [];
    const filtered = list.filter(item => item.id !== id);
    await idbStore.set(C.IDB_CUSTOM_WALLPAPERS_KEY, filtered);
    await idbStore.remove(C.IDB_CUSTOM_WALLPAPER_DATA_PREFIX + id);
  }

  function hideBuiltinInternal(id) {
    const raw = storage.load(C.HIDDEN_BUILTINS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    if (!list.includes(id)) {
      list.push(id);
      storage.save(C.HIDDEN_BUILTINS_KEY, list);
    }
  }

  function restoreBuiltinInternal(id) {
    const raw = storage.load(C.HIDDEN_BUILTINS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    const filtered = list.filter(x => x !== id);
    storage.save(C.HIDDEN_BUILTINS_KEY, filtered);
  }

  function getHiddenBuiltins() {
    const raw = storage.load(C.HIDDEN_BUILTINS_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  async function saveCurrentAsUserWallpaper() {
    try {
      const bgImage = document.body.style.backgroundImage;
      if (!bgImage || !bgImage.includes('url(')) {
        if (typeof showToast === 'function') showToast('Нечего сохранять', 2000);
        return false;
      }
      const match = bgImage.match(/url\("?(.+?)"?\)/);
      if (!match) return false;
      let src = match[1];

      let base64 = src;
      if (!src.startsWith('data:')) {
        try {
          const res = await fetch(src, { cache: 'no-store', mode: 'cors', credentials: 'omit' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const blob = await res.blob();
          base64 = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result);
            fr.onerror = () => reject(new Error('FileReader error'));
            fr.readAsDataURL(blob);
          });
        } catch (e) {
          if (typeof showToast === 'function') showToast('Не удалось скачать обои', 2500);
          return false;
        }
      }

      const name = 'Сохранённые ' + new Date().toLocaleString('ru-RU');
      const meta = await saveUserWallpaperInternal(name, base64);
      if (!meta) {
        if (typeof showToast === 'function') showToast('Не удалось сохранить', 2500);
        return false;
      }
      await rebuildStaticWallpapers();
      if (typeof window.rebuildSidebarGrid === 'function') window.rebuildSidebarGrid();
      if (typeof showToast === 'function') showToast('Обои сохранены в «Ваши обои»', 2000);
      return true;
    } catch (e) {
      console.warn('[Wallpaper] saveCurrentAsUserWallpaper error:', e);
      if (typeof showToast === 'function') showToast('Ошибка сохранения обоев', 2500);
      return false;
    }
  }

  return {
    restore,
    setAuto,
    setCustomByIndex,
    nextCustom,
    toggleAutoMode,
    initAutoMode,
    restartAutoMode,
    rebuildStaticWallpapers,
    resolveStaticSrc,
    saveCurrentAsUserWallpaper,
    setIntervalSetting,
    saveUserWallpaperInternal,
    deleteUserWallpaperInternal,
    hideBuiltinInternal,
    restoreBuiltinInternal,
    getHiddenBuiltins,
    stopAllTimers,
    getStaticList: () => staticWallpapers.slice(),
    isPreloading: () => isPreloading
  };
})();

/* Публичный фасад modules.wallpaper */
modules.wallpaper = (function() {
  const C = modules.wallpaperCore;
  const V = modules.wallpaperVideo;
  const M = modules.wallpaperMain;

  return {
    setOff: V.setOff,
    setAuto: M.setAuto,
    setCustomByIndex: M.setCustomByIndex,
    nextCustom: M.nextCustom,
    restore: M.restore,
    toggleOffMode: V.toggleOffMode,
    toggleAutoMode: M.toggleAutoMode,
    initAutoMode: M.initAutoMode,
    setVideoBackground: V.setVideoBackground,
    isVideoMode: V.isVideoMode,
    updateServers: C.updateServers,
    restartAutoMode: M.restartAutoMode,
    exitOffMode: V.exitOffMode,
    updateOffModeWidgetVisibility: V.updateOffModeWidgetVisibility,
    clearCache: C.clearCache,
    testServerUrl: C.testServerUrl,
    rebuildStaticWallpapers: M.rebuildStaticWallpapers,
    getStaticList: M.getStaticList,
    getBuiltinMeta: C.getBuiltinMeta,
    saveUserWallpaperInternal: M.saveUserWallpaperInternal,
    deleteUserWallpaperInternal: M.deleteUserWallpaperInternal,
    hideBuiltinInternal: M.hideBuiltinInternal,
    restoreBuiltinInternal: M.restoreBuiltinInternal,
    getHiddenBuiltins: M.getHiddenBuiltins,
    resolveStaticSrc: M.resolveStaticSrc,
    restartBuiltinAutoTimer: () => {
      if (storage.load(C.STORAGE_KEY_WALLPAPER_MODE) === 'custom') {
        M.stopAllTimers();
        M.initAutoMode();
      }
    },
    saveCurrentAsUserWallpaper: M.saveCurrentAsUserWallpaper,
    setIntervalSetting: M.setIntervalSetting,
    loadServers: C.loadServers
  };
})();