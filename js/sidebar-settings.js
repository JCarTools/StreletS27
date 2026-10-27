/**********************************************
 * Модуль: Настройки автосмены обоев в сайдбаре.
 * [NEW] Добавлены серверы: Любовь, Легкий стиль, Милые животные, Динамичные.
 **********************************************/

modules.sidebarSettings = (function() {
  console.log('[SidebarSettings] Модуль загружен');

  // Ссылки на URL берём из модуля обоев
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

  // ---------- кнопка «Проверить все серверы» ----------
  function createGlobalCheckButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-toggle settings-check-all-btn';
    btn.textContent = 'Проверить все серверы';
    btn.id = 'btnCheckAllServers';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains('checking')) return;
      btn.classList.add('checking');
      btn.textContent = 'Проверка...';
      btn.style.borderColor = '';
      btn.style.color = '';
      
      const urlsToCheck = [];
      
      if (storage.load('setting_wallpaperCustomServerEnabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer', url: FIXED_PEIZAZHI_URL });
      if (storage.load('setting_wallpaperCustomServer2Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer2', url: FIXED_CARS_URL });
      if (storage.load('setting_wallpaperCustomServer3Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer3', url: FIXED_LOVE_URL });
      if (storage.load('setting_wallpaperCustomServer4Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer4', url: FIXED_THEME_URL });
      if (storage.load('setting_wallpaperCustomServer5Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer5', url: FIXED_ANIMALS_URL });
      if (storage.load('setting_wallpaperCustomServer6Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer6', url: FIXED_DYNAMIC_URL });
      
      const isUserCustom = storage.load('setting_user_custom_enabled') === true;
      const userCustomUrl = loadSetting('user_custom_url');
      if (isUserCustom && userCustomUrl) urlsToCheck.push({ id: 'user_custom', url: userCustomUrl });

      // Ставим часики ТОЛЬКО тем, кого проверяем
      Object.keys(serverStatuses).forEach(k => {
        if (urlsToCheck.find(u => u.id === k)) {
          serverStatuses[k] = '⏳...';
          const el = document.getElementById(`status_${k}`);
          if (el) { el.textContent = '⏳...'; el.style.color = 'rgba(255,255,255,0.6)'; }
        } else {
          serverStatuses[k] = '';
          const el = document.getElementById(`status_${k}`);
          if (el) { el.textContent = ''; el.style.color = ''; }
        }
      });

      let allOk = true;
      for (const item of urlsToCheck) {
        const res = await modules.wallpaper.testServerUrl(item.url);
        const el = document.getElementById(`status_${item.id}`);
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
    });
    return btn;
  }

  // ---------- кнопка «Очистить кэш автообоев» ----------
  function createClearAutoCacheButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-toggle settings-check-all-btn';
    btn.id = 'btnClearAutoCache';
    btn.textContent = '🧹 Очистить кэш автообоев';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
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
    });
    return btn;
  }

  // ---------- рендер аккордеона ----------
  function renderContent() {
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
    const currentAuto = storage.load('autoWallpaperInterval') || '5 минут';
    intervals.forEach(opt => {
      html += `<option value="${opt}" ${opt === currentAuto ? 'selected' : ''}>${opt}</option>`;
    });

    html += `</select>
        </div>
        <div class="sidebar-setting-row">
          <span class="sidebar-setting-label">Встроенные обои</span>
          <select class="settings-select" id="sidebarBuiltinInterval">`;

    const currentBuiltin = storage.load('builtinWallpaperInterval') || 'Никогда';
    intervals.forEach(opt => {
      html += `<option value="${opt}" ${opt === currentBuiltin ? 'selected' : ''}>${opt}</option>`;
    });

    html += `</select>
        </div>
        <div class="sidebar-setting-row" style="padding-bottom: 0.6rem;"></div>`;

    // Функция для генерации разметки сервера
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

    // Свой сервер
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
    `;

    const tempDiv = document.createElement('div');
    tempDiv.appendChild(createGlobalCheckButton());
    html += tempDiv.innerHTML;

    const tempDiv2 = document.createElement('div');
    tempDiv2.appendChild(createClearAutoCacheButton());
    html += `<div style="padding-top: 0.5rem;">${tempDiv2.innerHTML}</div>`;

    html += `
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
        saveSetting('autoWallpaperInterval', e.target.value);
      });
    }

    const builtinSelect = container.querySelector('#sidebarBuiltinInterval');
    if (builtinSelect) {
      builtinSelect.addEventListener('change', (e) => {
        saveSetting('builtinWallpaperInterval', e.target.value);
      });
    }

    // Обработка всех чекбоксов (как серверов, так и user_custom)
    container.querySelectorAll('.settings-server-cb[data-custom-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.customId;
        
        // Определяем базовый ключ (убираем Enabled)
        const baseId = key.replace('Enabled', '');
        saveSetting(key, cb.checked);

        // Подставляем фиксированные URL, если это кастомный сервер
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
        if (checkBtn.classList.contains('checking')) return;
        checkBtn.classList.add('checking');
        checkBtn.textContent = 'Проверка...';
        
        const urlsToCheck = [];
        if (storage.load('setting_wallpaperCustomServerEnabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer', url: FIXED_PEIZAZHI_URL });
        if (storage.load('setting_wallpaperCustomServer2Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer2', url: FIXED_CARS_URL });
        if (storage.load('setting_wallpaperCustomServer3Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer3', url: FIXED_LOVE_URL });
        if (storage.load('setting_wallpaperCustomServer4Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer4', url: FIXED_THEME_URL });
        if (storage.load('setting_wallpaperCustomServer5Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer5', url: FIXED_ANIMALS_URL });
        if (storage.load('setting_wallpaperCustomServer6Enabled') === true) urlsToCheck.push({ id: 'wallpaperCustomServer6', url: FIXED_DYNAMIC_URL });
        
        const isUserCustom = storage.load('setting_user_custom_enabled') === true;
        const uUrl = loadSetting('user_custom_url');
        if (isUserCustom && uUrl) urlsToCheck.push({ id: 'user_custom', url: uUrl });

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
          const res = await modules.wallpaper.testServerUrl(item.url);
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
        checkBtn.classList.remove('checking');
        checkBtn.textContent = allOk ? '✅ Все доступны' : '⚠️ Есть ошибки';
        setTimeout(() => {
          checkBtn.textContent = 'Проверить все серверы';
        }, 3000);
      });
    }

    const clearCacheBtn = container.querySelector('#btnClearAutoCache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clearCacheBtn.classList.contains('checking')) return;
        if (!confirm('Очистить кэш автообоев и подгрузить свежие с выбранных серверов?\n\nПолезно при смене тематики сервера.')) return;

        clearCacheBtn.classList.add('checking');
        clearCacheBtn.textContent = 'Очистка...';
        clearCacheBtn.style.borderColor = '';
        clearCacheBtn.style.color = '';

        try {
          if (modules.wallpaper && typeof modules.wallpaper.clearCache === 'function') {
            await modules.wallpaper.clearCache();
          }
          const mode = storage.load('wallpaperMode');
          if (mode === 'auto' && modules.wallpaper && typeof modules.wallpaper.setAuto === 'function') {
            await modules.wallpaper.setAuto(false);
          }
          clearCacheBtn.textContent = '✅ Кэш очищен';
          clearCacheBtn.style.borderColor = 'rgba(100,200,120,0.6)';
          clearCacheBtn.style.color = 'rgba(160,240,180,0.95)';
          if (typeof showToast === 'function') showToast('Кэш автообоев очищен', 2000);
        } catch (err) {
          console.warn('[SidebarSettings] clearCache error:', err);
          clearCacheBtn.textContent = '❌ Ошибка очистки';
          clearCacheBtn.style.borderColor = 'rgba(255,150,150,0.6)';
          clearCacheBtn.style.color = 'rgba(255,180,180,0.95)';
          if (typeof showToast === 'function') showToast('Не удалось очистить кэш', 2500);
        } finally {
          clearCacheBtn.classList.remove('checking');
          setTimeout(() => {
            clearCacheBtn.textContent = '🧹 Очистить кэш автообоев';
            clearCacheBtn.style.borderColor = '';
            clearCacheBtn.style.color = '';
          }, 3000);
        }
      });
    }
  }

  function render() {
    const container = document.getElementById('wallpaperAutoSettings');
    if (!container) return;

    // Инициализация дефолтных URL (только если их нет)
    if (!storage.load('setting_wallpaperCustomServer')) storage.save('setting_wallpaperCustomServer', FIXED_PEIZAZHI_URL);
    if (!storage.load('setting_wallpaperCustomServer2')) storage.save('setting_wallpaperCustomServer2', FIXED_CARS_URL);
    if (!storage.load('setting_wallpaperCustomServer3')) storage.save('setting_wallpaperCustomServer3', FIXED_LOVE_URL);
    if (!storage.load('setting_wallpaperCustomServer4')) storage.save('setting_wallpaperCustomServer4', FIXED_THEME_URL);
    if (!storage.load('setting_wallpaperCustomServer5')) storage.save('setting_wallpaperCustomServer5', FIXED_ANIMALS_URL);
    if (!storage.load('setting_wallpaperCustomServer6')) storage.save('setting_wallpaperCustomServer6', FIXED_DYNAMIC_URL);

    container.innerHTML = renderContent();
    bindEvents(container);
  }

  function init() {
    render();
  }

  return { init, render };
})();