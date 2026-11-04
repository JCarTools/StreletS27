/**********************************************
 * Модуль: Обои — ядро (состояние, кэш, серверы, утилиты)
 * Часть 1 из 3. Публичный API собирается в wallpaper-main.js.
 * [NEW] FIXED_PICSUM_GRAY_URL, FIXED_PICSUM_COLOR_URL, FIXED_LOREMFLICKR_URL
 **********************************************/

modules.wallpaperCore = (function() {
  const IDB_CUSTOM_WALLPAPERS_KEY = 'wallpaper_custom_list';
  const IDB_CUSTOM_WALLPAPER_DATA_PREFIX = 'wallpaper_custom_data_';
  const HIDDEN_BUILTINS_KEY = 'wallpaper_hidden_builtins';

  const STORAGE_KEY_WALLPAPER_MODE = 'wallpaperMode';
  const STORAGE_KEY_VIDEO_SOURCE = 'wallpaperVideoSource';
  const STORAGE_KEY_VIDEO_PRESET = 'wallpaperVideoPreset';
  const STORAGE_KEY_AUTO_INTERVAL = 'autoWallpaperInterval';
  const STORAGE_KEY_BUILTIN_INTERVAL = 'builtinWallpaperInterval';

  const VIDEO_PRESET_PREFIX = 'preset:';
  const PRESET_KAMIN = 'preset:kamin';
  const PRESET_KAMIN_SRC = 'images/kaminHD.mp4';

  const MAX_CACHE_SIZE = 10;
  const MAX_CACHE_BYTES = 24 * 1024 * 1024;
  const IDB_CACHE_KEY = 'wallpaper_cache';
  const IDB_CURRENT_KEY = 'wallpaper_current';
  const CACHE_INDEX_KEY = 'wallpaper_cache_index';

  const FIXED_PEIZAZHI_URL = 'https://bingw.jasonzeng.dev/?resolution=1920x1080&index=random';
  const FIXED_CARS_URL = 'https://api.icofun.cn/API/360bz.php?n=10&type=image';
  const FIXED_BING_URL = 'https://bing.biturl.top/?resolution=1920&format=image&index=random';
  const FIXED_THEME_URL = 'https://api.icofun.cn/API/360bz.php?n=5&type=image';
  const FIXED_ANIMALS_URL = 'https://api.icofun.cn/API/360bz.php?n=8&type=image';
  const FIXED_DYNAMIC_URL = 'https://api.icofun.cn/API/360bz.php?n=13&type=image';

  // NEW: ч/б и цветные Picsum + LoremFlickr
  const FIXED_PICSUM_GRAY_URL = 'https://picsum.photos/1920/1080?grayscale';
  const FIXED_PICSUM_COLOR_URL = 'https://picsum.photos/1920/1080';
  const FIXED_LOREMFLICKR_URL = 'https://loremflickrcn.com/1920/1080/landscape';

  const IMAGE_SOURCES = [
    { name: 'LoremFlickr CN (Россия)', id: 'loremflickrcn', url: (w, h) => `https://loremflickrcn.com/${w}/${h}/landscape?random&lock=${Date.now()}` },
    { name: 'Picsum Proxy (Россия)', id: 'picsum_proxy', url: (w, h) => `https://jcartools.ru/run/picsum_proxy.php?${w}/${h}&t=${Date.now()}` },
    { name: 'Picsum', id: 'picsum', url: (w, h) => `https://picsum.photos/${w}/${h}?random&t=${Date.now()}` },
    { name: 'PlaceKitten', id: 'placekitten', url: (w, h) => `https://placekitten.com/${w}/${h}?image=${Math.floor(Math.random()*100)}` }
  ];

  let activeServers = [];
  let preloadImage = null;
  let preloadAbortController = null;
  let builtinWallpapersMeta = [];

  function initBuiltinMeta() {
    builtinWallpapersMeta = Array.from(document.querySelectorAll('.wallpaper-item')).map((item, idx) => ({
      id: `builtin_${idx}`,
      name: (item.querySelector('img')?.alt) || `Обои ${idx + 1}`,
      src: item.dataset.src,
      isBuiltin: true
    }));
  }

  function getBuiltinMeta() {
    return builtinWallpapersMeta.slice();
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
    const custom1 = isCustomEnabled('wallpaperCustomServer') ? getCustomServerSource('wallpaperCustomServer', 'Пейзажи') : null;
    const custom2 = isCustomEnabled('wallpaperCustomServer2') ? getCustomServerSource('wallpaperCustomServer2', 'Автомобили') : null;
    const custom3 = isCustomEnabled('wallpaperCustomServer3') ? getCustomServerSource('wallpaperCustomServer3', 'Бинг') : null;
    const custom4 = isCustomEnabled('wallpaperCustomServer4') ? getCustomServerSource('wallpaperCustomServer4', 'Легкий стиль') : null;
    const custom5 = isCustomEnabled('wallpaperCustomServer5') ? getCustomServerSource('wallpaperCustomServer5', 'Милые животные') : null;
    const custom6 = isCustomEnabled('wallpaperCustomServer6') ? getCustomServerSource('wallpaperCustomServer6', 'Динамичные') : null;
    const customGray = isCustomEnabled('wallpaperCustomServerGray') ? getCustomServerSource('wallpaperCustomServerGray', 'Ч/Б (Picsum)') : null;
    const customPicsum = isCustomEnabled('wallpaperCustomServerPicsum') ? getCustomServerSource('wallpaperCustomServerPicsum', 'Picsum (цвет)') : null;
    const customLorem = isCustomEnabled('wallpaperCustomServerLorem') ? getCustomServerSource('wallpaperCustomServerLorem', 'LoremFlickr') : null;
    const customUser = getCustomServerSourceUser();

    let built = [];
    if (custom1) built.push(custom1);
    if (custom2) built.push(custom2);
    if (custom3) built.push(custom3);
    if (custom4) built.push(custom4);
    if (custom5) built.push(custom5);
    if (custom6) built.push(custom6);
    if (customGray) built.push(customGray);
    if (customPicsum) built.push(customPicsum);
    if (customLorem) built.push(customLorem);
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
        try { preloadAbortController.abort(); } catch (e) {}
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
    if (!rawUrl || typeof rawUrl !== 'string') { result.reason = 'URL не задан'; return result; }
    const trimmed = rawUrl.trim();
    if (!trimmed) { result.reason = 'URL пустой'; return result; }
    if (!/^https?:\/\//i.test(trimmed)) { result.reason = 'URL должен начинаться с http:// или https://'; return result; }

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
      if (!res.ok) { result.reason = `HTTP ${res.status}`; result.details = res.statusText || ''; return result; }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) { result.reason = `Не картинка (Content-Type: ${contentType || 'не указан'})`; return result; }
      const blob = await res.blob();
      if (blob.size < 1000) { result.reason = `Слишком маленький ответ (${blob.size} байт)`; return result; }
      result.ok = true;
      result.reason = 'OK';
      result.details = `${contentType}, ${Math.round(blob.size / 1024)} КБ`;
      return result;
    } catch (e) {
      const name = e && e.name ? e.name : '';
      if (name === 'AbortError') { result.reason = 'Таймаут (8с)'; return result; }
      if (name === 'TypeError') {
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

  return {
    IDB_CUSTOM_WALLPAPERS_KEY,
    IDB_CUSTOM_WALLPAPER_DATA_PREFIX,
    HIDDEN_BUILTINS_KEY,
    STORAGE_KEY_WALLPAPER_MODE,
    STORAGE_KEY_VIDEO_SOURCE,
    STORAGE_KEY_VIDEO_PRESET,
    STORAGE_KEY_AUTO_INTERVAL,
    STORAGE_KEY_BUILTIN_INTERVAL,
    VIDEO_PRESET_PREFIX,
    PRESET_KAMIN,
    PRESET_KAMIN_SRC,
    IDB_CACHE_KEY,
    IDB_CURRENT_KEY,
    FIXED_PEIZAZHI_URL,
    FIXED_CARS_URL,
    FIXED_BING_URL,
    FIXED_THEME_URL,
    FIXED_ANIMALS_URL,
    FIXED_DYNAMIC_URL,
    FIXED_PICSUM_GRAY_URL,
    FIXED_PICSUM_COLOR_URL,
    FIXED_LOREMFLICKR_URL,
    initBuiltinMeta,
    getBuiltinMeta,
    getCustomServerSource,
    getCustomServerSourceUser,
    isCustomEnabled,
    updateServers,
    getRandomSource,
    fetchImage,
    getCache,
    saveCache,
    addToCache,
    getNextFromCache,
    resetCacheIndex,
    clearCache,
    testServerUrl,
    getPreloadImage: () => preloadImage,
    setPreloadImage: (v) => { preloadImage = v; },
    getPreloadAbortController: () => preloadAbortController,
    setPreloadAbortController: (v) => { preloadAbortController = v; },
    getActiveServers: () => activeServers
  };
})();