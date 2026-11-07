/**********************************************
 * Модуль: Перестановка виджетов (drag&drop).
 * Поддержка двух раскладок:
 *  - landscape: .dashboard содержит .dashboard-row (display:contents),
 *    виджеты — прямые дети .dashboard-row--top/--bottom.
 *  - portrait:  те же два ряда, но с display:flex.
 * [FIX] collectFromContainer теперь «проваливается» сквозь
 *       .dashboard-row (display:contents), собирая настоящие виджеты.
 * [FIX] getContainerOf возвращает реальный .dashboard-row,
 *       в который нужно вставлять.
 * [FIX] findWidgetFromPoint: возвращает сам виджет, а не обёртку.
 **********************************************/

modules.widgetsReorder = (function() {
  const LANDSCAPE_ORDER_KEY = 'widgetOrder';
  const PORTRAIT_ORDER_KEY = 'widgetOrderPortrait';
  const HOLD_DELAY_MS = 500;
  const MOVE_THRESHOLD_PX = 8;
  const ANIMATION_MS = 180;

  const dashboard = document.querySelector('.dashboard');
  if (!dashboard) {
    return { init() {}, destroy() {}, refresh() {} };
  }

  const INTERACTIVE_INSIDE_SELECTOR = [
    '.widget_buttons',
    '.widget_player__btn',
    '.widget_player__track_line',
    '.widget_player__volume_slider',
    '.app_slot',
    '.climate_slot',
    '.climate-off-all',
    '#btnNetwork',
    '#btnClose',
    '#btnSettings',
    '#btnWallpaper',
    '#openSidebar',
    '.climate-temp-zone',
    '.climate-temp-carousel'
  ].join(',');

  let dragState = null;
  let initialized = false;
  let longPressTimer = null;
  let reorderMode = false;

  function isPortrait() {
    return document.body.classList.contains('layout-portrait');
  }

  function isRowElement(el) {
    return el && el.classList && el.classList.contains('dashboard-row');
  }

  function isWidgetElement(el) {
    if (!el || !el.classList) return false;
    return el.classList.contains('widget') ||
           el.classList.contains('right-buttons') ||
           el.classList.contains('widget-wrapper') ||
           el.id === 'networkWidgetWrapper' ||
           el.id === 'widgetNavigation' ||
           el.id === 'widgetWeather' ||
           el.id === 'widgetCompass' ||
           el.classList.contains('widget_weather') ||
           el.classList.contains('widget_navigation') ||
           el.classList.contains('widget_compass');
  }

  function getWidgetId(el) {
    return el.dataset.widgetId || null;
  }

  function assignDefaultIds() {
    const all = dashboard.querySelectorAll('[data-widget-id]');
    all.forEach((el, idx) => {
      if (!getWidgetId(el)) {
        el.dataset.widgetId = 'w_' + idx;
      }
    });
  }

  // Собираем реальные виджеты, «проваливаясь» сквозь .dashboard-row
  function collectFromContainer(container) {
    const out = [];
    Array.from(container.children).forEach(el => {
      if (isWidgetElement(el)) {
        out.push(el);
      } else if (isRowElement(el)) {
        Array.from(el.children).forEach(child => {
          if (isWidgetElement(child)) out.push(child);
        });
      }
    });
    return out;
  }

  // Все видимые виджеты (для глобального поиска)
  function getAllWidgets() {
    return collectFromContainer(dashboard).filter(el => {
      if (el.classList.contains('widget-hidden')) return false;
      if (el.classList.contains('off-mode-hidden')) return false;
      return true;
    });
  }

  // === Порядок: сохранение / восстановление ===

  function getSavedLandscapeOrder() {
    const raw = storage.load(LANDSCAPE_ORDER_KEY);
    return Array.isArray(raw) ? raw : [];
  }
  function saveLandscapeOrder(ids) { storage.save(LANDSCAPE_ORDER_KEY, ids); }

  function getSavedPortraitOrder() {
    const raw = storage.load(PORTRAIT_ORDER_KEY);
    if (raw && typeof raw === 'object' && Array.isArray(raw.row1) && Array.isArray(raw.row2)) {
      return raw;
    }
    return { row1: [], row2: [] };
  }
  function savePortraitOrder(order) { storage.save(PORTRAIT_ORDER_KEY, order); }

  function getRows() {
    return Array.from(dashboard.querySelectorAll('.dashboard-row'));
  }

  function applyLandscapeOrder() {
    const saved = getSavedLandscapeOrder();
    const all = collectFromContainer(dashboard);
    const currentIds = all.map(getWidgetId).filter(Boolean);
    const currentSet = new Set(currentIds);

    const result = [];
    for (const id of saved) {
      if (currentSet.has(id) && !result.includes(id)) result.push(id);
    }
    for (const id of currentIds) {
      if (!result.includes(id)) result.push(id);
    }
    if (result.length !== saved.length || result.some((v, i) => v !== saved[i])) {
      saveLandscapeOrder(result);
    }

    const byId = new Map();
    all.forEach(el => byId.set(getWidgetId(el), el));

    // Вставляем в первый .dashboard-row, если он есть, иначе в dashboard
    const row = getRows()[0] || dashboard;
    result.forEach(id => {
      const el = byId.get(id);
      if (el) row.appendChild(el);
    });
  }

  function applyPortraitOrder() {
    const rows = getRows();
    if (!rows.length) return;
    const saved = getSavedPortraitOrder();
    const all = collectFromContainer(dashboard);
    const byId = new Map();
    all.forEach(el => byId.set(getWidgetId(el), el));

    const placed = new Set();
    const placeTo = (row, ids) => {
      ids.forEach(id => {
        const el = byId.get(id);
        if (!el || placed.has(el)) return;
        placed.add(el);
        row.appendChild(el);
      });
    };

    placeTo(rows[0], saved.row1);
    if (rows[1]) placeTo(rows[1], saved.row2);

    all.forEach(el => {
      if (placed.has(el)) return;
      const targetRow = rows[1] || rows[0];
      targetRow.appendChild(el);
    });

    const row1Ids = Array.from(rows[0].children).filter(isWidgetElement).map(getWidgetId).filter(Boolean);
    const row2Ids = rows[1] ? Array.from(rows[1].children).filter(isWidgetElement).map(getWidgetId).filter(Boolean) : [];
    savePortraitOrder({ row1: row1Ids, row2: row2Ids });
  }

  function applyOrder() {
    if (isPortrait()) applyPortraitOrder();
    else applyLandscapeOrder();
  }

  // Возвращает .dashboard-row, в котором лежит виджет
  function getContainerOf(el) {
    if (!el) return null;
    if (isRowElement(el.parentNode)) return el.parentNode;
    if (el.parentNode === dashboard) return dashboard;
    return null;
  }

  // Поиск виджета по точке: поднимаемся от elementFromPoint вверх
  function findWidgetFromPoint(x, y, excludeEl) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    if (el.closest(INTERACTIVE_INSIDE_SELECTOR)) return null;

    let node = el;
    while (node && node !== dashboard) {
      if (node === excludeEl) return null;
      if (isWidgetElement(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function clearDropIndicators() {
    dashboard.querySelectorAll('.widget-drop-before, .widget-drop-after, .widget-dragging')
      .forEach(el => el.classList.remove('widget-drop-before', 'widget-drop-after', 'widget-dragging'));
    getRows().forEach(r => r.classList.remove('drag-hover-target'));
  }

  function setDropIndicator(target, before) {
    if (!target) return;
    target.classList.add(before ? 'widget-drop-before' : 'widget-drop-after');
  }

  function enterReorderMode() {
    if (reorderMode) return;
    reorderMode = true;
    dashboard.classList.add('reorder-mode');
    document.body.classList.add('reorder-active');
  }

  function exitReorderMode() {
    if (!reorderMode) return;
    reorderMode = false;
    dashboard.classList.remove('reorder-mode');
    document.body.classList.remove('reorder-active');
    clearDropIndicators();
  }

  function startDrag(widget, startX, startY, pointerId) {
    enterReorderMode();
    dragState = {
      widget,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
      pointerId,
      moved: false,
      dropTarget: null,
      dropBefore: true,
      originalContainer: widget.parentNode
    };
    widget.classList.add('widget-dragging');
    widget.style.transition = 'none';
    widget.style.zIndex = '999';
    widget.style.pointerEvents = 'none';
    widget.style.position = 'relative';
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
  }

  // Определяем, в каком .dashboard-row находится точка; если ни в каком — ближайший
  function findRowAtPoint(clientX, clientY) {
    const rows = getRows();
    if (!rows.length) return dashboard;

    // Точное попадание
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        return row;
      }
    }
    // Ближайший по Y
    let bestRow = rows[0];
    let bestDist = Infinity;
    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cy = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - cy);
      if (dist < bestDist) { bestDist = dist; bestRow = row; }
    });
    return bestRow;
  }

  function computeDropTarget(clientX, clientY, excludeWidget) {
    const hit = findWidgetFromPoint(clientX, clientY, excludeWidget);
    if (hit) {
      const r = hit.getBoundingClientRect();
      return {
        target: hit,
        before: clientX < r.left + r.width / 2,
        container: getContainerOf(hit) || hit.parentNode
      };
    }

    const row = findRowAtPoint(clientX, clientY);
    if (!row) return { target: null, before: true, container: null };

    const candidates = Array.from(row.children).filter(el => {
      if (!isWidgetElement(el)) return false;
      if (el === excludeWidget) return false;
      if (el.classList.contains('widget-hidden')) return false;
      if (el.classList.contains('off-mode-hidden')) return false;
      return true;
    });

    if (!candidates.length) {
      return { target: null, before: true, container: row };
    }

    let bestTarget = null;
    let bestDistX = Infinity;
    let bestBefore = true;
    candidates.forEach(el => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const distX = Math.abs(clientX - cx);
      if (distX < bestDistX) {
        bestDistX = distX;
        bestTarget = el;
        bestBefore = clientX < cx;
      }
    });

    return { target: bestTarget, before: bestBefore, container: row };
  }

  function moveDrag(clientX, clientY) {
    if (!dragState) return;
    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    if (!dragState.moved) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOVE_THRESHOLD_PX) return;
      dragState.moved = true;
    }

    dragState.widget.style.transform = `translate(${dx}px, ${dy}px)`;
    dragState.lastX = clientX;
    dragState.lastY = clientY;

    dashboard.querySelectorAll('.widget-drop-before, .widget-drop-after')
      .forEach(el => el.classList.remove('widget-drop-before', 'widget-drop-after'));

    const { target, before, container } = computeDropTarget(clientX, clientY, dragState.widget);

    getRows().forEach(r => r.classList.toggle('drag-hover-target', r === container));

    if (target) {
      setDropIndicator(target, before);
      dragState.dropTarget = target;
      dragState.dropBefore = before;
    } else {
      dragState.dropTarget = null;
    }
  }

  function endDrag() {
    if (!dragState) return;
    const { widget, dropTarget, dropBefore, moved, originalContainer } = dragState;

    widget.style.transition = `transform ${ANIMATION_MS}ms ease`;
    widget.style.transform = '';
    widget.style.zIndex = '';
    widget.style.pointerEvents = '';

    clearDropIndicators();

    if (moved) {
      if (dropTarget) {
        const targetContainer = getContainerOf(dropTarget) || dropTarget.parentNode;
        if (targetContainer) {
          if (dropBefore) targetContainer.insertBefore(widget, dropTarget);
          else targetContainer.insertBefore(widget, dropTarget.nextSibling);
        }
      } else {
        // Не попали ни в один виджет — возвращаем в исходный контейнер
        if (originalContainer && originalContainer.appendChild) {
          originalContainer.appendChild(widget);
        }
      }

      // Сохраняем порядок
      if (isPortrait()) {
        const rows = getRows();
        const row1Ids = rows[0] ? Array.from(rows[0].children).filter(isWidgetElement).map(getWidgetId).filter(Boolean) : [];
        const row2Ids = rows[1] ? Array.from(rows[1].children).filter(isWidgetElement).map(getWidgetId).filter(Boolean) : [];
        savePortraitOrder({ row1: row1Ids, row2: row2Ids });
      } else {
        const rows = getRows();
        const row = rows[0] || dashboard;
        const ids = Array.from(row.children).filter(isWidgetElement).map(getWidgetId).filter(Boolean);
        saveLandscapeOrder(ids);
      }
    }

    const state = dragState;
    dragState = null;

    setTimeout(() => {
      widget.style.transition = '';
      widget.classList.remove('widget-dragging');
    }, ANIMATION_MS + 20);

    if (moved) {
      widget.dataset.dragJustEnded = '1';
      setTimeout(() => { delete widget.dataset.dragJustEnded; }, 50);
    }

    exitReorderMode();
    return state;
  }

  // === Обработчики ===

  function onMouseDown(e) {
    if (!initialized) return;
    if (e.button !== 0) return;
    const widget = findWidgetFromPoint(e.clientX, e.clientY, null);
    if (!widget || widget.dataset.dragJustEnded) return;

    const startX = e.clientX;
    const startY = e.clientY;

    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      startDrag(widget, startX, startY, 'mouse');
    }, HOLD_DELAY_MS);

    widget._dragCtx = { startX, startY, pointerId: 'mouse' };
  }

  function onMouseMove(e) {
    if (dragState) {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
      return;
    }
    if (longPressTimer) {
      const candidate = getAllWidgets().find(w => w._dragCtx);
      if (candidate && candidate._dragCtx) {
        const dx = e.clientX - candidate._dragCtx.startX;
        const dy = e.clientY - candidate._dragCtx.startY;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          getAllWidgets().forEach(w => { delete w._dragCtx; });
        }
      }
    }
  }

  function onMouseUp() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    getAllWidgets().forEach(w => { delete w._dragCtx; });
    if (dragState) endDrag();
    else if (reorderMode) exitReorderMode();
  }

  function onTouchStart(e) {
    if (!initialized) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const widget = findWidgetFromPoint(touch.clientX, touch.clientY, null);
    if (!widget || widget.dataset.dragJustEnded) return;

    const startX = touch.clientX;
    const startY = touch.clientY;
    const pointerId = touch.identifier;

    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      startDrag(widget, startX, startY, pointerId);
    }, HOLD_DELAY_MS);

    widget._dragCtx = { startX, startY, pointerId };
  }

  function onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (dragState) {
      if (e.cancelable) e.preventDefault();
      moveDrag(touch.clientX, touch.clientY);
      return;
    }

    if (longPressTimer) {
      const candidate = getAllWidgets().find(w => w._dragCtx);
      if (candidate && candidate._dragCtx) {
        const dx = touch.clientX - candidate._dragCtx.startX;
        const dy = touch.clientY - candidate._dragCtx.startY;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          getAllWidgets().forEach(w => { delete w._dragCtx; });
        }
      }
    }
  }

  function onTouchEnd() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    getAllWidgets().forEach(w => { delete w._dragCtx; });
    if (dragState) endDrag();
    else if (reorderMode) exitReorderMode();
  }

  function attachEvents() {
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
  }

  function detachEvents() {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);
  }

  function refresh() {
    assignDefaultIds();
    applyOrder();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    assignDefaultIds();
    applyOrder();
    attachEvents();
    console.log('[WidgetsReorder] initialized');
  }

  function destroy() {
    detachEvents();
    initialized = false;
    exitReorderMode();
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (dragState) { try { endDrag(); } catch (e) {} }
    clearDropIndicators();
  }

  return { init, destroy, refresh };
})();