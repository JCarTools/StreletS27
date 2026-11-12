/**********************************************
 * Модуль: Онбординг — логика, spotlight, навигация
 * Контент шагов — в onboarding-content.js.
 * [FIX] resizeHandler хранится в модуле, снимается в close() — корректная работа после повторного запуска.
 * [FIX] prepareUIForStep: при открытии sidebar вызываем sidebarSettings.render().
 * [FIX] reset(): close() не сохраняет onboarding_completed, если вызван из reset().
 * [FIX 2.4] Убраны inline onclick из HTML. Кнопки получают data-action="skip"/"next"
 *       и классы .onboarding-btn-skip / .onboarding-btn-next. Обработчики
 *       навешиваются через addEventListener после вставки innerHTML
 *       (CSP-friendly, без глобального modules.onboarding).
 * [FIX 2.5] skipStorageSaveOnClose сбрасывается через try/finally в close() —
 *       флаг не «залипнет», даже если close() выбросит исключение.
 * [FIX] reset(): вместо setTimeout(100) используем requestAnimationFrame
 *       и проверку, что overlay действительно удалён, прежде чем снова init().
 **********************************************/

modules.onboarding = (function() {
  const Content = modules.onboardingContent;
  const { getStepContent, getStepHighlightSelector } = Content;

  let currentStep = 1;
  const TOTAL_STEPS = 14;
  const STORAGE_KEY = 'onboarding_completed';

  let resizeHandler = null;
  let skipStorageSaveOnClose = false;

  function prepareUIForStep(step) {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (step === 12) {
      if (sidebar) sidebar.classList.add('open');
      if (sidebarOverlay) sidebarOverlay.classList.add('visible');

      if (modules.sidebarSettings && typeof modules.sidebarSettings.render === 'function') {
        try { modules.sidebarSettings.render(); } catch (e) { /* noop */ }
      }

      if (modules.sidebarSettings) {
        const accordion = document.querySelector('.sidebar-settings-accordion');
        if (accordion && !accordion.classList.contains('open')) {
          const toggle = document.getElementById('wmAccordionToggle');
          if (toggle) toggle.click();
        }
      }
    } else {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
    }
  }

  function updateSpotlight(selector) {
    let mask = document.getElementById('onboardingMask');
    let ring = document.getElementById('onboardingRing');

    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'onboardingMask';
      mask.className = 'spotlight-mask';
      document.body.appendChild(mask);
    }
    if (!ring) {
      ring = document.createElement('div');
      ring.id = 'onboardingRing';
      ring.className = 'spotlight-ring';
      document.body.appendChild(ring);
    }

    if (!selector || selector === 'body') {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const targetEl = document.querySelector(selector);
    if (!targetEl) {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const rect = targetEl.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const padding = 10;
    const x1 = rect.left - padding;
    const y1 = rect.top - padding;
    const x2 = rect.right + padding;
    const y2 = rect.bottom + padding;

    const clipPath = `polygon(
      0px 0px, 
      100% 0px, 
      100% 100%, 
      0px 100%, 
      0px 0px, 
      ${x1}px ${y1}px, 
      ${x1}px ${y2}px, 
      ${x2}px ${y2}px, 
      ${x2}px ${y1}px, 
      ${x1}px ${y1}px
    )`;

    mask.style.clipPath = clipPath;

    ring.style.display = 'block';
    ring.style.top = y1 + 'px';
    ring.style.left = x1 + 'px';
    ring.style.width = (x2 - x1) + 'px';
    ring.style.height = (y2 - y1) + 'px';
  }

  function bindStepButtons(overlay) {
    if (!overlay) return;
    const skipBtn = overlay.querySelector('.onboarding-btn-skip');
    const nextBtn = overlay.querySelector('.onboarding-btn-next');

    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        skip();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        next();
      });
    }
  }

  function renderStep(step) {
    prepareUIForStep(step);

    const contentHtml = getStepContent(step);
    const isLast = (step === TOTAL_STEPS);
    const nextBtnText = isLast ? 'Завершить' : 'Далее';

    let overlay = document.getElementById('onboardingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'onboardingOverlay';
      overlay.className = 'onboarding-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="onboarding-content">
        <div style="display: flex; justify-content: space-between; color: #7BA7FF; font-weight: bold; margin-bottom: 1rem;">
          <span>ШАГ ${step}</span>
          <span>ИЗ ${TOTAL_STEPS}</span>
        </div>
        
        ${contentHtml}
        
        <div class="onboarding-buttons">
          ${isLast ? '' : '<button type="button" class="modal-btn cancel onboarding-btn-skip" data-action="skip">Пропустить</button>'}
          <button type="button" class="modal-btn save onboarding-btn-next" data-action="next">${nextBtnText}</button>
        </div>
      </div>
    `;

    // [FIX 2.4] Навешиваем обработчики после вставки innerHTML.
    bindStepButtons(overlay);

    const highlightSelector = getStepHighlightSelector(step);
    setTimeout(() => {
      if (!document.getElementById('onboardingOverlay')) return;
      updateSpotlight(highlightSelector);
    }, 400);
  }

  function next() {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep(currentStep);
    } else {
      close();
    }
  }

  function skip() {
    close();
  }

  function close() {
    try {
      const overlay = document.getElementById('onboardingOverlay');
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
      }

      const mask = document.getElementById('onboardingMask');
      if (mask) mask.remove();

      const ring = document.getElementById('onboardingRing');
      if (ring) ring.remove();

      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('visible');

      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }

      currentStep = 1;

      // [FIX 2.5] Сохраняем только при реальном завершении/пропуске (не из reset()).
      if (!skipStorageSaveOnClose) {
        storage.save(STORAGE_KEY, true);
      }
    } finally {
      // [FIX 2.5] Флаг сбрасывается в любом случае — не «залипнет».
      skipStorageSaveOnClose = false;
    }
  }

  function init() {
    currentStep = 1;

    const oldOverlay = document.getElementById('onboardingOverlay');
    if (oldOverlay) oldOverlay.remove();
    const oldMask = document.getElementById('onboardingMask');
    if (oldMask) oldMask.remove();
    const oldRing = document.getElementById('onboardingRing');
    if (oldRing) oldRing.remove();

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }

    if (!storage.load(STORAGE_KEY)) {
      renderStep(currentStep);

      resizeHandler = () => {
        if (document.getElementById('onboardingOverlay')) {
          updateSpotlight(getStepHighlightSelector(currentStep));
        }
      };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function reset() {
    skipStorageSaveOnClose = true;
    storage.remove(STORAGE_KEY);
    currentStep = 1;
    close();

    // [FIX] Ждём, пока close() реально удалит overlay (через rAF + проверка),
    // прежде чем запускать init() заново. Это надёжнее фиксированного setTimeout(100).
    const tryReinit = () => {
      if (document.getElementById('onboardingOverlay')) {
        requestAnimationFrame(tryReinit);
        return;
      }
      if (!storage.load(STORAGE_KEY)) {
        init();
      }
    };
    requestAnimationFrame(tryReinit);
  }

  return { init, next, skip, close, reset };
})();