/**********************************************
 * Модуль: Экран первого выбора ориентации
 * Показывается один раз, если пользователь
 * ещё не выбрал профиль (setting_layoutProfile отсутствует).
 * [NEW] Кнопка «Пройти обучение» — активна после выбора ориентации,
 *       запускает онбординг сразу после применения профиля.
 **********************************************/

modules.orientationPicker = (function() {
  const STORAGE_KEY = 'setting_layoutProfile';
  const PICKER_ID = 'orientationPickerOverlay';

  let overlay = null;
  let selected = null;
  let resolved = null;

  function markResolved(profile) {
    resolved = profile;
    if (typeof modules.layoutProfile === 'object') {
      modules.layoutProfile.set(profile, { toast: false });
    }
  }

  function buildOverlay() {
    const el = document.createElement('div');
    el.id = PICKER_ID;
    el.className = 'orientation-picker-overlay';

    el.innerHTML = `
      <div class="orientation-picker-content">
        <div class="orientation-picker-title">
          🖥️ Выберите ориентацию экрана
        </div>
        <div class="orientation-picker-subtitle">
          Панель выглядит по-разному на горизонтальных и вертикальных<br>
          экранах (15.6"). Выберите подходящий профиль.<br>
          Его можно изменить в любой момент в <strong>Настройках → Поведение</strong>.<br>
          <span style="display:block; margin-top:0.4rem; color: rgba(255, 200, 150, 0.85); font-size: 0.82rem;">
            ⚠️ На других размерах экрана — используйте на свой страх и риск.
          </span>
        </div>

        <div class="orientation-picker-options">
          <div class="orientation-option" data-profile="landscape" role="button" tabindex="0">
            <div class="orientation-option__preview orientation-option__preview--landscape">
              <div class="sq"></div>
              <div class="sq"></div>
              <div class="sq"></div>
              <div class="sq"></div>
              <div class="sq"></div>
            </div>
            <div class="orientation-option__label">Горизонтальный</div>
            <div class="orientation-option__hint">Виджеты в один ряд, как лента</div>
          </div>

          <div class="orientation-option" data-profile="portrait" role="button" tabindex="0">
            <div class="orientation-option__preview orientation-option__preview--portrait">
              <div class="row">
                <div class="sq"></div>
                <div class="sq"></div>
                <div class="sq"></div>
              </div>
              <div class="row">
                <div class="sq"></div>
                <div class="sq"></div>
                <div class="sq"></div>
              </div>
            </div>
            <div class="orientation-option__label">Вертикальный</div>
            <div class="orientation-option__hint">Виджеты в два ряда внизу</div>
          </div>
        </div>

        <div class="orientation-picker-buttons">
          <button type="button" class="orientation-picker-tutorial" disabled>
            🎓 Пройти обучение
          </button>
          <button type="button" class="orientation-picker-apply" disabled>
            Продолжить
          </button>
        </div>
      </div>
    `;

    const options = el.querySelectorAll('.orientation-option');
    const applyBtn = el.querySelector('.orientation-picker-apply');
    const tutorialBtn = el.querySelector('.orientation-picker-tutorial');

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selected = opt.getAttribute('data-profile');
        applyBtn.disabled = !selected;
        tutorialBtn.disabled = !selected;
      });
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opt.click();
        }
      });
    });

    applyBtn.addEventListener('click', () => {
      if (!selected) return;
      storage.save(STORAGE_KEY, selected);
      markResolved(selected);
      hide();
    });

    tutorialBtn.addEventListener('click', () => {
      if (!selected) return;
      storage.save(STORAGE_KEY, selected);
      markResolved(selected);
      hide();

      // Сброс флага онбординга, чтобы он гарантированно открылся
      storage.remove('onboarding_completed');
      setTimeout(() => {
        if (modules.onboarding && typeof modules.onboarding.init === 'function') {
          modules.onboarding.init();
        }
      }, 400);
    });

    return el;
  }

  function show() {
    if (overlay) return;
    overlay = buildOverlay();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      if (overlay) overlay.classList.add('visible');
    });
  }

  function hide() {
    if (!overlay) return;
    const el = overlay;
    overlay = null;
    el.classList.remove('visible');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 320);
  }

  function isResolved() {
    return resolved !== null || !!storage.load(STORAGE_KEY);
  }

  function getResolved() {
    return resolved || storage.load(STORAGE_KEY);
  }

  return {
    show,
    hide,
    isResolved,
    getResolved
  };
})();