/**********************************************
 * Модуль: Профиль раскладки (горизонталь/вертикаль)
 * - Применяет класс body.layout-portrait / body.layout-landscape
 * - Хранит выбор в localStorage (setting_layoutProfile)
 * - Первичный выбор ориентации (если не задано) — через onboarding-orientation
 **********************************************/

modules.layoutProfile = (function() {
  const STORAGE_KEY = 'setting_layoutProfile';
  const PORTRAIT_CLASS = 'layout-portrait';
  const LANDSCAPE_CLASS = 'layout-landscape';

  let current = null;

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

    // Уведомляем widgets-reorder, что раскладка поменялась
    if (modules.widgetsReorder && typeof modules.widgetsReorder.refresh === 'function') {
      try { modules.widgetsReorder.refresh(); } catch (e) {}
    }
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