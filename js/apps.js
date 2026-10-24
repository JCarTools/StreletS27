/**********************************************
 * Модуль: Приложения
 * [FIX] Обработка поточных событий launcherCatalog.
 * [FIX] Ждем "done: true" или таймаут 2 сек, чтобы завершить загрузку.
 **********************************************/

modules.apps = (function() {
  let currentPickerSlot = null;
  let currentPickerGrid = null;
  let pendingApps = [];
  let isPickerOpen = false;
  let loadTimeout = null;
  let renderPending = false;

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      renderAppsInGrid();
    });
  }

  function renderAppsInGrid() {
    if (!currentPickerGrid) return;
    
    if (pendingApps.length === 0) {
      currentPickerGrid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Нет установленных приложений</div>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    pendingApps.forEach(app => {
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
        if (!currentPickerSlot) return;
        
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

        closePicker();
      };

      fragment.appendChild(d);
    });
    
    currentPickerGrid.innerHTML = '';
    currentPickerGrid.appendChild(fragment);
  }

  // Вызывается из main.js при событии launcherCatalog
  function handleLauncherCatalog(raw) {
    if (!isPickerOpen) return; // Игнорируем, если пикер закрыт

    let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data) return;

    // Если пришел пакет с приложениями
    if (data.section === 'apps' && Array.isArray(data.items)) {
      // Избегаем дублей (проверяем по package)
      data.items.forEach(newApp => {
        const pkg = newApp.package || newApp.packageName;
        if (!pendingApps.find(existing => (existing.package || existing.packageName) === pkg)) {
          pendingApps.push(newApp);
        }
      });
      scheduleRender();
    }

    // Если это финальный пакет (done: true)
    if (data.done === true) {
      if (loadTimeout) clearTimeout(loadTimeout);
      scheduleRender();
    }
  }

  function closePicker() {
    const picker = document.getElementById("app_picker");
    if (picker) picker.classList.remove('open');
    isPickerOpen = false;
    currentPickerSlot = null;
    currentPickerGrid = null;
    pendingApps = [];
    if (loadTimeout) clearTimeout(loadTimeout);
  }

  function openPickerForSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    if (!slotId) return;
    
    currentPickerSlot = slotId;
    const picker = document.getElementById("app_picker");
    currentPickerGrid = document.getElementById("app-picker-grid");
    
    if (!picker || !currentPickerGrid) return;
    
    isPickerOpen = true;
    pendingApps = [];
    currentPickerGrid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Загрузка приложений...</div>';
    picker.classList.add('open');

    // Запускаем запрос каталога
    if (window.androidApi && typeof window.androidApi.requestLauncherCatalogAsync === 'function') {
      const reqId = 'app_cat_' + Date.now();
      window.androidApi.requestLauncherCatalogAsync(TOKEN, reqId);
    } else if (window.android && typeof android.getUserApps === 'function') {
      // Fallback для старых мостов
      try {
        const raw = android.getUserApps();
        const apps = JSON.parse(raw);
        if (Array.isArray(apps)) {
          pendingApps = apps;
        }
      } catch (e) {}
      scheduleRender();
    }

    // Защитный таймаут: если "done" не пришел за 2 секунды, показываем то, что есть
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (pendingApps.length === 0) {
        currentPickerGrid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Нет установленных приложений</div>';
      }
    }, 2000);
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
        closePicker();
      });
    }
    
    if (picker) {
      picker.addEventListener('click', (e) => {
        if (e.target === picker) {
          closePicker();
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
    renderSlot,
    handleLauncherCatalog // Экспортируем для main.js
  };
})();