/**********************************************
 * Модуль: Приложения (слоты 2, 4, 6)
 * Исправлено: корректное назначение приложений на конкретную кнопку
 **********************************************/

modules.apps = (function() {
  let currentPickerSlot = null; // Храним ID слота, для которого открыт пикер
  
  // Функция открытия пикера для конкретного слота
  function openPickerForSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    if (!slotId) return;
    
    currentPickerSlot = slotId;
    const picker = document.getElementById("app_picker");
    const grid = document.getElementById("app-picker-grid");
    const close = document.getElementById("app-picker-close");
    
    if (!picker || !grid) return;
    
    // Показываем загрузку
    grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Загрузка приложений...</div>';
    picker.classList.add('open');
    
    // Загружаем список приложений
    setTimeout(() => {
      grid.innerHTML = '';
      try {
        const appsRaw = android.getUserApps();
        console.log('[Apps] Получены приложения:', appsRaw);
        
        let apps = [];
        try {
          apps = JSON.parse(appsRaw);
        } catch (e) {
          console.error('[Apps] Ошибка парсинга приложений:', e);
          apps = [];
        }
        
        if (!apps || !apps.length) {
          grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Нет установленных приложений</div>';
          return;
        }
        
        apps.forEach(app => {
          const d = document.createElement('div');
          d.className = 'picker-item';
          
          const img = document.createElement('img');
          img.src = `data:image/png;base64,${app.icon}`;
          
          const nameSpan = document.createElement('span');
          nameSpan.textContent = app.name;
          
          d.appendChild(img);
          d.appendChild(nameSpan);
          
          // При клике на приложение - сохраняем его в текущий слот
          d.onclick = () => {
            console.log('[Apps] Выбрано приложение:', app.name, 'для слота:', currentPickerSlot);
            
            // Сохраняем в storage
            storage.save(`app_slot_${currentPickerSlot}`, {
              package: app.package,
              name: app.name,
              icon: app.icon
            });
            
            // Обновляем отображение слота
            const slotEl = document.querySelector(`.app_slot[data-slot="${currentPickerSlot}"]`);
            if (slotEl) {
              // Сохраняем название приложения для возможного отображения
              slotEl.setAttribute('data-app-name', app.name);
              slotEl.innerHTML = `<img src="data:image/png;base64,${app.icon}">`;
              
              // Если нужно показывать название
              const showLabels = storage.load('setting_showAppLabels');
              if (showLabels) {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'app-label';
                labelSpan.textContent = app.name;
                slotEl.appendChild(labelSpan);
                slotEl.classList.add('has-label');
              }
            }
            
            picker.classList.remove('open');
            currentPickerSlot = null;
          };
          
          grid.appendChild(d);
        });
      } catch(e) {
        console.error('[Apps] Ошибка загрузки приложений:', e);
        grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;">Ошибка загрузки приложений</div>';
      }
    }, 10);
  }
  
  // Функция обновления отображения слота
  function renderSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    const saved = storage.load(`app_slot_${slotId}`);
    
    if (!saved) {
      slotElement.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
      slotElement.classList.remove('has-label');
      return;
    }
    
    slotElement.innerHTML = `<img src="data:image/png;base64,${saved.icon}">`;
    slotElement.setAttribute('data-app-name', saved.name);
    
    // Если нужно показывать название
    const showLabels = storage.load('setting_showAppLabels');
    if (showLabels) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'app-label';
      labelSpan.textContent = saved.name;
      slotElement.appendChild(labelSpan);
      slotElement.classList.add('has-label');
    } else {
      slotElement.classList.remove('has-label');
    }
  }
  
  // Функция обновления всех слотов
  function updateAllSlots() {
    document.querySelectorAll('.app_slot').forEach(renderSlot);
  }
  
  // Функция инициализации обработчиков для всех слотов
  function initSlots() {
    const slots = document.querySelectorAll('.app_slot');
    
    slots.forEach(slot => {
      const slotId = slot.dataset.slot;
      
      // Удаляем старые обработчики, если они есть
      const oldClickHandler = slot._clickHandler;
      const oldLongPressHandler = slot._longPressHandler;
      if (oldClickHandler) slot.removeEventListener('click', oldClickHandler);
      if (oldLongPressHandler) slot.removeEventListener('contextmenu', oldLongPressHandler);
      
      // Обработчик короткого нажатия (запуск приложения)
      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Проверяем, было ли длинное нажатие
        if (slot.getAttribute('data-long-pressed') === 'true') {
          slot.removeAttribute('data-long-pressed');
          return;
        }
        
        const saved = storage.load(`app_slot_${slotId}`);
        if (!saved) {
          // Если приложение не назначено - открываем пикер
          openPickerForSlot(slot);
        } else {
          // Запускаем приложение
          if (saved.package && typeof android.runApp === 'function') {
            try {
              console.log('[Apps] Запуск приложения:', saved.package);
              android.runApp(saved.package);
            } catch(e) {
              console.error('[Apps] Ошибка запуска:', e);
              if (typeof showToast === 'function') {
                showToast('Не удалось запустить приложение', 2000);
              }
            }
          }
        }
      };
      
      // Обработчик длинного нажатия (выбор приложения)
      const longPressHandler = () => {
        console.log('[Apps] Длинное нажатие на слот:', slotId);
        openPickerForSlot(slot);
      };
      
      // Сохраняем обработчики для возможного удаления
      slot._clickHandler = clickHandler;
      slot._longPressHandler = longPressHandler;
      
      // Навешиваем обработчики
      slot.addEventListener('click', clickHandler);
      makeLongPressable(slot, longPressHandler, { delay: 700, preventDefaultOnStart: false });
    });
  }
  
  // Переинициализация всех слотов (вызывается после изменения количества слотов)
  function reinitSlots() {
    setTimeout(() => {
      initSlots();
      updateAllSlots();
      
      // Обновляем отображение названий
      const showLabels = storage.load('setting_showAppLabels');
      updateAppLabels(showLabels);
    }, 50);
  }
  
  // Обновление отображения названий приложений
  function updateAppLabels(show) {
    const slots = document.querySelectorAll('.app_slot');
    slots.forEach(slot => {
      const saved = storage.load(`app_slot_${slot.dataset.slot}`);
      if (saved && show) {
        // Добавляем название, если его нет
        if (!slot.querySelector('.app-label')) {
          const labelSpan = document.createElement('span');
          labelSpan.className = 'app-label';
          labelSpan.textContent = saved.name;
          slot.appendChild(labelSpan);
          slot.classList.add('has-label');
        }
      } else if (!show) {
        // Удаляем название
        const label = slot.querySelector('.app-label');
        if (label) label.remove();
        slot.classList.remove('has-label');
      }
    });
  }
  
  // Инициализация пикера (глобальные обработчики)
  function initPicker() {
    const picker = document.getElementById("app_picker");
    const close = document.getElementById("app-picker-close");
    
    if (close) {
      // Удаляем старые обработчики
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
  
  // Основная функция инициализации
  function init() {
    console.log('[Apps] Инициализация...');
    
    initPicker();
    initSlots();
    updateAllSlots();
    
    // Подписываемся на изменения настроек отображения названий
    const showLabels = storage.load('setting_showAppLabels');
    if (showLabels !== undefined) {
      updateAppLabels(showLabels);
    }
    
    console.log('[Apps] Инициализация завершена');
  }
  
  return { 
    init,
    reinitSlots,
    updateAppLabels,
    renderSlot
  };
})();