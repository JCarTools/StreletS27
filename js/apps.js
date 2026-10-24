/**********************************************
 * Модуль: Приложения
 * [FIX] Добавлена подробная диагностика получения приложений.
 **********************************************/

modules.apps = (function() {
  let currentPickerSlot = null;

  function safeParseApps(raw) {
    if (!raw) return [];
    let data = raw;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch { return []; }
    }
    if (data && data.section === 'apps' && Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      if (Array.isArray(data.apps)) return data.apps;
      if (Array.isArray(data.list)) return data.list;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.data)) return data.data;
    }
    return [];
  }

  async function openPickerForSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    if (!slotId) return;
    
    currentPickerSlot = slotId;
    const picker = document.getElementById("app_picker");
    const grid = document.getElementById("app-picker-grid");
    
    if (!picker || !grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Загрузка приложений...</div>';
    picker.classList.add('open');
    
    let apps = [];

    // 1. Пробуем requestLauncherCatalogAsync
    try {
      if (window.androidApi && typeof window.androidApi.requestLauncherCatalogAsync === 'function') {
        const catalogData = await android.getLauncherCatalogAsync(2000);
        if (typeof diag !== 'undefined') diag.log(`[Apps] Catalog response: ${JSON.stringify(catalogData).slice(0, 300)}`);
        if (catalogData) {
          apps = safeParseApps(catalogData);
        }
      }
    } catch (e) {
      if (typeof diag !== 'undefined') diag.log(`[Apps] Catalog error: ${e.message}`);
    }

    // 2. Если пусто — пробуем getUserApps
    if (!apps.length) {
      try {
        if (window.android && typeof android.getUserApps === 'function') {
          const appsRaw = android.getUserApps();
          if (typeof diag !== 'undefined') diag.log(`[Apps] getUserApps response: ${String(appsRaw).slice(0, 300)}`);
          apps = safeParseApps(appsRaw);
        }
      } catch (e) {
        if (typeof diag !== 'undefined') diag.log(`[Apps] getUserApps error: ${e.message}`);
      }
    }

    grid.innerHTML = '';
    if (!apps.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Нет установленных приложений</div>';
      return;
    }

    apps.forEach(app => {
      if (!app) return;
      const d = document.createElement('div');
      d.className = 'picker-item';

      const img = document.createElement('img');
      if (app.icon) {
         if (app.icon.startsWith('data:image') || app.icon.startsWith('http')) {
            img.src = app.icon;
         } else {
            img.src = `data:image/png;base64,${app.icon}`;
         }
      } else {
         img.src = 'icons/Default.svg';
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = app.name || app.label || app.package || 'Приложение';

      d.appendChild(img);
      d.appendChild(nameSpan);

      d.onclick = () => {
        storage.save(`app_slot_${currentPickerSlot}`, {
          package: app.package || app.packageName,
          name: app.name || app.label || 'Приложение',
          icon: app.icon
        });

        const slotEl = document.querySelector(`.app_slot[data-slot="${currentPickerSlot}"]`);
        if (slotEl) {
          slotEl.setAttribute('data-app-name', app.name || app.label || '');
          slotEl.innerHTML = `<img src="${img.src}">`;
          
          const showLabels = storage.load('setting_showAppLabels');
          if (showLabels) {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'app-label';
            labelSpan.textContent = app.name || app.label || '';
            slotEl.appendChild(labelSpan);
            slotEl.classList.add('has-label');
          }
        }

        picker.classList.remove('open');
        currentPickerSlot = null;
      };

      grid.appendChild(d);
    });
  }

  function renderSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    const saved = storage.load(`app_slot_${slotId}`);
    
    if (!saved) {
      slotElement.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
      slotElement.classList.remove('has-label');
      return;
    }
    
    let imgSrc = 'icons/Default.svg';
    if (saved.icon) {
       if (saved.icon.startsWith('data:image') || saved.icon.startsWith('http')) {
          imgSrc = saved.icon;
       } else {
          imgSrc = `data:image/png;base64,${saved.icon}`;
       }
    }

    slotElement.innerHTML = `<img src="${imgSrc}">`;
    slotElement.setAttribute('data-app-name', saved.name || '');
    
    const showLabels = storage.load('setting_showAppLabels');
    if (showLabels) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'app-label';
      labelSpan.textContent = saved.name || '';
      slotElement.appendChild(labelSpan);
      slotElement.classList.add('has-label');
    } else {
      slotElement.classList.remove('has-label');
    }
  }

  function updateAllSlots() {
    document.querySelectorAll('.app_slot').forEach(renderSlot);
  }

  function initSlots() {
    const slots = document.querySelectorAll('.app_slot');
    slots.forEach(slot => {
      const slotId = slot.dataset.slot;
      
      const oldClickHandler = slot._clickHandler;
      const oldLongPressHandler = slot._longPressHandler;
      if (oldClickHandler) slot.removeEventListener('click', oldClickHandler);
      if (oldLongPressHandler) slot.removeEventListener('contextmenu', oldLongPressHandler);
      
      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (slot.getAttribute('data-long-pressed') === 'true') {
          slot.removeAttribute('data-long-pressed');
          return;
        }
        
        const saved = storage.load(`app_slot_${slotId}`);
        if (!saved) {
          openPickerForSlot(slot);
        } else {
          if (saved.package && typeof android.runApp === 'function') {
            try {
              android.runApp(saved.package);
            } catch(e) {
              console.error('[Apps] Ошибка запуска:', e);
              if (typeof showToast === 'function') showToast('Не удалось запустить приложение', 2000);
            }
          }
        }
      };
      
      const longPressHandler = () => {
        openPickerForSlot(slot);
      };
      
      slot._clickHandler = clickHandler;
      slot._longPressHandler = longPressHandler;
      
      slot.addEventListener('click', clickHandler);
      makeLongPressable(slot, longPressHandler, { delay: 700, preventDefaultOnStart: false });
    });

    if (typeof attachOemTouchFeedback === 'function') {
      attachOemTouchFeedback('.app_slot');
    }
  }

  function reinitSlots() {
    setTimeout(() => {
      initSlots();
      updateAllSlots();
      const showLabels = storage.load('setting_showAppLabels');
      updateAppLabels(showLabels);
    }, 50);
  }

  function updateAppLabels(show) {
    const slots = document.querySelectorAll('.app_slot');
    slots.forEach(slot => {
      const saved = storage.load(`app_slot_${slot.dataset.slot}`);
      if (saved && show) {
        if (!slot.querySelector('.app-label')) {
          const labelSpan = document.createElement('span');
          labelSpan.className = 'app-label';
          labelSpan.textContent = saved.name || '';
          slot.appendChild(labelSpan);
          slot.classList.add('has-label');
        }
      } else if (!show) {
        const label = slot.querySelector('.app-label');
        if (label) label.remove();
        slot.classList.remove('has-label');
      }
    });
  }

  function initPicker() {
    const picker = document.getElementById("app_picker");
    const close = document.getElementById("app-picker-close");
    
    if (close) {
      const newClose = close.cloneNode(true);
      close.parentNode.replaceChild(newClose, close);
      newClose.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.classList.remove('open');
        currentPickerSlot = null;
      });
    }
    
    if (picker) {
      picker.addEventListener('click', (e) => {
        if (e.target === picker) {
          picker.classList.remove('open');
          currentPickerSlot = null;
        }
      });
    }
  }

  function init() {
    initPicker();
    initSlots();
    updateAllSlots();
    
    const showLabels = storage.load('setting_showAppLabels');
    if (showLabels !== undefined && showLabels !== null) {
      updateAppLabels(showLabels);
    }
  }

  return { 
    init,
    reinitSlots,
    updateAppLabels,
    renderSlot
  };
})();