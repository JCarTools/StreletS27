/**********************************************
 * Модуль: Профиль раскладки (горизонталь/вертикаль)
 * - Применяет класс body.layout-portrait / body.layout-landscape
 * - Хранит выбор в localStorage (setting_layoutProfile)
 * - Первичный выбор ориентации (если не задано) — через onboarding-orientation
 * [FIX 19] Ре-рендер раскладки сделан детерминированным:
 *       - Убран хрупкий setTimeout(50) (мог сработать до применения CSS).
 *       - Вместо него — двойной requestAnimationFrame + ResizeObserver на
 *         .dashboard. Смена display: contents → flex меняет размеры, что
 *         гарантирует корректный layout к моменту widgetsReorder.refresh().
 *       - Добавлен destroy() для снятия observer при переинициализации.
 **********************************************/

modules.layoutProfile = (function() {
  const STORAGE_KEY = 'setting_layoutProfile';
  const PORTRAIT_CLASS = 'layout-portrait';
  const LANDSCAPE_CLASS = 'layout-landscape';

  let current = null;
  let resizeObserver = null;
  let observerTarget = null;
  let pendingRefresh = false;

  function normalize(value) {
    if (value === 'portrait') return 'portrait';
    if (value === 'landscape') return 'landscape';
    return null;
  }

  function getSaved() {
    return normalize(storage.load(STORAGE_KEY));
  }

  // [FIX 19] Детерминированный ре-рендер. Двойной rAF:
  //   1-й — браузер применил новые стили (класс на body),
  //   2-й — layout пересчитан (getBoundingClientRect отдаёт актуальные размеры).
  // Дополнительно ResizeObserver на .dashboard ловит изменение размеров
  // при display: contents → flex, что служит вторым сигналом.
  function scheduleRefresh() {
    if (pendingRefresh) return;
    pendingRefresh = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pendingRefresh = false;
        if (modules.widgetsReorder && typeof modules.widgetsReorder.refresh === 'function') {
          try { modules.widgetsReorder.refresh(); } catch (e) {}
        }
      });
    });
  }

  // [FIX 19] Observer на .dashboard. Если размеры меняются (display: contents → flex
  // или изменение ширины/высоты из-за смены профиля) — планируем refresh.
  function attachObserver() {
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;
    if (resizeObserver && observerTarget === dashboard) return;

    if (resizeObserver && observerTarget) {
      try { resizeObserver.unobserve(observerTarget); } catch (e) {}
    }
    if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleRefresh());
    }
    if (resizeObserver) {
      observerTarget = dashboard;
      try { resizeObserver.observe(dashboard); } catch (e) {}
    }
  }

  function apply(profile) {
    const p = normalize(profile) || 'landscape';
    current = p;

    document.body.classList.remove(PORTRAIT_CLASS, LANDSCAPE_CLASS);
    document.body.classList.add(p === 'portrait' ? PORTRAIT_CLASS : LANDSCAPE_CLASS);

    scheduleRefresh();
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
    attachObserver();
    const saved = getSaved();
    if (saved) {
      apply(saved);
    } else {
      apply('landscape');
    }
  }

  // [FIX 19] Полная очистка observer'а и флага. Вызывается из cleanupIntervals()
  // в main.js, чтобы при повторной инициализации не накапливались observers.
  function destroy() {
    if (resizeObserver && observerTarget) {
      try { resizeObserver.unobserve(observerTarget); } catch (e) {}
    }
    if (resizeObserver) {
      try { resizeObserver.disconnect(); } catch (e) {}
      resizeObserver = null;
    }
    observerTarget = null;
    pendingRefresh = false;
  }

  function hasChoice() {
    return getSaved() !== null;
  }

  return {
    init,
    destroy,
    apply,
    set,
    get: () => current,
    hasChoice
  };
})();