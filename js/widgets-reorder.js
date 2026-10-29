/**********************************************
 * Модуль: Перестановка виджетов по горизонтали
 * [NEW] Drag-and-drop для виджетов в .dashboard.
 * [FIX] Отменена блокировка перетаскивания климата и правых кнопок.
 * [FIX] Улучшен алгоритм вставки на крайние позиции (самый левый/правый).
 * [NEW] Порядок сохраняется в localStorage (widgetOrder).
 * [NEW] Скрытые виджеты сохраняют позицию и возвращаются при включении.
 * [NEW] Поддержка touch и mouse.
 * [NEW] Не конфликтует с обычными кликами (порог срабатывания 8px).
 **********************************************/

modules.widgetsReorder = (function() {
  const STORAGE_KEY = 'widgetOrder';
  const HOLD_DELAY_MS = 200;        // задержка перед стартом перетаскивания
  const MOVE_THRESHOLD_PX = 8;      // порог движения для старта drag
  const ANIMATION_MS = 180;

  const dashboard = document.querySelector('.dashboard');
  if (!dashboard) {
    return { init() {}, destroy() {}, refresh() {} };
  }

  // Все виджеты (включая скрытые). Порядок по умолчанию — как в HTML.
  let allWidgets = [];
  let dragState = null;
  let initialized = false;
  let longPressTimer = null;

  // ---------- Утилиты ----------

  function isWidgetElement(el) {
    if (!el || !el.classList) return false;
    if (!dashboard.contains(el)) return false;
    return el.classList.contains('widget') ||
           el.classList.contains('right-buttons') ||
           el.classList.contains('widget-wrapper') ||
           el.id === 'networkWidgetWrapper' ||
           el.id === 'widgetNavigation' ||
           el.id === 'widgetWeather' ||
           el.classList.contains('widget_weather') ||
           el.classList.contains('widget_navigation');
  }

  function getWidgetId(el) {
    if (el.dataset.widgetId) return el.dataset.widgetId;
    return null;
  }

  function assignDefaultIds() {
    const children = Array.from(dashboard.children).filter(isWidgetElement);
    let counter = 0;
    children.forEach(el => {
      if (!el.dataset.widgetId) {
        el.dataset.widgetId = 'w_' + (counter++);
      }
    });
    return children;
  }

  function collectAllWidgets() {
    return Array.from(dashboard.children).filter(isWidgetElement);
  }

  function getSavedOrder() {
    const raw = storage.load(STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  function saveOrder(ids) {
    storage.save(STORAGE_KEY, ids);
  }

  // ---------- Применение сохранённого порядка ----------

  function applySavedOrder() {
    const saved = getSavedOrder();
    if (!saved.length) return;

    const movable = allWidgets.slice();
    const orderIndex = new Map();
    saved.forEach((id, idx) => orderIndex.set(id, idx));

    // Сортируем все виджеты согласно сохраненному порядку
    movable.sort((a, b) => {
      const ia = orderIndex.has(getWidgetId(a)) ? orderIndex.get(getWidgetId(a)) : 9999;
      const ib = orderIndex.has(getWidgetId(b)) ? orderIndex.get(getWidgetId(b)) : 9999;
      return ia - ib;
    });

    movable.forEach(el => {
      dashboard.appendChild(el);
    });
  }

  // ---------- Drag logic ----------

  function getDragCandidates() {
    return Array.from(dashboard.children).filter(el => {
      if (!isWidgetElement(el)) return false;
      if (el.classList.contains('widget-hidden')) return false;
      if (el.classList.contains('off-mode-hidden')) return false;
      return true;
    });
  }

  function findWidgetFromPoint(x, y, excludeEl) {
    const el = document.elementFromPoint(x, y);
    if (!el || !dashboard.contains(el)) return null;
    let node = el;
    while (node && node !== dashboard) {
      if (node === excludeEl) return null;
      if (isWidgetElement(node)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function clearDropIndicators() {
    dashboard.querySelectorAll('.widget-drop-before, .widget-drop-after, .widget-dragging')
      .forEach(el => el.classList.remove('widget-drop-before', 'widget-drop-after', 'widget-dragging'));
  }

  function setDropIndicator(target, before) {
    if (!target) return;
    target.classList.add(before ? 'widget-drop-before' : 'widget-drop-after');
  }

  function startDrag(widget, startX, startY, pointerId) {
    dragState = {
      widget,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
      pointerId,
      moved: false,
      placeholderRect: widget.getBoundingClientRect(),
      dropTarget: null,
      dropBefore: true
    };
    widget.classList.add('widget-dragging');
    widget.style.transition = 'none';
    widget.style.zIndex = '999';
    widget.style.pointerEvents = 'none';
    widget.style.position = 'relative';
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
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

    const target = findWidgetFromPoint(clientX, clientY, dragState.widget);
    
    dashboard.querySelectorAll('.widget-drop-before, .widget-drop-after')
      .forEach(el => el.classList.remove('widget-drop-before', 'widget-drop-after'));

    if (target && target !== dragState.widget) {
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const before = clientX < centerX;
      setDropIndicator(target, before);
      dragState.dropTarget = target;
      dragState.dropBefore = before;
    } else {
      // Если мы не над другим виджетом, проверяем, не ушли ли мы за край
      const candidates = getDragCandidates().filter(el => el !== dragState.widget);
      if (candidates.length > 0) {
        const firstRect = candidates[0].getBoundingClientRect();
        const lastRect = candidates[candidates.length - 1].getBoundingClientRect();
        
        if (clientX < firstRect.left + firstRect.width / 2) {
          // Ставим перед первым
          setDropIndicator(candidates[0], true);
          dragState.dropTarget = candidates[0];
          dragState.dropBefore = true;
        } else if (clientX > lastRect.left + lastRect.width / 2) {
          // Ставим после последнего
          setDropIndicator(candidates[candidates.length - 1], false);
          dragState.dropTarget = candidates[candidates.length - 1];
          dragState.dropBefore = false;
        } else {
          dragState.dropTarget = null;
        }
      }
    }
  }

  function endDrag() {
    if (!dragState) return;
    const { widget, dropTarget, dropBefore, moved } = dragState;

    widget.style.transition = `transform ${ANIMATION_MS}ms ease`;
    widget.style.transform = '';
    widget.style.zIndex = '';
    widget.style.pointerEvents = '';

    clearDropIndicators();

    if (moved && dropTarget && dropTarget.parentNode === dashboard) {
      if (dropBefore) {
        dashboard.insertBefore(widget, dropTarget);
      } else {
        dashboard.insertBefore(widget, dropTarget.nextSibling);
      }
      persistOrderFromDom();
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
    return state;
  }

  function persistOrderFromDom() {
    const movable = collectAllWidgets();
    const ids = movable.map(el => getWidgetId(el)).filter(Boolean);
    saveOrder(ids);
  }

  // ---------- Touch ----------

  function onTouchStart(e) {
    if (!initialized) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const widget = findWidgetFromPoint(touch.clientX, touch.clientY, null);
    if (!widget) return;
    if (widget.dataset.dragJustEnded) return;

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
      const candidate = getDragCandidates().find(w => w._dragCtx);
      if (candidate && candidate._dragCtx) {
        const dx = touch.clientX - candidate._dragCtx.startX;
        const dy = touch.clientY - candidate._dragCtx.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MOVE_THRESHOLD_PX) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          allWidgets.forEach(w => { delete w._dragCtx; });
        }
      }
    }
  }

  function onTouchEnd(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    allWidgets.forEach(w => { delete w._dragCtx; });
    if (dragState) {
      endDrag();
    }
  }

  function onTouchCancel() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    allWidgets.forEach(w => { delete w._dragCtx; });
    if (dragState) {
      endDrag();
    }
  }

  // ---------- Mouse ----------

  function onMouseDown(e) {
    if (!initialized) return;
    if (e.button !== 0) return;
    const widget = findWidgetFromPoint(e.clientX, e.clientY, null);
    if (!widget) return;
    if (widget.dataset.dragJustEnded) return;

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
      const candidate = getDragCandidates().find(w => w._dragCtx);
      if (candidate && candidate._dragCtx) {
        const dx = e.clientX - candidate._dragCtx.startX;
        const dy = e.clientY - candidate._dragCtx.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MOVE_THRESHOLD_PX) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          allWidgets.forEach(w => { delete w._dragCtx; });
        }
      }
    }
  }

  function onMouseUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    allWidgets.forEach(w => { delete w._dragCtx; });
    if (dragState) {
      endDrag();
    }
  }

  // ---------- Init / destroy ----------

  function attachEvents() {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function detachEvents() {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchCancel);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function refresh() {
    allWidgets = collectAllWidgets();
    assignDefaultIds();
    applySavedOrder();
  }

  function init() {
    if (initialized) return;
    initialized = true;

    assignDefaultIds();
    allWidgets = collectAllWidgets();
    applySavedOrder();

    attachEvents();

    console.log('[WidgetsReorder] initialized');
  }

  function destroy() {
    detachEvents();
    initialized = false;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (dragState) {
      try { endDrag(); } catch (e) {}
    }
    clearDropIndicators();
  }

  return { init, destroy, refresh };
})();