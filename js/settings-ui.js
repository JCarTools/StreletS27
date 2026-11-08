/**********************************************
 * Модуль: UI модального окна настроек
 * Контролы и QR — в settings-ui-controls.js.
 * [FIX] open(): защита от двойного клика (race).
 *       Введён isOpening — сбрасывается сразу после appendChild.
 * [FIX] toggleSection: scrollIntoView с fallback.
 * [FIX] close(): modal обнуляется сразу (защита от двойного открытия).
 **********************************************/

modules.settingsUI = (function() {
  const C = modules.settingsUIControls;

  let modal = null;
  let isOpen = false;
  let isOpening = false;
  let openSectionIndex = -1;

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
  const SETTINGS_RESET_BTN_CLASS = 'settings-reset-btn';
  const SETTINGS_CLOSE_BTN_CLASS = 'settings-close-btn';

  const OPEN_CLASS = 'open';
  const SECTION_OPEN_CLASS = 'settings-section--open';

  const TEXT_HEADER_TITLE = '⚙️ Настройки панели';
  const TEXT_REFRESH_BTN = 'Обновить';
  const TEXT_REFRESH_TITLE = 'Открыть системное меню JCarTools';
  const TEXT_CLOSE_ARIA = 'Закрыть';
  const TEXT_RESET_BTN = '🔄 Сбросить все настройки';
  const TEXT_RESET_CONFIRM = 'Сбросить все настройки панели? Это перезагрузит страницу.';
  const TEXT_VERSION_FALLBACK = '—';

  const MODAL_ANIMATION_MS = 300;
  const OPEN_DELAY_MS = 10;

  const DEFAULT_OPEN_SECTION_KEY = 'about';

  function buildModal() {
    C.addQrModalStyles();

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
    const sectionKeys = [];
    let sectionIndex = 0;

    for (const [categoryKey, category] of Object.entries(modules.settingsConfig.schema)) {
      sectionKeys.push(categoryKey);

      const section = document.createElement('div');
      section.className = SETTINGS_SECTION_CLASS;
      section.dataset.sectionIndex = String(sectionIndex);
      section.dataset.sectionKey = categoryKey;

      const sectionTitle = document.createElement('h3');
      sectionTitle.className = SETTINGS_SECTION_TITLE_CLASS;
      sectionTitle.innerHTML = `<span>${category.title}</span><span class="settings-section-arrow">▼</span>`;
      section.appendChild(sectionTitle);

      const sectionContent = document.createElement('div');
      sectionContent.className = 'settings-section-content';

      for (const setting of category.settings) {
        if (setting.type === 'qr') {
          sectionContent.appendChild(C.createQrCode());
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
          case 'range': row.appendChild(C.createRangeInput(setting, currentValue)); break;
          case 'select': row.appendChild(C.createSelect(setting, currentValue)); break;
          case 'toggle': row.appendChild(C.createToggle(setting, currentValue)); break;
          case 'text': row.appendChild(C.createTextInput(setting, currentValue)); break;
          case 'info': row.appendChild(C.createInfo({ ...setting, value: currentValue || TEXT_VERSION_FALLBACK })); break;
          case 'button': {
            row.appendChild(C.createActionButton(setting, (s) => {
              if (s.id === 'onboardingReset') {
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
            }));
            break;
          }
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

    function scrollSectionIntoView(section) {
      if (!body || !section) return;
      try {
        if (typeof section.scrollIntoView === 'function') {
          section.scrollIntoView({ block: 'start', behavior: 'smooth' });
          return;
        }
      } catch (e) { /* fallback ниже */ }
      const target = section.offsetTop - body.offsetTop;
      body.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }

    function toggleSection(index) {
      const target = sections[index];
      if (!target) return;
      const isOpenSection = target.classList.contains(SECTION_OPEN_CLASS);
      sections.forEach(s => s.classList.remove(SECTION_OPEN_CLASS));
      if (!isOpenSection) {
        target.classList.add(SECTION_OPEN_CLASS);
        openSectionIndex = index;
        requestAnimationFrame(() => scrollSectionIntoView(target));
      } else {
        openSectionIndex = -1;
      }
    }

    const defaultOpenIndex = sectionKeys.indexOf(DEFAULT_OPEN_SECTION_KEY);
    if (defaultOpenIndex >= 0 && sections[defaultOpenIndex]) {
      sections[defaultOpenIndex].classList.add(SECTION_OPEN_CLASS);
      openSectionIndex = defaultOpenIndex;
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

  // [FIX] Защита от race: isOpening — сбрасывается сразу после appendChild.
  function open() {
    if (isOpen || isOpening) return;
    isOpening = true;

    if (modal) {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      modal = null;
    }
    modal = buildModal();
    document.body.appendChild(modal);
    isOpen = true;
    isOpening = false;

    setTimeout(() => {
      if (modal) modal.classList.add(OPEN_CLASS);
    }, OPEN_DELAY_MS);

    document.body.style.overflow = 'hidden';
  }

  function close() {
    const localModal = modal;
    modal = null;
    isOpen = false;
    isOpening = false;
    if (localModal) {
      localModal.classList.remove(OPEN_CLASS);
      setTimeout(() => {
        if (localModal && localModal.parentNode) localModal.parentNode.removeChild(localModal);
      }, MODAL_ANIMATION_MS);
    }
    document.body.style.overflow = '';
  }

  return { open, close };
})();