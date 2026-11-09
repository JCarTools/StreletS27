/**********************************************
 * Модуль: Профиль раскладки (горизонталь/вертикаль)
 * - Применяет класс body.layout-portrait / body.layout-landscape
 * - Хранит выбор в localStorage (setting_layoutProfile)
 * - Первичный выбор ориентации (если не задано) — через onboarding-orientation
 * [FIX] apply(): вызов widgetsReorder.refresh() отложен через requestAnimationFrame.
 *       Раньше refresh() вызывался синхронно сразу после добавления класса,
 *       до того как браузер применял CSS (display: contents -> display: flex).
 *       Из-за этого widgetsReorder не находил верхний ряд в портретном режиме
 *       и не мог перетащить туда виджеты на некоторых устройствах.
 **********************************************/

modules.layoutProfile = (function() {
  const STORAGE_KEY = 'setting_layoutProfile';
  const PORTRAIT_CLASS = 'layout-portrait';
  const LANDSCAPE_CLASS = 'layout-landscape';

  let current = null;
  let refreshTimer = null;

  function normalize(value) {
    if (value === 'portrait') return 'portrait';
    if (value === 'landscape') return 'landscape';
    return null;
  }

  function getSaved() {
    return normalize(storage.load(STORAGE_KEY));
  }

  function apply(profile) {
    const p = normalize(profile) || 'landscape';
    current = p;

    document.body.classList.remove(PORTRAIT_CLASS, LANDSCAPE_CLASS);
    document.body.classList.add(p === 'portrait' ? PORTRAIT_CLASS : LANDSCAPE_CLASS);

    // [FIX] Откладываем обновление раскладки виджетов, чтобы браузер успел
    // пересчитать стили (display: contents -> flex). Иначе widgetsReorder
    // не видит верхний ряд и не может в него перетащить виджеты.
    if (refreshTimer) clearTimeout(refreshTimer);
    
    requestAnimationFrame(() => {
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (modules.widgetsReorder && typeof modules.widgetsReorder.refresh === 'function') {
          try { modules.widgetsReorder.refresh(); } catch (e) {}
        }
      }, 50);
    });
  }

  function set(profile, opts) {
    const p = normalize(profile);
    if (!p) return false;
    storage.save(STORAGE_KEY, p);
    apply(p);
    if (opts && opts.toast && typeof showToast === 'function') {
      showToast(p === 'portrait' ? 'Вертикальный профиль' : 'Горизонтальный профиль', 1500);
    }
    return true;
  }

  function init() {
    const saved = getSaved();
    if (saved) {
      apply(saved);
    } else {
      apply('landscape');
    }
  }

  function hasChoice() {
    return getSaved() !== null;
  }

  return {
    init,
    apply,
    set,
    get: () => current,
    hasChoice
  };
})();