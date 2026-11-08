/**********************************************
 * Модуль: Настройки автосмены обоев в сайдбаре.
 * [FIX] Убрана жёсткая зависимость от modules.wallpaper.FIXED_* на этапе
 *       загрузки модуля. Значения получаются лениво (при первом вызове
 *       render/renderContent), с fallback на локальные константы.
 *       Если modules.wallpaper не инициализирован — панель не падает.
 * [NEW] Клик по всей строке сервера (label-wrap) переключает чекбокс.
 * [FIX 6.1] Локальные loadSetting/saveSetting больше не дублируют логику:
 *       делегируют в modules.settingsCore (канонический путь). Для «сырых»
 *       ключей вне схемы (user_custom_url) используется settingsCore.loadSettingRaw.
 *       Fallback: modules.settings.loadSetting/saveSetting, затем прямой storage.
 **********************************************/

modules.sidebarSettings = (function() {
  console.log('[SidebarSettings] Модуль загружен');

  // [FIX] Локальные fallback-константы. Используются, если modules.wallpaperCore
  // или modules.wallpaper ещё не инициализированы.
  const DEFAULT_URLS = {
    PEIZAZHI: 'https://bingw.jasonzeng.dev/?resolution=1920x1080&index=random',
    CARS: 'https://api.icofun.cn/API/360bz.php?n=10&type=image',
    BING: 'https://bing.biturl.top/?resolution=1920&format=image&index=random',
    THEME: 'https://api.icofun.cn/API/360bz.php?n=5&type=image',
    ANIMALS: 'https://api.icofun.cn/API/360bz.php?n=8&type=image',
    DYNAMIC: 'https://api.icofun.cn/API/360bz.php?n=13&type=image',
    PICSUM_GRAY: 'https://picsum.photos/1920/1080?grayscale',
    PICSUM_COLOR: 'https://picsum.photos/1920/1080',
    LOREMFLICKR: 'https://loremflickrcn.com/1920/1080/landscape'
  };

  function getFixedUrls() {
    const core = (typeof modules !== 'undefined' && modules.wallpaperCore) ? modules.wallpaperCore : null;
    const facade = (typeof modules !== 'undefined' && modules.wallpaper) ? modules.wallpaper : null;
    return {
      peizazhi:   (core && core.FIXED_PEIZAZHI_URL)     || (facade && facade.FIXED_PEIZAZHI_URL)     || DEFAULT_URLS.PEIZAZHI,
      cars:       (core && core.FIXED_CARS_URL)         || (facade && facade.FIXED_CARS_URL)         || DEFAULT_URLS.CARS,
      bing:       (core && core.FIXED_BING_URL)         || (facade && facade.FIXED_BING_URL)         || DEFAULT_URLS.BING,
      theme:      (core && core.FIXED_THEME_URL)        || (facade && facade.FIXED_THEME_URL)        || DEFAULT_URLS.THEME,
      animals:    (core && core.FIXED_ANIMALS_URL)      || (facade && facade.FIXED_ANIMALS_URL)      || DEFAULT_URLS.ANIMALS,
      dynamic:    (core && core.FIXED_DYNAMIC_URL)      || (facade && facade.FIXED_DYNAMIC_URL)      || DEFAULT_URLS.DYNAMIC,
      picsumGray: (core && core.FIXED_PICSUM_GRAY_URL)  || (facade && facade.FIXED_PICSUM_GRAY_URL)  || DEFAULT_URLS.PICSUM_GRAY,
      picsumColor:(core && core.FIXED_PICSUM_COLOR_URL) || (facade && facade.FIXED_PICSUM_COLOR_URL) || DEFAULT_URLS.PICSUM_COLOR,
      lorem:      (core && core.FIXED_LOREMFLICKR_URL)  || (facade && facade.FIXED_LOREMFLICKR_URL)  || DEFAULT_URLS.LOREMFLICKR
    };
  }

  const serverStatuses = {
    'wallpaperCustomServer': '',
    'wallpaperCustomServer2': '',
    'wallpaperCustomServer3': '',
    'wallpaperCustomServer4': '',
    'wallpaperCustomServer5': '',
    'wallpaperCustomServer6': '',
    'wallpaperCustomServerGray': '',
    'wallpaperCustomServerPicsum': '',
    'wallpaperCustomServerLorem': '',
    'user_custom': ''
  };

  let isAccordionOpen = false;

  // [FIX 6.1] Единый канонический путь через settingsCore, с fallback.
  function loadSetting(key) {
    if (typeof modules !== 'undefined' && modules.settingsCore && typeof modules.settingsCore.loadSetting === 'function') {
      return modules.settingsCore.loadSetting(key);
    }
    if (typeof modules !== 'undefined' && modules.settings && typeof modules.settings.loadSetting === 'function') {
      return modules.settings.loadSetting(key);
    }
    const saved = storage.load('setting_' + key);
    return saved;
  }

  // [FIX 6.1] Для «сырых» ключей вне схемы — читаем storage напрямую,
  // без default и без учёта screenOrientation.
  function loadSettingRaw(key) {
    if (typeof modules !== 'undefined' && modules.settingsCore && typeof modules.settingsCore.loadSettingRaw === 'function') {
      return modules.settingsCore.loadSettingRaw(key);
    }
    return storage.load('setting_' + key);
  }

  function saveSetting(key, value) {
    if (typeof modules !== 'undefined' && modules.settingsCore && typeof modules.settingsCore.saveSetting === 'function') {
      modules.settingsCore.saveSetting(key, value);
      return;
    }
    if (typeof modules !== 'undefined' && modules.settings && typeof modules.settings.saveSetting === 'function') {
      modules.settings.saveSetting(key, value);
      return;
    }
    storage.save('setting_' + key, value);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function collectUrlsToCheck() {
    const urls = getFixedUrls();
    const out = [];
    if (storage.load('setting_wallpaperCustomServerEnabled') === true) out.push({ id: 'wallpaperCustomServer', url: urls.peizazhi });
    if (storage.load('setting_wallpaperCustomServer2Enabled') === true) out.push({ id: 'wallpaperCustomServer2', url: urls.cars });
    if (storage.load('setting_wallpaperCustomServer3Enabled') === true) out.push({ id: 'wallpaperCustomServer3', url: urls.bing });
    if (storage.load('setting_wallpaperCustomServer4Enabled') === true) out.push({ id: 'wallpaperCustomServer4', url: urls.theme });
    if (storage.load('setting_wallpaperCustomServer5Enabled') === true) out.push({ id: 'wallpaperCustomServer5', url: urls.animals });
    if (storage.load('setting_wallpaperCustomServer6Enabled') === true) out.push({ id: 'wallpaperCustomServer6', url: urls.dynamic });
    if (storage.load('setting_wallpaperCustomServerGrayEnabled') === true) out.push({ id: 'wallpaperCustomServerGray', url: urls.picsumGray });
    if (storage.load('setting_wallpaperCustomServerPicsumEnabled') === true) out.push({ id: 'wallpaperCustomServerPicsum', url: urls.picsumColor });
    if (storage.load('setting_wallpaperCustomServerLoremEnabled') === true) out.push({ id: 'wallpaperCustomServerLorem', url: urls.lorem });
    const isUserCustom = storage.load('setting_user_custom_enabled') === true;
    // [FIX 6.1] user_custom_url — вне схемы, читаем через loadSettingRaw.
    const userCustomUrl = loadSettingRaw('user_custom_url');
    if (isUserCustom && userCustomUrl) out.push({ id: 'user_custom', url: userCustomUrl });
    return out;
  }

  async function runServerCheck(container, btn) {
    if (btn.classList.contains('checking')) return;
    btn.classList.add('checking');
    btn.textContent = 'Проверка...';
    btn.style.borderColor = '';
    btn.style.color = '';

    const urlsToCheck = collectUrlsToCheck();

    Object.keys(serverStatuses).forEach(k => {
      if (urlsToCheck.find(u => u.id === k)) {
        serverStatuses[k] = '⏳...';
        const el = container.querySelector(`#status_${k}`);
        if (el) { el.textContent = '⏳...'; el.style.color = 'rgba(255,255,255,0.6)'; }
      } else {
        serverStatuses[k] = '';
        const el = container.querySelector(`#status_${k}`);
        if (el) { el.textContent = ''; el.style.color = ''; }
      }
    });

    let allOk = true;
    for (const item of urlsToCheck) {
      let res = { ok: false };
      if (modules.wallpaper && typeof modules.wallpaper.testServerUrl === 'function') {
        res = await modules.wallpaper.testServerUrl(item.url);
      } else if (modules.wallpaperCore && typeof modules.wallpaperCore.testServerUrl === 'function') {
        res = await modules.wallpaperCore.testServerUrl(item.url);
      }
      const el = container.querySelector(`#status_${item.id}`);
      if (res.ok) {
        serverStatuses[item.id] = '✅';
        if (el) { el.textContent = '✅'; el.style.color = 'rgba(160,240,180,0.95)'; }
      } else {
        serverStatuses[item.id] = '❌';
        if (el) { el.textContent = '❌'; el.style.color = 'rgba(255,150,150,0.95)'; }
        allOk = false;
      }
    }

    btn.classList.remove('checking');
    if (allOk) {
      btn.textContent = '✅ Все серверы доступны';
      btn.style.borderColor = 'rgba(100,200,120,0.6)';
      btn.style.color = 'rgba(160,240,180,0.95)';
    } else {
      btn.textContent = '⚠️ Некоторые недоступны';
      btn.style.borderColor = 'rgba(255,200,100,0.6)';
      btn.style.color = 'rgba(255,220,150,0.95)';
    }
    setTimeout(() => {
      btn.textContent = 'Проверить все серверы';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 4000);
  }

  async function runCacheClear(btn) {
    if (btn.classList.contains('checking')) return;
    if (!confirm('Очистить кэш автообоев и подгрузить свежие с выбранных серверов?\n\nПолезно при смене тематики сервера.')) return;

    btn.classList.add('checking');
    btn.textContent = 'Очистка...';
    btn.style.borderColor = '';
    btn.style.color = '';

    try {
      if (modules.wallpaper && typeof modules.wallpaper.clearCache === 'function') {
        await modules.wallpaper.clearCache();
      } else if (modules.wallpaperCore && typeof modules.wallpaperCore.clearCache === 'function') {
        await modules.wallpaperCore.clearCache();
      }
      const mode = storage.load('wallpaperMode');
      if (mode === 'auto' && modules.wallpaper && typeof modules.wallpaper.setAuto === 'function') {
        await modules.wallpaper.setAuto(false);
      }
      btn.textContent = '✅ Кэш очищен';
      btn.style.borderColor = 'rgba(100,200,120,0.6)';
      btn.style.color = 'rgba(160,240,180,0.95)';
      if (typeof showToast === 'function') showToast('Кэш автообоев очищен', 2000);
    } catch (err) {
      console.warn('[SidebarSettings] clearCache error:', err);
      btn.textContent = '❌ Ошибка очистки';
      btn.style.borderColor = 'rgba(255,150,150,0.6)';
      btn.style.color = 'rgba(255,180,180,0.95)';
      if (typeof showToast === 'function') showToast('Не удалось очистить кэш', 2500);
    } finally {
      btn.classList.remove('checking');
      setTimeout(() => {
        btn.textContent = '🧹 Очистить кэш автообоев';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 3000);
    }
  }

  function renderContent() {
    const currentAuto = storage.load('autoWallpaperInterval') || '5 минут';
    const currentBuiltin = storage.load('builtinWallpaperInterval') || 'Никогда';

    let html = `<div class="sidebar-settings-accordion ${isAccordionOpen ? 'open' : ''}">
      <div class="accordion-header" id="wmAccordionToggle">
        <span>⚙️ Настройки автосмены</span>
        <span class="accordion-icon">▼</span>
      </div>
      <div class="accordion-content">
        <div class="sidebar-setting-row">
          <span class="sidebar-setting-label">Интернет-обои</span>
          <select class="settings-select" id="sidebarAutoInterval">`;

    const intervals = ['Никогда', '30 секунд', '1 минута', '2 минуты', '5 минут', '10 минут', '30 минут', '1 час'];
    intervals.forEach(opt => {
      html += `<option value="${opt}" ${opt === currentAuto ? 'selected' : ''}>${opt}</option>`;
    });

    html += `</select>
        </div>
        <div class="sidebar-setting-row">
          <span class="sidebar-setting-label">Встроенные обои</span>
          <select class="settings-select" id="sidebarBuiltinInterval">`;

    intervals.forEach(opt => {
      html += `<option value="${opt}" ${opt === currentBuiltin ? 'selected' : ''}>${opt}</option>`;
    });

    html += `</select>
        </div>
        <div class="sidebar-setting-row" style="padding-bottom: 0.6rem;"></div>`;

    const serverRow = (id, label) => {
      const enabled = storage.load(`setting_${id}Enabled`) === true;
      return `
        <label class="settings-server-row settings-server-row--clickable" for="srv_cb_${id}">
          <input type="checkbox" id="srv_cb_${id}" class="settings-server-cb" data-custom-id="${id}Enabled" ${enabled ? 'checked' : ''}>
          <span class="settings-server-label">${label}</span>
          <div class="settings-server-middle"></div>
          <span class="settings-server-status" id="status_${id}">${serverStatuses[id] || ''}</span>
        </label>
      `;
    };

    html += serverRow('wallpaperCustomServer', 'Пейзажи');
    html += serverRow('wallpaperCustomServer2', 'Автомобили');
    html += serverRow('wallpaperCustomServer3', 'Бинг');
    html += serverRow('wallpaperCustomServer4', 'Легкий стиль');
    html += serverRow('wallpaperCustomServer5', 'Милые животные');
    html += serverRow('wallpaperCustomServer6', 'Динамичные');
    html += serverRow('wallpaperCustomServerGray', '⚫ Ч/Б (Picsum)');
    html += serverRow('wallpaperCustomServerPicsum', 'Picsum (цвет)');
    html += serverRow('wallpaperCustomServerLorem', 'LoremFlickr');

    const userCustomEnabled = storage.load('setting_user_custom_enabled') === true;
    const userCustomUrl = loadSettingRaw('user_custom_url') || '';
    html += `
        <label class="settings-server-row settings-server-row--clickable" for="srv_cb_user_custom_enabled">
          <input type="checkbox" id="srv_cb_user_custom_enabled" class="settings-server-cb" data-custom-id="user_custom_enabled" ${userCustomEnabled ? 'checked' : ''}>
          <span class="settings-server-label">Свой сервер</span>
          <span class="settings-server-status" id="status_user_custom" style="text-align: right;">${serverStatuses['user_custom'] || ''}</span>
        </label>
        <div class="settings-server-row" style="grid-template-columns: 1fr; padding-top: 0;">
          <div class="settings-server-middle" style="padding-left: 0;">
            <input type="text" class="settings-text-input" id="sidebarUserCustomServer" value="${escapeHtml(userCustomUrl)}" placeholder="https://..." style="width: 100%;">
          </div>
        </div>
        <div style="padding-top: 0.5rem;">
          <button type="button" class="settings-toggle settings-check-all-btn" id="btnCheckAllServers">Проверить все серверы</button>
        </div>
        <div style="padding-top: 0.5rem;">
          <button type="button" class="settings-toggle settings-check-all-btn" id="btnClearAutoCache">🧹 Очистить кэш автообоев</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  function bindEvents(container) {
    const accToggle = container.querySelector('#wmAccordionToggle');
    if (accToggle) {
      accToggle.addEventListener('click', () => {
        isAccordionOpen = !isAccordionOpen;
        container.innerHTML = renderContent();
        bindEvents(container);
      });
    }

    const autoSelect = container.querySelector('#sidebarAutoInterval');
    if (autoSelect) {
      autoSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (modules.wallpaper && typeof modules.wallpaper.setIntervalSetting === 'function') {
          modules.wallpaper.setIntervalSetting('auto', value);
        } else {
          storage.save('autoWallpaperInterval', value);
        }
      });
    }

    const builtinSelect = container.querySelector('#sidebarBuiltinInterval');
    if (builtinSelect) {
      builtinSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (modules.wallpaper && typeof modules.wallpaper.setIntervalSetting === 'function') {
          modules.wallpaper.setIntervalSetting('builtin', value);
        } else {
          storage.save('builtinWallpaperInterval', value);
        }
      });
    }

    container.querySelectorAll('.settings-server-cb[data-custom-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.customId;
        const baseId = key.replace('Enabled', '');
        // [FIX 6.1] Флаги серверов — «сырые» ключи вне схемы, пишем напрямую.
        storage.save(`setting_${key}`, cb.checked);

        const urls = getFixedUrls();
        if (baseId === 'wallpaperCustomServer') storage.save('setting_wallpaperCustomServer', urls.peizazhi);
        else if (baseId === 'wallpaperCustomServer2') storage.save('setting_wallpaperCustomServer2', urls.cars);
        else if (baseId === 'wallpaperCustomServer3') storage.save('setting_wallpaperCustomServer3', urls.bing);
        else if (baseId === 'wallpaperCustomServer4') storage.save('setting_wallpaperCustomServer4', urls.theme);
        else if (baseId === 'wallpaperCustomServer5') storage.save('setting_wallpaperCustomServer5', urls.animals);
        else if (baseId === 'wallpaperCustomServer6') storage.save('setting_wallpaperCustomServer6', urls.dynamic);
        else if (baseId === 'wallpaperCustomServerGray') storage.save('setting_wallpaperCustomServerGray', urls.picsumGray);
        else if (baseId === 'wallpaperCustomServerPicsum') storage.save('setting_wallpaperCustomServerPicsum', urls.picsumColor);
        else if (baseId === 'wallpaperCustomServerLorem') storage.save('setting_wallpaperCustomServerLorem', urls.lorem);

        if (baseId === 'user_custom') {
          if (modules.wallpaper && typeof modules.wallpaper.updateServers === 'function') {
            modules.wallpaper.updateServers(storage.load('wallpaperServers'));
          }
        }
      });
    });

    const userCustomInput = container.querySelector('#sidebarUserCustomServer');
    if (userCustomInput) {
      let timer;
      userCustomInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          // [FIX 6.1] user_custom_url — вне схемы, пишем напрямую через storage
          // (saveSetting-обёртка добавит префикс setting_).
          storage.save('setting_user_custom_url', userCustomInput.value.trim());
        }, 600);
      });
    }

    const checkBtn = container.querySelector('#btnCheckAllServers');
    if (checkBtn) {
      checkBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await runServerCheck(container, checkBtn);
      });
    }

    const clearCacheBtn = container.querySelector('#btnClearAutoCache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await runCacheClear(clearCacheBtn);
      });
    }
  }

  function render() {
    const container = document.getElementById('wallpaperAutoSettings');
    if (!container) return;

    // [FIX] Ленивая инициализация URL при первом рендере.
    const urls = getFixedUrls();
    if (!storage.load('setting_wallpaperCustomServer')) storage.save('setting_wallpaperCustomServer', urls.peizazhi);
    if (!storage.load('setting_wallpaperCustomServer2')) storage.save('setting_wallpaperCustomServer2', urls.cars);
    if (!storage.load('setting_wallpaperCustomServer3')) storage.save('setting_wallpaperCustomServer3', urls.bing);
    if (!storage.load('setting_wallpaperCustomServer4')) storage.save('setting_wallpaperCustomServer4', urls.theme);
    if (!storage.load('setting_wallpaperCustomServer5')) storage.save('setting_wallpaperCustomServer5', urls.animals);
    if (!storage.load('setting_wallpaperCustomServer6')) storage.save('setting_wallpaperCustomServer6', urls.dynamic);
    if (!storage.load('setting_wallpaperCustomServerGray')) storage.save('setting_wallpaperCustomServerGray', urls.picsumGray);
    if (!storage.load('setting_wallpaperCustomServerPicsum')) storage.save('setting_wallpaperCustomServerPicsum', urls.picsumColor);
    if (!storage.load('setting_wallpaperCustomServerLorem')) storage.save('setting_wallpaperCustomServerLorem', urls.lorem);

    if (!storage.load('autoWallpaperInterval')) storage.save('autoWallpaperInterval', '5 минут');
    if (!storage.load('builtinWallpaperInterval')) storage.save('builtinWallpaperInterval', 'Никогда');

    container.innerHTML = renderContent();
    bindEvents(container);
  }

  function collapse() {
    if (!isAccordionOpen) return;
    isAccordionOpen = false;
    const container = document.getElementById('wallpaperAutoSettings');
    if (container) {
      container.innerHTML = renderContent();
      bindEvents(container);
    }
  }

  function init() {
    render();
  }

  return { init, render, collapse };
})();