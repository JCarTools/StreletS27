/**********************************************
 * Модуль: Виджет «Компас».
 * Все элементы увеличены (кольцо, тики, буквы, шипы).
 * Внутреннее кольцо приближено к тикам.
 * [FIX 6.5] Демо-режим останавливается при document.hidden (свёрнутая вкладка/
 *       WebView) — раньше demoTimer с интервалом 50 мс крутился вхолостую,
 *       нагружая CPU. Добавлен visibilitychange-обработчик, который
 *       останавливает демо при скрытии и возобновляет при возврате
 *       (только если реальных данных ещё нет).
 * [FIX 6.5] setHeading(deg, immediate): stopDemo() вызывается ПЕРВЫМ —
 *       и для immediate, и для обычного режима. Раньше при immediate
 *       демо могло остаться запущенным.
 * [FIX] visibilityHandler сохраняется в модуле и снимается в destroy().
 * [FIX] hasRealData сбрасывается в destroy() — при повторной init() демо
 *       снова запустится, если реальных данных не будет.
 **********************************************/

modules.compass = (function() {
  const DIRECTIONS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let svgEl = null;
  let ticksEl = null;
  let labelsEl = null;
  let arrowsEl = null;
  let directionEl = null;
  let heading = 0;
  let targetHeading = 0;
  let rafId = null;
  let demoTimer = null;
  let hasRealData = false;
  let eventsBound = false;
  let eventBusHandlers = [];
  let visibilityHandler = null;

  const CX = 100;
  const CY = 100;
  // Кольца
  const RING_OUTER_R = 96;      // внешнее (основа тиков)
  const RING_INNER_R = 86;      // внутреннее (ближе к тикам)
  // Тики
  const TICK_OUTER_R = RING_OUTER_R;
  const TICK_LEN_MINOR = 4;
  const TICK_LEN_MAJOR = 7;
  const TICK_LEN_CARDINAL = 10;
  // Буквы
  const LABEL_R = 72;
  // Шипы
  const SPIKE_HALF_ANGLE_DEG = 7;
  const SPIKE_HEIGHT = 11;

  const SMOOTH_FACTOR = 0.15;
  const DEMO_TICK_MS = 50;
  const DEMO_START_DELAY_MS = 2000;

  function polarToXY(radius, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: CX + radius * Math.cos(rad),
      y: CY + radius * Math.sin(rad)
    };
  }

  function buildTicks() {
    if (!ticksEl) return;
    ticksEl.textContent = '';
    for (let angle = 0; angle < 360; angle += 5) {
      const isCardinal = (angle % 90 === 0);
      const isMajor = (angle % 15 === 0);
      const len = isCardinal ? TICK_LEN_CARDINAL : (isMajor ? TICK_LEN_MAJOR : TICK_LEN_MINOR);

      const rad = (angle - 90) * Math.PI / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const x1 = CX + TICK_OUTER_R * cosA;
      const y1 = CY + TICK_OUTER_R * sinA;
      const x2 = CX + (TICK_OUTER_R - len) * cosA;
      const y2 = CY + (TICK_OUTER_R - len) * sinA;

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('class', 'compass-tick'
        + (isCardinal ? ' compass-tick--cardinal' : '')
        + (!isCardinal && isMajor ? ' compass-tick--major' : ''));
      ticksEl.appendChild(line);
    }
  }

  function buildArrows() {
    if (!arrowsEl) return;
    arrowsEl.textContent = '';
    const dirs = [
      { angle: 0, cls: 'compass-arrow compass-arrow--north' },
      { angle: 90, cls: 'compass-arrow' },
      { angle: 180, cls: 'compass-arrow' },
      { angle: 270, cls: 'compass-arrow' }
    ];

    dirs.forEach(dir => {
      const a1 = dir.angle - SPIKE_HALF_ANGLE_DEG;
      const a2 = dir.angle + SPIKE_HALF_ANGLE_DEG;
      const p1 = polarToXY(RING_OUTER_R, a1);
      const p2 = polarToXY(RING_OUTER_R, a2);
      const tip = polarToXY(RING_OUTER_R + SPIKE_HEIGHT, dir.angle);

      const d = [
        `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
        `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        `L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)}`,
        `Z`
      ].join(' ');

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', dir.cls);
      arrowsEl.appendChild(path);
    });
  }

  function buildLabels() {
    if (!labelsEl) return;
    labelsEl.textContent = '';
    const cardinal = [
      { label: 'С', angle: 0, isNorth: true },
      { label: 'В', angle: 90 },
      { label: 'Ю', angle: 180 },
      { label: 'З', angle: 270 }
    ];
    cardinal.forEach(item => {
      const p = polarToXY(LABEL_R, item.angle);
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', p.x.toFixed(2));
      text.setAttribute('y', p.y.toFixed(2));
      text.setAttribute('class', 'compass-label' + (item.isNorth ? ' compass-label--north' : ''));
      text.textContent = item.label;
      labelsEl.appendChild(text);
    });
  }

  function getDirectionLabel(deg) {
    const normalized = ((deg % 360) + 360) % 360;
    const idx = Math.round(normalized / 45) % 8;
    return DIRECTIONS[idx];
  }

  function render() {
    if (!svgEl || !directionEl) return;
    svgEl.style.transform = `rotate(${-heading}deg)`;
    const label = getDirectionLabel(heading);
    directionEl.textContent = label + ' ' + Math.round(heading) + '°';
  }

  function tick() {
    let diff = ((targetHeading - heading + 540) % 360) - 180;
    if (Math.abs(diff) < 0.05) {
      heading = targetHeading;
      render();
      rafId = null;
      return;
    }
    heading = (heading + diff * SMOOTH_FACTOR + 360) % 360;
    render();
    rafId = requestAnimationFrame(tick);
  }

  // [FIX 6.5] stopDemo() вызывается первым — и для immediate, и для обычного.
  function setHeading(deg, immediate) {
    if (!Number.isFinite(deg)) return;
    stopDemo();
    targetHeading = ((deg % 360) + 360) % 360;
    hasRealData = true;
    if (immediate) {
      heading = targetHeading;
      render();
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      return;
    }
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function toNum(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function extractHeading(data) {
    if (data === null || data === undefined) return null;
    if (typeof data === 'number') return toNum(data);
    if (typeof data !== 'object') return null;
    const candidates = ['heading', 'bearing', 'azimuth', 'course'];
    for (const k of candidates) {
      if (data[k] !== undefined) {
        const n = toNum(data[k]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function startDemo() {
    stopDemo();
    // [FIX 6.5] Не запускаем демо в свёрнутой вкладке/WebView.
    if (document.hidden) return;
    let angle = heading;
    demoTimer = setInterval(() => {
      if (hasRealData) { stopDemo(); return; }
      // [FIX 6.5] Доп. проверка на случай, если visibilitychange не сработал.
      if (document.hidden) { stopDemo(); return; }
      angle = (angle + 1) % 360;
      targetHeading = angle;
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }, DEMO_TICK_MS);
  }

  function stopDemo() {
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    if (typeof EventBus === 'undefined') return;

    const handler = (data) => {
      const deg = extractHeading(data);
      if (deg !== null) setHeading(deg);
    };

    EventBus.on('heading', handler);
    EventBus.on('compass', handler);
    EventBus.on('gps', handler);

    eventBusHandlers.push({ type: 'heading', handler });
    eventBusHandlers.push({ type: 'compass', handler });
    eventBusHandlers.push({ type: 'gps', handler });
  }

  function init() {
    svgEl = document.getElementById('compassDial');
    ticksEl = document.getElementById('compassTicks');
    labelsEl = document.getElementById('compassLabels');
    arrowsEl = document.getElementById('compassArrows');
    directionEl = document.getElementById('compassDirection');

    if (!svgEl) return;

    buildTicks();
    buildArrows();
    buildLabels();
    render();
    bindEvents();

    setTimeout(() => {
      if (!hasRealData) startDemo();
    }, DEMO_START_DELAY_MS);

    // [FIX 6.5] Останавливаем/возобновляем демо при переключении видимости.
    if (!visibilityHandler) {
      visibilityHandler = () => {
        if (document.hidden) {
          stopDemo();
        } else if (!hasRealData) {
          startDemo();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }
  }

  function destroy() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    stopDemo();
    if (typeof EventBus !== 'undefined') {
      eventBusHandlers.forEach(({ type, handler }) => EventBus.off(type, handler));
      eventBusHandlers = [];
    }
    eventsBound = false;
    // [FIX 6.5] Сбрасываем hasRealData, чтобы при повторной init() демо
    // снова запустилось, если реальных данных ещё нет.
    hasRealData = false;
    // [FIX 6.5] Снимаем visibilityHandler.
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  return { init, destroy, setHeading };
})();