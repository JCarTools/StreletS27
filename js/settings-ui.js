/**********************************************
 * Модуль: UI модального окна настроек
 **********************************************/

modules.settingsUI = (function() {
  let modal = null;
  let isOpen = false;
  let openSectionIndex = 0;

  const SETTINGS_MODAL_ID = 'settingsModal';
  const SETTINGS_MODAL_CLASS = 'settings-modal-overlay';
  const SETTINGS_CONTENT_CLASS = 'settings-modal-content';
  const SETTINGS_HEADER_CLASS = 'settings-header';
  const SETTINGS_HEADER_TITLE_CLASS = 'settings-header-title';
  const SETTINGS_HEADER_LINK_CLASS = 'settings-header-link';
  const SETTINGS_REFRESH_BTN_ID = 'settingsRefreshBtn';
  const SETTINGS_CLOSE_BTN_ID = 'settingsCloseBtn';
  const SETTINGS_BODY_CLASS = 'settings-body';
  const SETTINGS_SECTION_CLASS = 'settings-section';
  const SETTINGS_SECTION_TITLE_CLASS = 'settings-section-title';
  const SETTINGS_ROW_CLASS = 'settings-row';
  const SETTINGS_LABEL_CLASS = 'settings-label';
  const SETTINGS_RANGE_CONTAINER_CLASS = 'settings-range-container';
  const SETTINGS_RANGE_VALUE_CLASS = 'settings-range-value';
  const SETTINGS_RANGE_CLASS = 'settings-range';
  const SETTINGS_SELECT_CLASS = 'settings-select';
  const SETTINGS_TOGGLE_CLASS = 'settings-toggle';
  const SETTINGS_TEXT_INPUT_CLASS = 'settings-text-input';
  const SETTINGS_INFO_CLASS = 'settings-info';
  const SETTINGS_RESET_BTN_CLASS = 'settings-reset-btn';
  const SETTINGS_CLOSE_BTN_CLASS = 'settings-close-btn';
  const SETTINGS_QR_CONTAINER_CLASS = 'settings-qr-container';
  const SETTINGS_QR_TEXT_CLASS = 'settings-qr-text';

  const OPEN_CLASS = 'open';
  const ACTIVE_CLASS = 'active';
  const LIGHT_BODY_CLASS = 'light';
  const SECTION_OPEN_CLASS = 'settings-section--open';

  const TEXT_HEADER_TITLE = '⚙️ Настройки панели';
  const TEXT_REFRESH_BTN = 'Обновить';
  const TEXT_REFRESH_TITLE = 'Открыть системное меню JCarTools';
  const TEXT_CLOSE_ARIA = 'Закрыть';
  const TEXT_RESET_BTN = '🔄 Сбросить все настройки';
  const TEXT_RESET_CONFIRM = 'Сбросить все настройки панели? Это перезагрузит страницу.';
  const TEXT_QR_ALT = 'QR-код для поддержки автора';
  const TEXT_QR_MAIN = '✨ Отсканируйте QR-код, чтобы поддержать автора ✨';
  const TEXT_QR_HINT = '✨ Если Вам нравится моя работа,<br>подтвердите это переходом по QR ✨';
  const TEXT_TOGGLE_ON = 'Вкл';
  const TEXT_TOGGLE_OFF = 'Выкл';
  const TEXT_VERSION_FALLBACK = '—';

  const MODAL_ANIMATION_MS = 300;
  const OPEN_DELAY_MS = 10;
  const QR_OVERLAY_ANIM_MS = 300;
  const QR_OVERLAY_SHOW_DELAY_MS = 10;

  const QR_IMAGE_SRC = 'images/Qrkod.png';
  const QR_MODAL_STYLE_ID = 'qr-modal-styles';
  const QR_OVERLAY_CLASS = 'qr-expanded-overlay';
  const QR_CONTENT_CLASS = 'qr-expanded-content';
  const QR_IMAGE_CLASS = 'qr-expanded-img';
  const QR_TEXT_CLASS = 'qr-expanded-text';
  const QR_OVERLAY_ACTIVE_CLASS = 'active';

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

      .settings-section.${SECTION_OPEN_CLASS} {
        background: rgba(70, 100, 160, 0.18);
        border-color: rgba(120, 160, 240, 0.35);
        box-shadow: 0 0 0 1px rgba(120, 160, 240, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      body.light .settings-section.${SECTION_OPEN_CLASS} {
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

      .settings-section.${SECTION_OPEN_CLASS} .settings-section-title {
        color: rgba(180, 210, 255, 0.95);
        background: rgba(120, 160, 240, 0.12);
        border-bottom: 1px solid rgba(120, 160, 240, 0.2);
      }
      body.light .settings-section.${SECTION_OPEN_CLASS} .settings-section-title {
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
      .settings-section.${SECTION_OPEN_CLASS} .settings-section-title .settings-section-arrow {
        transform: rotate(180deg);
        opacity: 0.95;
      }
      .settings-section-content {
        display: none;
        padding-bottom: 0.4rem;
      }
      .settings-section.${SECTION_OPEN_CLASS} .settings-section-content {
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
    overlay.addEventListener('click', () => {
      overlay.classList.remove(QR_OVERLAY_ACTIVE_CLASS);
      setTimeout(() => overlay.remove(), QR_OVERLAY_ANIM_MS);
    });
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        overlay.classList.remove(QR_OVERLAY_ACTIVE_CLASS);
        setTimeout(() => overlay.remove(), QR_OVERLAY_ANIM_MS);
        document.removeEventListener('keydown', onEsc);
      }
    };
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
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      valueDisplay.textContent = val + (setting.unit ? ` ${setting.unit}` : '');
      modules.settings.saveSetting(setting.id, val);
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

  function createActionButton(setting) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${SETTINGS_TOGGLE_CLASS} ${ACTIVE_CLASS}`;
    btn.textContent = setting.value || 'Запустить';
    btn.style.minWidth = '100px';
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (setting.id === 'onboardingReset') {
        close();
        setTimeout(() => {
          if (modules.onboarding) {
            storage.remove('onboarding_completed');
            if (typeof modules.onboarding.init === 'function') {
              modules.onboarding.init();
            }
          }
        }, 350); 
      }
    });
    return btn;
  }

  function buildModal() {
    addQrModalStyles();

    const modalOverlay = document.createElement('div');
    modalOverlay.id = SETTINGS_MODAL_ID;
    modalOverlay.className = SETTINGS_MODAL_CLASS;
    const modalContent = document.createElement('div');
    modalContent.className = SETTINGS_CONTENT_CLASS;
    const header = document.createElement('div');
    header.className = SETTINGS_HEADER_CLASS;

    const title = document.createElement('h2');
    title.className = SETTINGS_HEADER_TITLE_CLASS;
    title.textContent = TEXT_HEADER_TITLE;

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = SETTINGS_HEADER_LINK_CLASS;
    refreshBtn.id = SETTINGS_REFRESH_BTN_ID;
    refreshBtn.title = TEXT_REFRESH_TITLE;
    refreshBtn.setAttribute('aria-label', TEXT_REFRESH_BTN);
    refreshBtn.textContent = TEXT_REFRESH_BTN;
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      refreshBtn.blur();
      modules.settings.openSystemSettings();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = SETTINGS_CLOSE_BTN_CLASS;
    closeBtn.id = SETTINGS_CLOSE_BTN_ID;
    closeBtn.setAttribute('aria-label', TEXT_CLOSE_ARIA);
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

    header.appendChild(title);
    header.appendChild(refreshBtn);
    header.appendChild(closeBtn);
    modalContent.appendChild(header);

    const body = document.createElement('div');
    body.className = SETTINGS_BODY_CLASS;
    const currentAppVersion = (window.MANIFEST && window.MANIFEST.version) ? String(window.MANIFEST.version) : TEXT_VERSION_FALLBACK;

    const sections = [];
    let sectionIndex = 0;

    for (const [, category] of Object.entries(modules.settingsConfig.schema)) {
      const section = document.createElement('div');
      section.className = SETTINGS_SECTION_CLASS;
      section.dataset.sectionIndex = String(sectionIndex);

      const sectionTitle = document.createElement('h3');
      sectionTitle.className = SETTINGS_SECTION_TITLE_CLASS;
      sectionTitle.innerHTML = `<span>${category.title}</span><span class="settings-section-arrow">▼</span>`;
      section.appendChild(sectionTitle);

      const sectionContent = document.createElement('div');
      sectionContent.className = 'settings-section-content';

      for (const setting of category.settings) {
        if (setting.type === 'qr') {
          sectionContent.appendChild(createQrCode());
          continue;
        }
        const row = document.createElement('div');
        row.className = SETTINGS_ROW_CLASS;
        const label = document.createElement('label');
        label.className = SETTINGS_LABEL_CLASS;
        label.textContent = setting.label;
        label.style.flexShrink = '0';
        row.appendChild(label);
        
        let currentValue = modules.settings.loadSetting(setting.id);
        if (setting.id === 'fuelDisplayMode') currentValue = modules.settings.fuelDisplayModeToUi(currentValue);
        if (setting.id === 'version') currentValue = currentAppVersion;
        if (setting.id === 'miniMapTheme') currentValue = modules.settings.miniMapThemeFromStorage(modules.settings.loadSetting('miniMapTheme'));

        switch (setting.type) {
          case 'range': row.appendChild(createRangeInput(setting, currentValue)); break;
          case 'select': row.appendChild(createSelect(setting, currentValue)); break;
          case 'toggle': row.appendChild(createToggle(setting, currentValue)); break;
          case 'text': row.appendChild(createTextInput(setting, currentValue)); break;
          case 'info': row.appendChild(createInfo({ ...setting, value: currentValue || TEXT_VERSION_FALLBACK })); break;
          case 'button': row.appendChild(createActionButton(setting)); break;
        }
        sectionContent.appendChild(row);
      }

      section.appendChild(sectionContent);
      sectionTitle.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(section.dataset.sectionIndex);
        toggleSection(idx);
      });

      sections.push(section);
      body.appendChild(section);
      sectionIndex++;
    }

    if (sections.length > 0) {
      sections[0].classList.add(SECTION_OPEN_CLASS);
    }

    function scrollSectionIntoView(section) {
      if (!body || !section) return;
      const bodyRect = body.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const target = body.scrollTop + (sectionRect.top - bodyRect.top);
      body.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }

    function toggleSection(index) {
      const target = sections[index];
      if (!target) return;
      const isOpen = target.classList.contains(SECTION_OPEN_CLASS);
      sections.forEach(s => s.classList.remove(SECTION_OPEN_CLASS));
      if (!isOpen) {
        target.classList.add(SECTION_OPEN_CLASS);
        openSectionIndex = index;
        requestAnimationFrame(() => scrollSectionIntoView(target));
      }
    }

    const resetBtn = document.createElement('button');
    resetBtn.className = SETTINGS_RESET_BTN_CLASS;
    resetBtn.type = 'button';
    resetBtn.innerHTML = TEXT_RESET_BTN;
    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (confirm(TEXT_RESET_CONFIRM)) {
        await modules.settings.performFullReset();
        window.location.reload();
      }
    });
    body.appendChild(resetBtn);
    modalContent.appendChild(body);
    modalOverlay.appendChild(modalContent);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) close();
    });
    return modalOverlay;
  }

  function open() {
    if (isOpen) return;
    if (modal) modal.remove();
    modal = buildModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add(OPEN_CLASS), OPEN_DELAY_MS);
    isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (modal) {
      modal.classList.remove(OPEN_CLASS);
      const localModal = modal;
      setTimeout(() => {
        if (localModal && localModal.parentNode) localModal.parentNode.removeChild(localModal);
        modal = null;
      }, MODAL_ANIMATION_MS);
    }
    isOpen = false;
    document.body.style.overflow = '';
  }

  return { open, close };
})();