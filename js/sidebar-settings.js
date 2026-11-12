/**********************************************
 * Модуль: Настройки автосмены обоев в сайдбаре.
 * [FIX 26] Вызываем модуль очистки кэша (без параметров, тексты внутри).
 **********************************************/

modules.sidebarSettings = (function() {
  console.log('[SidebarSettings] Модуль загружен');

  const serverStatuses = {};
  let isAccordionOpen = false;

  function loadSetting(key) {
    if (typeof modules !== 'undefined' && modules.settingsCore && typeof modules.settingsCore.loadSetting === 'function') {
      return modules.settingsCore.loadSetting(key);
    }
    if (typeof modules !== 'undefined' && modules.settings && typeof modules.settings.loadSetting === 'function') {
      return modules.settings.loadSetting(key);
    }
    return storage.load('setting_' + key);
  }

  function loadSettingRaw(key) {
    if (typeof modules !== 'undefined' && modules.settingsCore && typeof modules.settingsCore.loadSettingRaw === 'function') {
      return modules.settingsCore.loadSettingRaw(key);
    }
    return storage.load('setting_' + key);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function collectUrlsToCheck() {
    const loaded = modules.wallpaperCore.getLoadedServers();
    const out = [];
    
    loaded.forEach((srv, index) => {
      const id = `srv_${index}`;
      if (storage.load(`setting_${id}Enabled`) === true) {
        out.push({ id: id, url: srv.url });
      }
    });

    const isUserCustom = storage.load('setting_user_custom_enabled') === true;
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

    container.querySelectorAll('.settings-server-status').forEach(el => {
      el.textContent = '';
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
        if (el) { el.textContent = '✅'; el.style.color = 'rgba(160,240,180,0.95)'; }
      } else {
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

    // [FIX 26] Вызываем модуль очистки кэша
    const confirmed = await modules.cacheClearModal.ask();
    if (!confirmed) return;

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

    const loaded = modules.wallpaperCore.getLoadedServers();
    
    const serverRow = (id, label) => {
      const enabled = storage.load(`setting_${id}Enabled`) === true;
      return `
        <label class="settings-server-row settings-server-row--clickable" for="srv_cb_${id}">
          <input type="checkbox" id="srv_cb_${id}" class="settings-server-cb" data-custom-id="${id}Enabled" ${enabled ? 'checked' : ''}>
          <span class="settings-server-label">${escapeHtml(label)}</span>
          <div class="settings-server-middle"></div>
          <span class="settings-server-status" id="status_${id}"></span>
        </label>
      `;
    };

    if (loaded.length === 0) {
      html += `<div style="padding: 10px; color: rgba(255,255,255,0.5); text-align: center; font-size: 0.8rem;">Нет серверов в servers.txt</div>`;
    } else {
      loaded.forEach((srv, index) => {
        html += serverRow(`srv_${index}`, srv.name);
      });
    }

    const userCustomEnabled = storage.load('setting_user_custom_enabled') === true;
    const userCustomUrl = loadSettingRaw('user_custom_url') || '';
    html += `
        <label class="settings-server-row settings-server-row--clickable" for="srv_cb_user_custom_enabled">
          <input type="checkbox" id="srv_cb_user_custom_enabled" class="settings-server-checkbox" data-custom-id="user_custom_enabled" ${userCustomEnabled ? 'checked' : ''}>
          <span class="settings-server-label">Свой сервер</span>
          <span class="settings-server-status" id="status_user_custom" style="text-align: right;"></span>
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
        storage.save(`setting_${key}`, cb.checked);

        if (modules.wallpaper && typeof modules.wallpaper.updateServers === 'function') {
          modules.wallpaper.updateServers(storage.load('wallpaperServers'));
        }
      });
    });

    const userCustomInput = container.querySelector('#sidebarUserCustomServer');
    if (userCustomInput) {
      let timer;
      userCustomInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
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