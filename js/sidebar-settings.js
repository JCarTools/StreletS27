/**********************************************
 * Модуль: Настройки автосмены обоев в сайдбаре.
 * [FIX] Интервалы пишутся через modules.wallpaper.setIntervalSetting.
 * [NEW] При закрытии сайдбара аккордеон автоматически сворачивается.
 * [FIX] Убран двойной addEventListener на кнопках проверки серверов.
 **********************************************/

modules.sidebarSettings = (function() {
  console.log('[SidebarSettings] Модуль загружен');

  const FIXED_PEIZAZHI_URL = modules.wallpaper.FIXED_PEIZAZHI_URL;
  const FIXED_CARS_URL = modules.wallpaper.FIXED_CARS_URL;
  const FIXED_LOVE_URL = modules.wallpaper.FIXED_LOVE_URL;
  const FIXED_THEME_URL = modules.wallpaper.FIXED_THEME_URL;
  const FIXED_ANIMALS_URL = modules.wallpaper.FIXED_ANIMALS_URL;
  const FIXED_DYNAMIC_URL = modules.wallpaper.FIXED_DYNAMIC_URL;

  const serverStatuses = {
    'wallpaperCustomServer': '',
    'wallpaperCustomServer2': '',
    'wallpaperCustomServer3': '',
    'wallpaperCustomServer4': '',
    'wallpaperCustomServer5': '',
    'wallpaperCustomServer6': '',
    'user_custom': ''
  };

  let isAccordionOpen = false;

  const loadSetting = (key) => modules.settings.loadSetting(key);
  const saveSetting = (key, value) => modules.settings.saveSetting(key, value);

  function collectUrlsToCheck() {
    const urls = [];
    if (storage.load('setting_wallpaperCustomServerEnabled') === true) urls.push({ id: 'wallpaperCustomServer', url: FIXED_PEIZAZHI_URL });
    if (storage.load('setting_wallpaperCustomServer2Enabled') === true) urls.push({ id: 'wallpaperCustomServer2', url: FIXED_CARS_URL });
    if (storage.load('setting_wallpaperCustomServer3Enabled') === true) urls.push({ id: 'wallpaperCustomServer3', url: FIXED_LOVE_URL });
    if (storage.load('setting_wallpaperCustomServer4Enabled') === true) urls.push({ id: 'wallpaperCustomServer4', url: FIXED_THEME_URL });
    if (storage.load('setting_wallpaperCustomServer5Enabled') === true) urls.push({ id: 'wallpaperCustomServer5', url: FIXED_ANIMALS_URL });
    if (storage.load('setting_wallpaperCustomServer6Enabled') === true) urls.push({ id: 'wallpaperCustomServer6', url: FIXED_DYNAMIC_URL });
    const isUserCustom = storage.load('setting_user_custom_enabled') === true;
    const userCustomUrl = loadSetting('user_custom_url');
    if (isUserCustom && userCustomUrl) urls.push({ id: 'user_custom', url: userCustomUrl });
    return urls;
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
        const el = container.querySelector(`#status_${k}`) || document.getElementById(`status_${k}`);
        if (el) { el.textContent = '⏳...'; el.style.color = 'rgba(255,255,255,0.6)'; }
      } else {
        serverStatuses[k] = '';
        const el = container.querySelector(`#status_${k}`) || document.getElementById(`status_${k}`);
        if (el) { el.textContent = ''; el.style.color = ''; }
      }
    });

    let allOk = true;
    for (const item of urlsToCheck) {
      const res = await modules.wallpaper.testServerUrl(item.url);
      const el = container.querySelector(`#status_${item.id}`) || document.getElementById(`status_${item.id}`);
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
        <div class="settings-server-row">
          <input type="checkbox" class="settings-server-cb" data-custom-id="${id}Enabled" ${enabled ? 'checked' : ''}>
          <span class="settings-server-label">${label}</span>
          <div class="settings-server-middle"></div>
          <span class="settings-server-status" id="status_${id}">${serverStatuses[id] || ''}</span>
        </div>
      `;
    };

    html += serverRow('wallpaperCustomServer', 'Пейзажи');
    html += serverRow('wallpaperCustomServer2', 'Автомобили');
    html += serverRow('wallpaperCustomServer3', 'Любовь');
    html += serverRow('wallpaperCustomServer4', 'Легкий стиль');
    html += serverRow('wallpaperCustomServer5', 'Милые животные');
    html += serverRow('wallpaperCustomServer6', 'Динамичные');

    const userCustomEnabled = storage.load('setting_user_custom_enabled') === true;
    const userCustomUrl = loadSetting('user_custom_url') || '';
    html += `
        <div class="settings-server-row" style="grid-template-columns: 24px 1fr auto; padding-bottom: 0.5rem;">
          <input type="checkbox" class="settings-server-cb" data-custom-id="user_custom_enabled" ${userCustomEnabled ? 'checked' : ''}>
          <span class="settings-server-label">Свой сервер</span>
          <span class="settings-server-status" id="status_user_custom" style="text-align: right;">${serverStatuses['user_custom'] || ''}</span>
        </div>
        <div class="settings-server-row" style="grid-template-columns: 1fr; padding-top: 0;">
          <div class="settings-server-middle" style="padding-left: 0;">
            <input type="text" class="settings-text-input" id="sidebarUserCustomServer" value="${userCustomUrl}" placeholder="https://..." style="width: 100%;">
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
        saveSetting(key, cb.checked);

        if (baseId === 'wallpaperCustomServer') storage.save('setting_wallpaperCustomServer', FIXED_PEIZAZHI_URL);
        else if (baseId === 'wallpaperCustomServer2') storage.save('setting_wallpaperCustomServer2', FIXED_CARS_URL);
        else if (baseId === 'wallpaperCustomServer3') storage.save('setting_wallpaperCustomServer3', FIXED_LOVE_URL);
        else if (baseId === 'wallpaperCustomServer4') storage.save('setting_wallpaperCustomServer4', FIXED_THEME_URL);
        else if (baseId === 'wallpaperCustomServer5') storage.save('setting_wallpaperCustomServer5', FIXED_ANIMALS_URL);
        else if (baseId === 'wallpaperCustomServer6') storage.save('setting_wallpaperCustomServer6', FIXED_DYNAMIC_URL);

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
          saveSetting('user_custom_url', userCustomInput.value.trim());
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

    if (!storage.load('setting_wallpaperCustomServer')) storage.save('setting_wallpaperCustomServer', FIXED_PEIZAZHI_URL);
    if (!storage.load('setting_wallpaperCustomServer2')) storage.save('setting_wallpaperCustomServer2', FIXED_CARS_URL);
    if (!storage.load('setting_wallpaperCustomServer3')) storage.save('setting_wallpaperCustomServer3', FIXED_LOVE_URL);
    if (!storage.load('setting_wallpaperCustomServer4')) storage.save('setting_wallpaperCustomServer4', FIXED_THEME_URL);
    if (!storage.load('setting_wallpaperCustomServer5')) storage.save('setting_wallpaperCustomServer5', FIXED_ANIMALS_URL);
    if (!storage.load('setting_wallpaperCustomServer6')) storage.save('setting_wallpaperCustomServer6', FIXED_DYNAMIC_URL);

    if (!storage.load('autoWallpaperInterval')) {
      storage.save('autoWallpaperInterval', '5 минут');
    }
    if (!storage.load('builtinWallpaperInterval')) {
      storage.save('builtinWallpaperInterval', 'Никогда');
    }

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