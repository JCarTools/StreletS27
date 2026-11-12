/**********************************************
 * Модуль: Экран первого выбора ориентации
 * Показывается один раз, если пользователь
 * ещё не выбрал профиль (setting_layoutProfile отсутствует).
 * [FIX] tutorialBtn больше НЕ вызывает modules.onboarding.init() напрямую.
 *       Вместо этого выставляется флаг pendingOnboarding, который читает main.js
 *       в scheduleOnboarding(). Это устраняет двойной запуск онбординга.
 * [NEW] Кнопка «Пройти обучение» активна после выбора ориентации.
 * [FIX 2.13] markResolved: проверяем именно наличие метода set у layoutProfile,
 *       а не typeof ... === 'object' (последняя всегда true — это объект-IIFE).
 *       Теперь fallback реально срабатывает, если layoutProfile недоступен.
 **********************************************/

modules.orientationPicker = (function() {
  const STORAGE_KEY = 'setting_layoutProfile';
  const PICKER_ID = 'orientationPickerOverlay';

  let overlay = null;
  let selected = null;
  let resolved = null;
  let pendingOnboarding = false;

  function markResolved(profile) {
    resolved = profile;

    // [FIX 2.13] Проверяем именно наличие метода set, а не тип объекта.
    const layoutProfile = (typeof modules !== 'undefined') ? modules.layoutProfile : null;
    if (layoutProfile && typeof layoutProfile.set === 'function') {
      layoutProfile.set(profile, { toast: false });
    } else {
      // Fallback: пишем напрямую, если layoutProfile недоступен.
      storage.save(STORAGE_KEY, profile);
      document.body.classList.remove('layout-portrait', 'layout-landscape');
      document.body.classList.add(profile === 'portrait' ? 'layout-portrait' : 'layout-landscape');
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
      markResolved(selected);
      pendingOnboarding = false;
      hide();
    });

    // [FIX] Не вызываем onboarding.init() здесь. Только ставим флаг.
    // main.js подхватит и запустит онбординг ровно один раз.
    tutorialBtn.addEventListener('click', () => {
      if (!selected) return;
      markResolved(selected);
      storage.remove('onboarding_completed');
      pendingOnboarding = true;
      hide();
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

  // [FIX] Публичный флаг: пользователь нажал «Пройти обучение».
  function consumePendingOnboarding() {
    const v = pendingOnboarding;
    pendingOnboarding = false;
    return v;
  }

  return {
    show,
    hide,
    isResolved,
    getResolved,
    consumePendingOnboarding
  };
})();