/**********************************************
 * Модуль: UI настроек — контролы и QR
 * Часть 1 из 2. Модалка и секции — в settings-ui.js.
 * [FIX] createRangeInput: throttle записи (input через rAF + сохранение на change/300мс).
 * [FIX] showExpandedQr: keydown-обработчик снимается при закрытии (без утечки).
 * [NEW] createRangeInput: используется debounce для сохранения, чтобы не спамить localStorage.
 **********************************************/

modules.settingsUIControls = (function() {
  const SETTINGS_RANGE_CONTAINER_CLASS = 'settings-range-container';
  const SETTINGS_RANGE_VALUE_CLASS = 'settings-range-value';
  const SETTINGS_RANGE_CLASS = 'settings-range';
  const SETTINGS_SELECT_CLASS = 'settings-select';
  const SETTINGS_TOGGLE_CLASS = 'settings-toggle';
  const SETTINGS_TEXT_INPUT_CLASS = 'settings-text-input';
  const SETTINGS_INFO_CLASS = 'settings-info';
  const SETTINGS_QR_CONTAINER_CLASS = 'settings-qr-container';
  const SETTINGS_QR_TEXT_CLASS = 'settings-qr-text';

  const ACTIVE_CLASS = 'active';
  const LIGHT_BODY_CLASS = 'light';

  const TEXT_TOGGLE_ON = 'Вкл';
  const TEXT_TOGGLE_OFF = 'Выкл';
  const TEXT_QR_ALT = 'QR-код для поддержки автора';
  const TEXT_QR_MAIN = '✨ Отсканируйте QR-код, чтобы поддержать автора ✨';
  const TEXT_QR_HINT = '✨ Если Вам нравится моя работа,<br>подтвердите это переходом по QR ✨';

  const QR_IMAGE_SRC = 'images/Qrkod.png';
  const QR_MODAL_STYLE_ID = 'qr-modal-styles';
  const QR_OVERLAY_CLASS = 'qr-expanded-overlay';
  const QR_CONTENT_CLASS = 'qr-expanded-content';
  const QR_IMAGE_CLASS = 'qr-expanded-img';
  const QR_TEXT_CLASS = 'qr-expanded-text';
  const QR_OVERLAY_ACTIVE_CLASS = 'active';
  const QR_OVERLAY_ANIM_MS = 300;
  const QR_OVERLAY_SHOW_DELAY_MS = 10;

  const RANGE_SAVE_DEBOUNCE_MS = 300;

  function addQrModalStyles() {
    if (document.getElementById(QR_MODAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = QR_MODAL_STYLE_ID;
    style.textContent = `
      .${QR_OVERLAY_CLASS} {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
        z-index: 30000; display: flex; align-items: center; justify-content: center;
        opacity: 0; visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        cursor: pointer;
      }
      .${QR_OVERLAY_CLASS}.${QR_OVERLAY_ACTIVE_CLASS} { opacity: 1; visibility: visible; }
      .${QR_CONTENT_CLASS} {
        max-width: 85vw; max-height: 85vh;
        background: rgba(30,33,42,0.95); border-radius: 2rem; padding: 1.5rem;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        transform: scale(0.9);
        transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
      }
      .${QR_OVERLAY_CLASS}.${QR_OVERLAY_ACTIVE_CLASS} .${QR_CONTENT_CLASS} { transform: scale(1); }
      .${QR_IMAGE_CLASS} {
        width: 100%; height: auto; max-width: 400px; max-height: 70vh;
        border-radius: 1rem; background: white; padding: 1rem; box-sizing: border-box;
      }
      .${QR_TEXT_CLASS} {
        text-align: center; margin-top: 1rem; font-size: 0.85rem;
        color: rgba(255,255,255,0.7);
      }
      body.${LIGHT_BODY_CLASS} .${QR_CONTENT_CLASS} {
        background: rgba(245,248,255,0.95); border-color: rgba(0,0,0,0.1);
      }
      body.${LIGHT_BODY_CLASS} .${QR_TEXT_CLASS} { color: rgba(50,60,80,0.8); }

      .settings-section {
        margin-bottom: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.03);
        overflow: hidden;
        transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      }
      body.light .settings-section {
        background: rgba(0, 0, 0, 0.03);
        border-color: rgba(0, 0, 0, 0.04);
      }

      .settings-section.settings-section--open {
        background: rgba(70, 100, 160, 0.18);
        border-color: rgba(120, 160, 240, 0.35);
        box-shadow: 0 0 0 1px rgba(120, 160, 240, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      body.light .settings-section.settings-section--open {
        background: rgba(120, 160, 240, 0.15);
        border-color: rgba(90, 130, 210, 0.35);
        box-shadow: 0 0 0 1px rgba(90, 130, 210, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }

      .settings-section-title {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.55);
        padding: 0.8rem 1rem;
        margin: 0;
        user-select: none;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .settings-section-title:hover {
        background: rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.75);
      }
      body.light .settings-section-title {
        color: rgba(50, 60, 80, 0.65);
      }
      body.light .settings-section-title:hover {
        background: rgba(0, 0, 0, 0.03);
        color: rgba(30, 40, 60, 0.85);
      }

      .settings-section.settings-section--open .settings-section-title {
        color: rgba(180, 210, 255, 0.95);
        background: rgba(120, 160, 240, 0.12);
        border-bottom: 1px solid rgba(120, 160, 240, 0.2);
      }
      body.light .settings-section.settings-section--open .settings-section-title {
        color: rgba(40, 70, 140, 0.95);
        background: rgba(120, 160, 240, 0.14);
        border-bottom-color: rgba(90, 130, 210, 0.2);
      }

      .settings-section-title .settings-section-arrow {
        font-size: 0.6rem;
        opacity: 0.6;
        transition: transform 0.25s ease;
        margin-left: 0.5rem;
      }
      .settings-section.settings-section--open .settings-section-title .settings-section-arrow {
        transform: rotate(180deg);
        opacity: 0.95;
      }
      .settings-section-content {
        display: none;
        padding-bottom: 0.4rem;
      }
      .settings-section.settings-section--open .settings-section-content {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function showExpandedQr(qrImgSrc) {
    addQrModalStyles();
    document.querySelector('.' + QR_OVERLAY_CLASS)?.remove();
    const overlay = document.createElement('div');
    overlay.className = QR_OVERLAY_CLASS;
    const content = document.createElement('div');
    content.className = QR_CONTENT_CLASS;
    content.onclick = (e) => e.stopPropagation();
    const img = document.createElement('img');
    img.src = qrImgSrc;
    img.className = QR_IMAGE_CLASS;
    img.alt = TEXT_QR_ALT;
    const text = document.createElement('div');
    text.className = QR_TEXT_CLASS;
    text.innerHTML = TEXT_QR_MAIN;
    content.appendChild(img);
    content.appendChild(text);
    overlay.appendChild(content);

    // FIX: общий cleanup — удаляем обработчик keydown
    let closed = false;
    const doClose = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onEsc);
      overlay.classList.remove(QR_OVERLAY_ACTIVE_CLASS);
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, QR_OVERLAY_ANIM_MS);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') doClose();
    };

    overlay.addEventListener('click', doClose);
    document.addEventListener('keydown', onEsc);

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add(QR_OVERLAY_ACTIVE_CLASS), QR_OVERLAY_SHOW_DELAY_MS);
  }

  function createQrCode() {
    const container = document.createElement('div');
    container.className = SETTINGS_QR_CONTAINER_CLASS;
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; gap: 0.5rem; cursor: pointer;';
    const qrImg = document.createElement('img');
    qrImg.src = QR_IMAGE_SRC;
    qrImg.alt = TEXT_QR_ALT;
    qrImg.style.cssText = 'width: 120px; height: 120px; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: white; padding: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer;';
    qrImg.addEventListener('mouseenter', () => {
      qrImg.style.transform = 'scale(1.02)';
      qrImg.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
    });
    qrImg.addEventListener('mouseleave', () => {
      qrImg.style.transform = 'scale(1)';
      qrImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
    qrImg.addEventListener('click', (e) => {
      e.stopPropagation();
      showExpandedQr(qrImg.src);
    });
    const qrText = document.createElement('div');
    qrText.className = SETTINGS_QR_TEXT_CLASS;
    qrText.innerHTML = TEXT_QR_HINT;
    qrText.style.cssText = 'font-size: 0.7rem; text-align: center; color: rgba(238,242,247,0.75); line-height: 1.4; max-width: 260px; cursor: pointer;';
    qrText.addEventListener('click', (e) => {
      e.stopPropagation();
      showExpandedQr(qrImg.src);
    });
    if (document.body.classList.contains(LIGHT_BODY_CLASS)) {
      qrImg.style.borderColor = 'rgba(0,0,0,0.1)';
      qrText.style.color = 'rgba(50,60,80,0.75)';
    }
    container.appendChild(qrImg);
    container.appendChild(qrText);
    return container;
  }

  function createRangeInput(setting, currentValue) {
    const container = document.createElement('div');
    container.className = SETTINGS_RANGE_CONTAINER_CLASS;
    const valueDisplay = document.createElement('span');
    valueDisplay.className = SETTINGS_RANGE_VALUE_CLASS;
    valueDisplay.textContent = currentValue + (setting.unit ? ` ${setting.unit}` : '');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = setting.min;
    input.max = setting.max;
    input.step = setting.step || 1;
    input.value = currentValue;
    input.className = SETTINGS_RANGE_CLASS;

    // FIX: throttle записи, чтобы не спамить localStorage.
    let pendingValue = null;
    let saveTimer = null;
    let rafId = null;

    const flush = () => {
      if (pendingValue !== null) {
        const v = pendingValue;
        pendingValue = null;
        modules.settings.saveSetting(setting.id, v);
      }
    };

    const scheduleSave = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, RANGE_SAVE_DEBOUNCE_MS);
      });
    };

    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      valueDisplay.textContent = val + (setting.unit ? ` ${setting.unit}` : '');
      pendingValue = val;
      scheduleSave();
    });

    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      valueDisplay.textContent = val + (setting.unit ? ` ${setting.unit}` : '');
      pendingValue = val;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      flush();
    });

    container.appendChild(input);
    container.appendChild(valueDisplay);
    return container;
  }

  function createSelect(setting, currentValue) {
    const select = document.createElement('select');
    select.className = SETTINGS_SELECT_CLASS;
    setting.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === currentValue) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
      e.stopPropagation();
      modules.settings.saveSetting(setting.id, e.target.value);
    });
    return select;
  }

  function createToggle(setting, currentValue) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `${SETTINGS_TOGGLE_CLASS} ${currentValue ? ACTIVE_CLASS : ''}`.trim();
    toggle.innerHTML = currentValue ? TEXT_TOGGLE_ON : TEXT_TOGGLE_OFF;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isActive = toggle.classList.contains(ACTIVE_CLASS);
      const newValue = !isActive;
      toggle.classList.toggle(ACTIVE_CLASS, newValue);
      toggle.innerHTML = newValue ? TEXT_TOGGLE_ON : TEXT_TOGGLE_OFF;
      toggle.blur();
      modules.settings.saveSetting(setting.id, newValue);
    });
    return toggle;
  }

  function createTextInput(setting, currentValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue || setting.default || '';
    input.placeholder = setting.placeholder || '';
    input.className = SETTINGS_TEXT_INPUT_CLASS;
    let pendingTimer = null;
    let lastSavedValue = input.value;
    const commit = () => {
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      const v = input.value;
      if (v === lastSavedValue) return;
      lastSavedValue = v;
      modules.settings.saveSetting(setting.id, v);
    };
    const scheduleCommit = () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(commit, 500);
    };
    input.addEventListener('input', scheduleCommit);
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    return input;
  }

  function createInfo(setting) {
    const info = document.createElement('div');
    info.className = SETTINGS_INFO_CLASS;
    info.textContent = setting.value;
    return info;
  }

  function createActionButton(setting, onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${SETTINGS_TOGGLE_CLASS} ${ACTIVE_CLASS}`;
    btn.textContent = setting.value || 'Запустить';
    btn.style.minWidth = '100px';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof onAction === 'function') onAction(setting);
    });
    return btn;
  }

  return {
    addQrModalStyles,
    showExpandedQr,
    createQrCode,
    createRangeInput,
    createSelect,
    createToggle,
    createTextInput,
    createInfo,
    createActionButton,
    SETTINGS_QR_CONTAINER_CLASS
  };
})();