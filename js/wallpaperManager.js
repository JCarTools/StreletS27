/**********************************************
 * Модуль: Управление статическими обоями
 * [FIX] Баг #7: рендер user-обоев через Promise.all (без N+1).
 * [FIX] Лимит на файл: 10 МБ, сжатие до 3.5 МБ.
 * [NEW] В загрузке обоев из Downloads клик по строке с файлом теперь ставит галочку.
 **********************************************/

modules.wallpaperManager = (function() {
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const TARGET_FILE_SIZE = 3.5 * 1024 * 1024;
  const MAX_USER_WALLPAPERS = 20;
  const MAX_TOTAL_SIZE = 80 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

  const IDB_CUSTOM_WALLPAPERS_KEY = 'wallpaper_custom_list';
  const IDB_CUSTOM_WALLPAPER_DATA_PREFIX = 'wallpaper_custom_data_';

  let overlay = null;
  let activeBlobUrls = [];

  function revokeAllBlobUrls() {
    activeBlobUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
    activeBlobUrls = [];
  }

  function makeBlobUrlFromBase64(base64) {
    if (!base64) return '';
    try {
      const commaIdx = base64.indexOf(',');
      if (commaIdx < 0) return '';
      const header = base64.slice(0, commaIdx);
      const data = base64.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:(image\/[^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const binary = atob(data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      activeBlobUrls.push(url);
      return url;
    } catch (e) {
      return '';
    }
  }

  async function getCustomList() {
    try {
      const raw = await idbStore.get(IDB_CUSTOM_WALLPAPERS_KEY);
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function estimateBytesFromBase64(base64) {
    if (!base64 || typeof base64 !== 'string') return 0;
    const commaIdx = base64.indexOf(',');
    const data = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;
    let len = data.length;
    let padding = 0;
    if (data.endsWith('==')) padding = 2;
    else if (data.endsWith('=')) padding = 1;
    return Math.floor(len * 3 / 4) - padding;
  }

  function compressImage(base64Str, maxSizeBytes) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (estimateBytesFromBase64(base64Str) < maxSizeBytes) {
          resolve(base64Str);
          return;
        }

        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > 2560) {
           const ratio = 2560 / width;
           width = 2560;
           height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (estimateBytesFromBase64(result) > maxSizeBytes && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      img.onerror = () => resolve(null);
      img.src = base64Str;
    });
  }

  async function computeTotalSize(list) {
    let total = 0;
    for (const item of list) {
      const data = await idbStore.get(IDB_CUSTOM_WALLPAPER_DATA_PREFIX + item.id);
      if (data) total += estimateBytesFromBase64(data);
    }
    return total;
  }

  async function addWallpaperFromBase64(name, base64) {
    const list = await getCustomList();
    if (list.length >= MAX_USER_WALLPAPERS) {
      throw new Error(`Достигнут лимит: ${MAX_USER_WALLPAPERS} пользовательских обоев.`);
    }
    const currentSize = await computeTotalSize(list);
    const newSize = estimateBytesFromBase64(base64);
    if (currentSize + newSize > MAX_TOTAL_SIZE) {
      throw new Error(`Превышен общий лимит хранения (80 МБ).`);
    }
    const meta = await modules.wallpaper.saveUserWallpaperInternal(name, base64);
    if (!meta) throw new Error('Не удалось сохранить файл');
    return meta;
  }

  function openDownloadsPicker() {
    const picker = document.createElement('div');
    picker.className = 'wm-picker-overlay';
    const content = document.createElement('div');
    content.className = 'wm-picker-content';
    
    const renderLoading = (text) => {
      content.innerHTML = `
        <div class="wm-picker-header">
          <span>Чтение папки Downloads...</span>
          <button class="wm-picker-close" type="button">✕</button>
        </div>
        <div class="wm-picker-body" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.7);">
          ${text}
        </div>
      `;
      content.querySelector('.wm-picker-close').addEventListener('click', () => picker.remove());
    };
    
    const renderError = (errorText) => {
      content.innerHTML = `
        <div class="wm-picker-header">
          <span>Ошибка</span>
          <button class="wm-picker-close" type="button">✕</button>
        </div>
        <div class="wm-picker-body" style="padding: 2rem; text-align: center; color: rgba(255,100,100,0.9);">
          <div style="margin-bottom: 1rem;">${errorText}</div>
        </div>
      `;
      content.querySelector('.wm-picker-close').addEventListener('click', () => picker.remove());
    };

    renderLoading('Пожалуйста, подождите...');
    picker.appendChild(content);
    document.body.appendChild(picker);

    setTimeout(() => {
      let files = [];
      try {
        if (typeof android !== 'undefined' && typeof android.getFileList === 'function') {
          const raw = android.getFileList();
          if (!raw || raw === 'null' || raw === 'undefined') {
            renderError('Мост JCarTools вернул пустой ответ.');
            return;
          }
          if (Array.isArray(raw)) files = raw;
          else if (typeof raw === 'string') files = JSON.parse(raw);
        } else {
          renderError('Метод getFileList недоступен.');
          return;
        }
      } catch (e) {
        renderError(`Ошибка парсинга: ${e.message}`);
        return;
      }

      if (!Array.isArray(files) || files.length === 0) {
        renderError('В папке Downloads нет файлов.');
        return;
      }

      const images = files.filter(f => f && f.name && ALLOWED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)));
      
      if (images.length === 0) {
        renderError(`В папке найдено ${files.length} файлов, но ни один не является картинкой.`);
        return;
      }

      content.innerHTML = `
        <div class="wm-picker-header">
          <span>Выберите изображения (${images.length})</span>
          <button class="wm-picker-close" type="button">✕</button>
        </div>
        <div class="wm-picker-body">
          <div class="wm-picker-grid"></div>
        </div>
        <div class="wm-picker-footer">
          <button class="wm-btn wm-btn-cancel" type="button">Отмена</button>
          <button class="wm-btn wm-btn-add" type="button" disabled>Добавить (0)</button>
        </div>
      `;
      
      const grid = content.querySelector('.wm-picker-grid');
      const addBtn = content.querySelector('.wm-btn-add');
      const cancelBtn = content.querySelector('.wm-btn-cancel');
      const closeBtn = content.querySelector('.wm-picker-close');

      // ИСПОЛЬЗУЕМ <label> ВМЕСТО <div> ДЛЯ ВОЗМОЖНОСТИ КЛИКАТЬ ПО ВСЕЙ СТРОКЕ
      images.forEach(img => {
        const item = document.createElement('label');
        item.className = 'wm-picker-item';
        
        const sizeMb = (img.size / (1024 * 1024)).toFixed(2);
        const tooLarge = img.size > MAX_FILE_SIZE;
        
        item.innerHTML = `
          <div class="wm-picker-cb-wrap">
            <input type="checkbox" class="wm-picker-cb" data-name="${img.name}" ${tooLarge ? 'disabled' : ''}>
          </div>
          <div class="wm-picker-name">${img.name}</div>
          <div class="wm-picker-size ${tooLarge ? 'wm-over' : ''}">${sizeMb} МБ${tooLarge ? ' (>10МБ)' : ''}</div>
        `;
        grid.appendChild(item);
      });

      const updateCount = () => {
        const checked = grid.querySelectorAll('.wm-picker-cb:checked').length;
        addBtn.textContent = `Добавить (${checked})`;
        addBtn.disabled = checked === 0;
      };
      grid.addEventListener('change', (e) => {
        if (e.target.classList.contains('wm-picker-cb')) updateCount();
      });

      const close = () => picker.remove();
      cancelBtn.addEventListener('click', close);
      closeBtn.addEventListener('click', close);

      addBtn.addEventListener('click', async () => {
        const checked = Array.from(grid.querySelectorAll('.wm-picker-cb:checked'));
        if (!checked.length) return;
        
        addBtn.disabled = true;
        addBtn.textContent = 'Сжатие и загрузка...';
        let added = 0;
        const errors = [];

        for (const cb of checked) {
          const name = cb.getAttribute('data-name');
          try {
            const rawBase64 = android.getFile(name);
            if (!rawBase64) {
              errors.push(`${name}: пустой файл`);
              continue;
            }
            
            const mime = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            let base64 = `data:${mime};base64,${rawBase64}`;
            
            if (estimateBytesFromBase64(base64) > TARGET_FILE_SIZE) {
              const compressed = await compressImage(base64, TARGET_FILE_SIZE);
              if (compressed) base64 = compressed;
              else { errors.push(`${name}: ошибка сжатия`); continue; }
            }
            
            await addWallpaperFromBase64(name, base64);
            added++;
          } catch (e) {
            errors.push(`${name}: ${e.message}`);
          }
        }
        
        close();
        await modules.wallpaper.rebuildStaticWallpapers();
        renderBody();
        if (typeof window.rebuildSidebarGrid === 'function') window.rebuildSidebarGrid();
        
        if (errors.length) alert(`Добавлено: ${added}\nОшибки:\n${errors.join('\n')}`);
        else if (added > 0 && typeof showToast === 'function') showToast(`Добавлено: ${added}`, 2000);
      });
    }, 100);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'wm-overlay';
    overlay.innerHTML = `
      <div class="wm-content">
        <div class="wm-header">
          <h3>Управление обоями</h3>
          <button class="wm-close" type="button" aria-label="Закрыть">✕</button>
        </div>
        <div class="wm-toolbar">
          <div class="wm-toolbar-buttons">
            <button class="wm-btn wm-btn-add" type="button" id="wmAddDlBtn">📥 Загрузить из Downloads</button>
          </div>
          <span class="wm-counter" id="wmCounter"></span>
        </div>
        <div class="wm-body" id="wmBody"></div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.wm-close').addEventListener('click', close);
    
    overlay.querySelector('#wmAddDlBtn').addEventListener('click', () => {
      if (typeof IS_ANDROID !== 'undefined' && !IS_ANDROID) {
        alert('Загрузка доступна только на устройстве.');
        return;
      }
      openDownloadsPicker();
    });
    document.body.appendChild(overlay);
  }

  async function renderBody() {
    if (!overlay) return;
    revokeAllBlobUrls();
    const body = overlay.querySelector('#wmBody');
    const counter = overlay.querySelector('#wmCounter');
    if (!body) return;

    const builtinMeta = modules.wallpaper.getBuiltinMeta();
    const hidden = modules.wallpaper.getHiddenBuiltins();
    const userList = await getCustomList();

    const visibleBuiltins = builtinMeta.filter(b => !hidden.includes(b.id));
    const hiddenBuiltins = builtinMeta.filter(b => hidden.includes(b.id));

    counter.textContent = `Пользовательских: ${userList.length} / ${MAX_USER_WALLPAPERS}`;

    const userEntries = await Promise.all(userList.map(async (u) => {
      const data = await idbStore.get(IDB_CUSTOM_WALLPAPER_DATA_PREFIX + u.id);
      const url = data ? makeBlobUrlFromBase64(data) : '';
      return { u, url };
    }));

    let html = '';

    html += `<div class="wm-section-title">Ваши обои (${userList.length})</div>`;
    if (userList.length === 0) {
      html += `<div class="wm-empty">Пока нет загруженных обоев</div>`;
    } else {
      html += `<div class="wm-grid">`;
      for (const { u, url } of userEntries) {
        html += `
          <div class="wm-item" data-id="${u.id}" data-type="user">
            <div class="wm-thumb">${url ? `<img src="${url}" alt="">` : ''}</div>
            <div class="wm-name">${escapeHtml(u.name)}</div>
            <button class="wm-del" type="button" data-del-id="${u.id}">Удалить</button>
          </div>
        `;
      }
      html += `</div>`;
    }

    html += `<div class="wm-section-title">Встроенные обои (${visibleBuiltins.length})</div>`;
    if (visibleBuiltins.length === 0) {
      html += `<div class="wm-empty">Все встроенные обои скрыты</div>`;
    } else {
      html += `<div class="wm-grid">`;
      for (const b of visibleBuiltins) {
        html += `
          <div class="wm-item" data-id="${b.id}" data-type="builtin">
            <div class="wm-thumb"><img src="${b.src}" alt=""></div>
            <div class="wm-name">${escapeHtml(b.name)}</div>
            <button class="wm-del" type="button" data-hide-id="${b.id}">Скрыть</button>
          </div>
        `;
      }
      html += `</div>`;
    }

    if (hiddenBuiltins.length > 0) {
      html += `<div class="wm-section-title">Скрытые встроенные (${hiddenBuiltins.length})</div>`;
      html += `<div class="wm-grid">`;
      for (const b of hiddenBuiltins) {
        html += `
          <div class="wm-item wm-item-hidden" data-id="${b.id}" data-type="builtin">
            <div class="wm-thumb"><img src="${b.src}" alt=""></div>
            <div class="wm-name">${escapeHtml(b.name)}</div>
            <button class="wm-del wm-restore" type="button" data-restore-id="${b.id}">Восстановить</button>
          </div>
        `;
      }
      html += `</div>`;
    }

    body.innerHTML = html;

    body.querySelectorAll('[data-del-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-id');
        if (!confirm('Удалить эти обои?')) return;
        try {
          await modules.wallpaper.deleteUserWallpaperInternal(id);
          await modules.wallpaper.rebuildStaticWallpapers();
          renderBody();
          if (typeof window.rebuildSidebarGrid === 'function') window.rebuildSidebarGrid();
          if (typeof showToast === 'function') showToast('Обои удалены', 1500);
        } catch (err) { alert('Ошибка удаления'); }
      });
    });

    body.querySelectorAll('[data-hide-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-hide-id');
        if (!confirm('Скрыть эти обои?')) return;
        try {
          modules.wallpaper.hideBuiltinInternal(id);
          await modules.wallpaper.rebuildStaticWallpapers();
          renderBody();
          if (typeof window.rebuildSidebarGrid === 'function') window.rebuildSidebarGrid();
          if (typeof showToast === 'function') showToast('Обои скрыты', 1500);
        } catch (err) { alert('Ошибка'); }
      });
    });

    body.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-restore-id');
        try {
          modules.wallpaper.restoreBuiltinInternal(id);
          await modules.wallpaper.rebuildStaticWallpapers();
          renderBody();
          if (typeof window.rebuildSidebarGrid === 'function') window.rebuildSidebarGrid();
          if (typeof showToast === 'function') showToast('Обои восстановлены', 1500);
        } catch (err) { alert('Ошибка'); }
      });
    });
  }

  function open() {
    if (overlay) { overlay.remove(); overlay = null; }
    buildOverlay();
    renderBody();
  }

  function close() {
    revokeAllBlobUrls();
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function init() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const kam = document.getElementById('presetVideoKamin');
    if (!kam) return;
    if (document.getElementById('openWallpaperManager')) return;

    const btn = document.createElement('div');
    btn.className = 'custom-wallpaper-btn';
    btn.id = 'openWallpaperManager';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-5 5 5h-4v4h-2z"/>
      </svg>
      Управление обоями
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.remove('open');
      open();
    });
    kam.parentNode.appendChild(btn);
    attachOemTouchFeedback(btn);
  }

  return { init, open, close };
})();