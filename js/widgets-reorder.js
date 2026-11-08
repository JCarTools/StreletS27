/**********************************************
 * Модуль: Перестановка виджетов (drag&drop).
 * [FIX] Стабильный id: приоритет dataset.widgetId, затем id, затем класс.
 * [FIX] Сохраняем порядок ВСЕХ виджетов (включая скрытые), чтобы
 *       скрытие/показ не ломало раскладку.
 * [FIX] Landscape: единый плоский список.
 * [FIX] Portrait: два независимых ряда (row1/row2).
 * [FIX] Не сбрасываем сохранённый порядок при расхождении — неизвестные
 *       id просто дописываются в конец, а отсутствующие молча выпадают
 *       из примения (без перезаписи localStorage).
 * [FIX] Не цепляемся за вложенные .widget внутри .widget-wrapper.
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

  // [FIX] Стабильный id: не затираем уже назначенный.
  // Приоритет: dataset.widgetId -> id -> вычисленный по классу.
  function getWidgetId(el) {
    if (!el) return null;
    if (el.dataset && el.dataset.widgetId) return el.dataset.widgetId;
    if (el.id) {
      el.dataset.widgetId = el.id;
      return el.id;
    }
    return null;
  }

  function deriveIdFromClass(el) {
    if (!el || !el.classList) return null;
    if (el.id) return el.id;
    if (el.classList.contains('right-buttons')) return 'buttons';
    if (el.classList.contains('widget_player')) return 'player';
    if (el.classList.contains('widget_climate_2x3')) return 'climate';
    if (el.classList.contains('widget_apps')) return 'apps';
    if (el.classList.contains('widget_time')) return 'time';
    if (el.classList.contains('widget_weather')) return 'weather';
    if (el.classList.contains('widget_navigation')) return 'navigation';
    if (el.classList.contains('widget_compass')) return 'compass';
    if (el.classList.contains('widget_placeholder')) return 'network';
    return null;
  }

  // [FIX] Корневой виджет — прямой ребёнок .dashboard или .dashboard-row.
  function getRootWidget(node) {
    if (!node) return null;
    let cur = node;
    while (cur && cur !== dashboard) {
      const parent = cur.parentNode;
      if (parent === dashboard || isRowElement(parent)) {
        if (isWidgetElement(cur)) return cur;
        return null;
      }
      cur = parent;
    }
    return null;
  }

  function assignDefaultIds() {
    const all = collectFromContainer(dashboard);
    let counter = 0;
    all.forEach(el => {
      if (!getWidgetId(el)) {
        const derived = deriveIdFromClass(el);
        el.dataset.widgetId = derived || ('w_' + (counter++));
      }
    });
  }

  // [FIX] Только «корневые» виджеты (прямые дети dashboard / dashboard-row).
  function collectFromContainer(container) {
    const out = [];
    Array.from(container.children).forEach(el => {
      if (isRowElement(el)) {
        Array.from(el.children).forEach(child => {
          if (isWidgetElement(child)) out.push(child);
        });
      } else if (isWidgetElement(el)) {
        out.push(el);
      }
    });
    return out;
  }

  // [FIX] Возвращаем ВСЕ виджеты, включая скрытые — иначе порядок ломается.
  function getAllWidgets() {
    return collectFromContainer(dashboard);
  }

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

  function readRowIds(row) {
    if (!row) return [];
    return Array.from(row.children)
      .filter(isWidgetElement)
      .map(getWidgetId)
      .filter(Boolean);
  }

  function readFlatIds() {
    return getAllWidgets().map(getWidgetId).filter(Boolean);
  }

  function idsEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // [FIX] Применяем порядок: сначала идут сохранённые, затем недостающие
  // (в текущем DOM-порядке) — без сброса localStorage.
  function applyLandscapeOrder() {
    const saved = getSavedLandscapeOrder();
    const allWidgets = collectFromContainer(dashboard);
    const allIds = allWidgets.map(getWidgetId).filter(Boolean);

    if (!allIds.length) return;

    if (!saved.length) {
      saveLandscapeOrder(allIds);
      return;
    }

    const actualFlat = readFlatIds();
    if (idsEqual(actualFlat, saved)) return;

    const byId = new Map();
    allWidgets.forEach(el => byId.set(getWidgetId(el), el));

    // Собираем итоговый список: сохранённые id + недостающие в конце.
    const orderedIds = [];
    const seen = new Set();
    saved.forEach(id => {
      if (byId.has(id) && !seen.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    });
    allIds.forEach(id => {
      if (!seen.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    });

    const rows = getRows();
    const targetRow = rows[0] || dashboard;

    orderedIds.forEach(id => {
      const el = byId.get(id);
      if (el) targetRow.appendChild(el);
    });

    // Обновляем localStorage, добавляя недостающие id, но сохраняя исходный порядок.
    saveLandscapeOrder(orderedIds);
  }

  function applyPortraitOrder() {
    const rows = getRows();
    if (!rows.length) return;

    const saved = getSavedPortraitOrder();
    const allWidgets = collectFromContainer(dashboard);
    const allIds = allWidgets.map(getWidgetId).filter(Boolean);

    if (!allIds.length) return;

    const savedRow1 = saved.row1 || [];
    const savedRow2 = saved.row2 || [];

    if (!savedRow1.length && !savedRow2.length) {
      savePortraitOrder({
        row1: readRowIds(rows[0]),
        row2: rows[1] ? readRowIds(rows[1]) : []
      });
      return;
    }

    const actualRow1 = readRowIds(rows[0]);
    const actualRow2 = rows[1] ? readRowIds(rows[1]) : [];

    const row1Equal = idsEqual(actualRow1, savedRow1);
    const row2Equal = rows[1] ? idsEqual(actualRow2, savedRow2) : true;

    if (row1Equal && row2Equal) return;

    const byId = new Map();
    allWidgets.forEach(el => byId.set(getWidgetId(el), el));

    // Для каждого ряда: сохранённые + недостающие (из общего пула) в конце.
    const buildOrdered = (savedIds, actualIds) => {
      const ordered = [];
      const seen = new Set();
      savedIds.forEach(id => {
        if (byId.has(id) && !seen.has(id)) {
          ordered.push(id);
          seen.add(id);
        }
      });
      actualIds.forEach(id => {
        if (!seen.has(id)) {
          ordered.push(id);
          seen.add(id);
        }
      });
      return ordered;
    };

    // Соберём все id, которые уже «заняты» сохранёнными рядами.
    const claimed = new Set([...savedRow1, ...savedRow2]);

    // Недостающие (новые) — сначала распределяем по их текущему ряду,
    // иначе складываем в row1.
    const newRow1 = [];
    const newRow2 = [];
    const row1Children = new Set(readRowIds(rows[0]));
    allIds.forEach(id => {
      if (claimed.has(id)) return;
      if (row1Children.has(id)) newRow1.push(id);
      else newRow2.push(id);
    });

    const finalRow1 = buildOrdered(savedRow1, newRow1);
    const finalRow2 = rows[1] ? buildOrdered(savedRow2, newRow2) : [];

    finalRow1.forEach(id => {
      const el = byId.get(id);
      if (el) rows[0].appendChild(el);
    });
    if (rows[1]) {
      finalRow2.forEach(id => {
        const el = byId.get(id);
        if (el) rows[1].appendChild(el);
      });
    }

    savePortraitOrder({ row1: finalRow1, row2: finalRow2 });
  }

  function applyOrder() {
    if (isPortrait()) applyPortraitOrder();
    else applyLandscapeOrder();
  }

  function getContainerOf(el) {
    if (!el) return null;
    if (isRowElement(el.parentNode)) return el.parentNode;
    if (el.parentNode === dashboard) return dashboard;
    return null;
  }

  function findWidgetFromPoint(x, y, excludeEl) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.closest(INTERACTIVE_INSIDE_SELECTOR)) return null;
    const root = getRootWidget(el);
    if (!root) return null;
    if (excludeEl && root === excludeEl) return null;
    return root;
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

  function findRowAtPoint(clientX, clientY) {
    const rows = getRows();
    if (!rows.length) return dashboard;

    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        return row;
      }
    }
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

  function persistOrder() {
    if (isPortrait()) {
      const rows = getRows();
      const row1 = rows[0] ? readRowIds(rows[0]) : [];
      const row2 = rows[1] ? readRowIds(rows[1]) : [];
      savePortraitOrder({ row1, row2 });
    } else {
      saveLandscapeOrder(readFlatIds());
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
        if (originalContainer && originalContainer.appendChild) {
          originalContainer.appendChild(widget);
        }
      }
      persistOrder();
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