/**********************************************
 * Модуль: Приложения
 * [FIX 15] Запрещён запуск приложения, если виджеты скрыты (body.widgets-hidden).
 *          Раньше клик по невидимому слоту открывал приложение, хотя виджетов не видно.
 **********************************************/

modules.apps = (function() {
  let currentPickerSlot = null;

  function openPickerForSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    if (!slotId) return;

    currentPickerSlot = slotId;
    const picker = document.getElementById("app_picker");
    const grid = document.getElementById("app-picker-grid");

    if (!picker || !grid) return;

    grid.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'grid-column:1/-1;padding:20px;text-align:center;';
    loadingDiv.textContent = 'Загрузка приложений...';
    grid.appendChild(loadingDiv);
    picker.classList.add('open');

    setTimeout(() => {
      grid.textContent = '';
      let apps = [];
      try {
        const appsRaw = android.getUserApps();
        if (appsRaw) {
          if (typeof appsRaw === 'string') {
            const trimmed = appsRaw.trim();
            if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) apps = parsed;
              } catch (e) {
                console.warn('[Apps] JSON parse error:', e);
                apps = [];
              }
            }
          } else if (Array.isArray(appsRaw)) {
            apps = appsRaw;
          }
        }
      } catch (e) {
        console.error('[Apps] Ошибка получения приложений:', e);
        apps = [];
      }

      if (!Array.isArray(apps) || !apps.length) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'grid-column:1/-1;padding:20px;text-align:center;';
        emptyDiv.textContent = 'Нет установленных приложений';
        grid.appendChild(emptyDiv);
        return;
      }

      apps.forEach(app => {
        if (!app || !app.icon) return;
        const d = document.createElement('div');
        d.className = 'picker-item';

        const img = document.createElement('img');
        img.src = `data:image/png;base64,${app.icon}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = app.name || 'Приложение';

        d.appendChild(img);
        d.appendChild(nameSpan);

        d.onclick = () => {
          storage.save(`app_slot_${currentPickerSlot}`, {
            package: app.package,
            name: app.name || 'Приложение',
            icon: app.icon
          });

          const slotEl = document.querySelector(`.app_slot[data-slot="${currentPickerSlot}"]`);
          if (slotEl) {
            slotEl.setAttribute('data-app-name', app.name || 'Приложение');
            slotEl.textContent = '';

            const slotImg = document.createElement('img');
            slotImg.src = `data:image/png;base64,${app.icon}`;
            slotEl.appendChild(slotImg);

            const showLabels = storage.load('setting_showAppLabels');
            if (showLabels) {
              const labelSpan = document.createElement('span');
              labelSpan.className = 'app-label';
              labelSpan.textContent = app.name || 'Приложение';
              slotEl.appendChild(labelSpan);
              slotEl.classList.add('has-label');
            } else {
              slotEl.classList.remove('has-label');
            }
          }

          picker.classList.remove('open');
          currentPickerSlot = null;
        };

        grid.appendChild(d);
      });
    }, 10);
  }

  function renderSlot(slotElement) {
    const slotId = slotElement.dataset.slot;
    const saved = storage.load(`app_slot_${slotId}`);

    slotElement.textContent = '';

    if (!saved || !saved.icon) {
      const placeholder = document.createElement('span');
      placeholder.style.cssText = 'font-size:1.5rem;opacity:0.5;';
      placeholder.textContent = '+';
      slotElement.appendChild(placeholder);
      slotElement.classList.remove('has-label');
      return;
    }

    const img = document.createElement('img');
    img.src = `data:image/png;base64,${saved.icon}`;
    slotElement.appendChild(img);
    slotElement.setAttribute('data-app-name', saved.name || 'Приложение');

    const showLabels = storage.load('setting_showAppLabels');
    if (showLabels) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'app-label';
      labelSpan.textContent = saved.name || 'Приложение';
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

      if (slot._clickHandler) {
        slot.removeEventListener('click', slot._clickHandler);
        slot._clickHandler = null;
      }

      if (slot._lpHandlers && slot._lpHandlers.teardown) {
        slot._lpHandlers.teardown();
        slot._lpHandlers = null;
      }

      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();

        // [FIX 15] Не запускаем приложения, если виджеты скрыты.
        if (document.body.classList.contains('widgets-hidden')) {
          return;
        }

        if (slot.getAttribute('data-long-pressed') === 'true') {
          slot.removeAttribute('data-long-pressed');
          return;
        }

        const saved = storage.load(`app_slot_${slotId}`);
        if (!saved) {
          openPickerForSlot(slot);
        } else {
          if (saved.package) {
            try {
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

      const longPressHandler = () => {
        // [FIX 15] Не открываем пикер, если виджеты скрыты.
        if (document.body.classList.contains('widgets-hidden')) {
          return;
        }
        openPickerForSlot(slot);
      };

      slot._clickHandler = clickHandler;
      slot.addEventListener('click', clickHandler);
      makeLongPressable(slot, longPressHandler, { delay: 700, preventDefaultOnStart: false });
    });
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
          labelSpan.textContent = saved.name || 'Приложение';
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