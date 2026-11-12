/**********************************************
 * [DIAG] Визуальная диагностика для машины (без консоли).
 * [FIX 21] Раздел «Виджеты / Раскладка»: проверка портретного режима, 
 *          наличия 2-х рядов, состояния модуля widgetsReorder.
 * [FIX 22] Окно диагностики расширено в 2 раза (до 840px).
 **********************************************/

const diag = (function() {
  let el = null;
  let lines = [];
  let started = false;

  let clickCount = 0;
  let clickFirstAt = 0;
  let clickResetTimer = null;
  const CLICKS_NEEDED = 10;
  const CLICK_WINDOW_MS = 3000;

  let lastMusicInfoRaw = null;
  let lastWeatherRaw = null;
  const SEEK_TEST_POSITION_MS = 90000;

  const IMPORTANT_EVENTS = new Set([
    'carResponse', 'climateState', 'carData', 'musicInfo', 'volumeChanged',
    'launcherCatalog', 'music', 'weather'
  ]);

  const STYLE_ID = 'diag-overlay-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #diagOverlay.diag-overlay {
        left: 50% !important;
        right: auto !important;
        transform: translateX(-50%);
        width: min(96vw, 840px); /* [FIX 22] Увеличено в 2 раза */
        max-width: 840px;
        padding: 0.8rem !important;
        padding-top: 2.6rem !important;
        border-radius: 0.8rem;
        box-sizing: border-box;
        font-size: 0.7rem !important;
        line-height: 1.4 !important;
      }
      #diagOverlay .diag-content {
        width: 100%;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
        box-sizing: border-box;
      }
      #diagOverlay .diag-seek-panel {
        position: sticky;
        top: 0;
        z-index: 2;
        background: rgba(0, 0, 0, 0.92);
        border: 1px solid rgba(216, 255, 69, 0.25);
        border-radius: 0.6rem;
        padding: 0.5rem 0.6rem;
        margin-bottom: 0.6rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 45vh;
        overflow-y: auto;
      }
      #diagOverlay .diag-seek-title {
        font-size: 0.7rem;
        font-weight: bold;
        color: #d8ff45;
        letter-spacing: 0.05em;
        margin-top: 0.3rem;
      }
      #diagOverlay .diag-seek-row {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
      }
      #diagOverlay .diag-seek-btn {
        flex: 1 1 auto;
        min-width: 0;
        padding: 0.35rem 0.4rem;
        font-size: 0.65rem;
        line-height: 1.2;
        color: #d8ff45;
        background: rgba(216, 255, 69, 0.08);
        border: 1px solid rgba(216, 255, 69, 0.35);
        border-radius: 0.4rem;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #diagOverlay .diag-seek-btn:active {
        background: rgba(216, 255, 69, 0.22);
      }
      #diagOverlay .diag-close {
        position: fixed !important;
        top: 0.6rem;
        right: calc(50% - min(48vw, 420px) + 0.6rem);
        width: 2.4rem;
        height: 2.4rem;
        font-size: 1.2rem;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureEl() {
    if (el && document.body.contains(el)) return el;
    el = document.getElementById('diagOverlay');
    return el;
  }

  function render() {
    const node = ensureEl();
    if (!node) return;

    let closeBtn = node.querySelector('.diag-close');
    let content = node.querySelector('.diag-content');
    let seekPanel = node.querySelector('.diag-seek-panel');

    if (!closeBtn || !content) {
      node.innerHTML = '<button class="diag-close" aria-label="Закрыть">✕</button><div class="diag-seek-panel"></div><div class="diag-content"></div>';
      content = node.querySelector('.diag-content');
      seekPanel = node.querySelector('.diag-seek-panel');
    }

    if (seekPanel && !seekPanel.hasChildNodes()) {
      seekPanel.innerHTML = `
        <div class="diag-seek-title">Перемотка</div>
        <div class="diag-seek-row">
          <button type="button" class="diag-seek-btn" data-seek="show-music-info">musicInfo</button>
          <button type="button" class="diag-seek-btn" data-seek="direct">seekMusic</button>
          <button type="button" class="diag-seek-btn" data-seek="cmd">music_seek</button>
          <button type="button" class="diag-seek-btn" data-seek="enum">MEDIA_SEEK</button>
          <button type="button" class="diag-seek-btn" data-seek="methods">Методы</button>
        </div>

        <div class="diag-seek-title">Погода</div>
        <div class="diag-seek-row">
          <button type="button" class="diag-seek-btn" data-seek="refresh-weather">refreshWeather</button>
          <button type="button" class="diag-seek-btn" data-seek="getWeatherRaw">getWeather (raw)</button>
          <button type="button" class="diag-seek-btn" data-seek="fake-weather" style="background:rgba(216,255,69,0.2);">Фейк-погода</button>
        </div>

        <div class="diag-seek-title">Виджеты / Раскладка</div>
        <div class="diag-seek-row">
          <button type="button" class="diag-seek-btn" data-seek="layout-info">Layout Profile</button>
          <button type="button" class="diag-seek-btn" data-seek="dom-rows">DOM Rows</button>
          <button type="button" class="diag-seek-btn" data-seek="reorder-state">Reorder State</button>
        </div>
        <div class="diag-seek-row">
          <button type="button" class="diag-seek-btn" data-seek="force-portrait" style="background:rgba(216,255,69,0.15);">Принудит. Portrait</button>
          <button type="button" class="diag-seek-btn" data-seek="force-landscape" style="background:rgba(216,255,69,0.15);">Принудит. Landscape</button>
        </div>
      `;

      seekPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('.diag-seek-btn');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        runSeekAction(btn.getAttribute('data-seek'));
      });
    }

    if (content) content.textContent = lines.join('\n');
    node.scrollTop = node.scrollHeight;
  }

  function log(...args) {
    const text = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    const ts = new Date().toLocaleTimeString('ru-RU');
    lines.push(`[${ts}] ${text}`);
    if (lines.length > 500) lines = lines.slice(-500);
    render();
  }

  function show() {
    const node = ensureEl();
    if (!node) return;
    injectStyles();
    render();
    node.classList.add('visible');
  }

  function hide() {
    const node = ensureEl();
    if (!node) return;
    node.classList.remove('visible');
  }

  function safeJsonPretty(obj, maxLen = 1500) {
    try {
      const s = JSON.stringify(obj, null, 2);
      return s.length > maxLen ? s.slice(0, maxLen) + '\n…(обрезано)' : s;
    } catch (e) {
      return String(obj);
    }
  }

  async function runSeekAction(action) {
    const pos = SEEK_TEST_POSITION_MS;

    // ===== Виджеты / Раскладка =====
    if (action === 'layout-info') {
      log('=== LAYOUT INFO ===');
      const profile = storage.load('setting_layoutProfile');
      const bodyClasses = document.body.className;
      const isPortraitBody = bodyClasses.includes('layout-portrait');
      const isLandscapeBody = bodyClasses.includes('layout-landscape');
      
      log(`setting_layoutProfile: ${profile}`);
      log(`body class: ${bodyClasses}`);
      log(`layout-portrait: ${isPortraitBody}`);
      log(`layout-landscape: ${isLandscapeBody}`);
      
      if ((profile === 'portrait' && !isPortraitBody) || (profile === 'landscape' && !isLandscapeBody)) {
        log('ОШИБКА: Настройка в storage не совпадает с классом на body!');
      } else {
        log('OK: Класс на body совпадает с настройкой.');
      }
      return;
    }

    if (action === 'dom-rows') {
      log('=== DOM ROWS ===');
      const dashboard = document.querySelector('.dashboard');
      if (!dashboard) {
        log('ОШИБКА: .dashboard не найден');
        return;
      }
      
      const rows = dashboard.querySelectorAll('.dashboard-row');
      log(`Найдено рядов (.dashboard-row): ${rows.length}`);
      
      rows.forEach((row, idx) => {
        const widgets = row.querySelectorAll('.widget, .widget-wrapper, .right-buttons');
        log(`Ряд ${idx + 1}: виджетов внутри = ${widgets.length}`);
      });

      if (document.body.classList.contains('layout-portrait') && rows.length < 2) {
        log('ОШИБКА: В портретном режиме ожидается 2 ряда, но найден 1 (или 0). Виджеты не перетаскиваются из-за отсутствия верхнего ряда!');
      }
      return;
    }

    if (action === 'reorder-state') {
      log('=== REORDER STATE ===');
      if (!modules.widgetsReorder) {
        log('ОШИБКА: Модуль modules.widgetsReorder не загружен');
        return;
      }

      const dashboard = document.querySelector('.dashboard');
      const allWidgets = dashboard.querySelectorAll('.widget, .right-buttons, .widget-wrapper');
      log(`Всего виджетов для перетаскивания: ${allWidgets.length}`);

      allWidgets.forEach(w => {
        const id = w.dataset.widgetId || w.id || w.className.split(' ')[0];
        const rect = w.getBoundingClientRect();
        log(`- ${id}: width=${Math.round(rect.width)}, height=${Math.round(rect.height)}`);
      });

      try {
        modules.widgetsReorder.refresh();
        log('Вызван modules.widgetsReorder.refresh() — проверьте, не изменилось ли что-то.');
      } catch (e) {
        log('Ошибка при вызове refresh(): ' + e.message);
      }
      return;
    }

    if (action === 'force-portrait') {
      log('=== FORCE PORTRAIT ===');
      if (modules.layoutProfile && typeof modules.layoutProfile.set === 'function') {
        modules.layoutProfile.set('portrait', { toast: true });
        log('Вызван layoutProfile.set("portrait"). Проверьте DOM.');
      } else {
        storage.save('setting_layoutProfile', 'portrait');
        document.body.classList.remove('layout-landscape');
        document.body.classList.add('layout-portrait');
        log('Fallback: принудительно установлен класс layout-portrait.');
      }
      setTimeout(() => runSeekAction('dom-rows'), 500);
      return;
    }

    if (action === 'force-landscape') {
      log('=== FORCE LANDSCAPE ===');
      if (modules.layoutProfile && typeof modules.layoutProfile.set === 'function') {
        modules.layoutProfile.set('landscape', { toast: true });
        log('Вызван layoutProfile.set("landscape"). Проверьте DOM.');
      } else {
        storage.save('setting_layoutProfile', 'landscape');
        document.body.classList.remove('layout-portrait');
        document.body.classList.add('layout-landscape');
        log('Fallback: принудительно установлен класс layout-landscape.');
      }
      setTimeout(() => runSeekAction('dom-rows'), 500);
      return;
    }

    // ===== Погода =====
    if (action === 'refresh-weather') {
      log('=== refreshWeather ===');
      if (!window.androidApi || typeof window.androidApi.refreshWeather !== 'function') {
        log('метод отсутствует');
        return;
      }
      try {
        const res = window.androidApi.refreshWeather(getToken());
        log('ответ: ' + safeJsonPretty(res));
        setTimeout(() => runSeekAction('getWeatherRaw'), 3000);
      } catch (e) {
        log('ошибка: ' + (e && e.message));
      }
      return;
    }

    if (action === 'getWeatherRaw') {
      log('=== getWeather (raw) ===');
      if (!window.androidApi || typeof window.androidApi.getWeather !== 'function') {
        log('метод отсутствует');
        return;
      }
      try {
        const raw = window.androidApi.getWeather(getToken());
        log('raw: ' + safeJsonPretty(raw, 4000));
      } catch (e) {
        log('ошибка: ' + (e && e.message));
      }
      return;
    }

    if (action === 'fake-weather') {
      log('=== Фейк-погода ===');
      const fakeData = {
        city: "Москва",
        temp: 22,
        condition: "Ясно",
        forecast: Array.from({length: 10}).map((_, i) => ({
          label: i === 0 ? "Сегодня, 9 ноября" : `День ${i+1}`,
          parts: {
            day: { temp: 20 + i, feelsLike: 19 + i, condition: i % 2 === 0 ? "Ясно" : "Облачно", windSpeed: 3 + i, humidity: 40 + i },
            morning: { temp: 15 + i }, evening: { temp: 18 + i }, night: { temp: 12 + i }
          }
        }))
      };
      if (typeof EventBus !== 'undefined') EventBus.emit('weather', fakeData);
      if (modules.weather && modules.weather.updateFromEvent) modules.weather.updateFromEvent(fakeData);
      log('Фейк-погода отправлена.');
      return;
    }

    // ===== Музыка =====
    if (action === 'show-music-info') {
      log('=== musicInfo ===');
      if (!lastMusicInfoRaw) { log('нет данных'); return; }
      log('raw: ' + safeJsonPretty(lastMusicInfoRaw));
      return;
    }

    if (action === 'methods') {
      log('=== Методы ===');
      log('androidApi: ' + (window.androidApi ? 'есть' : 'НЕТ'));
      if (window.androidApi) {
        const keys = Object.keys(window.androidApi);
        log('keys: ' + keys.join(', '));
      }
      return;
    }

    if (action === 'direct') {
      log('=== seekMusic ===');
      if (!window.androidApi || typeof window.androidApi.seekMusic !== 'function') {
        log('метод отсутствует'); return;
      }
      try {
        const res = window.androidApi.seekMusic(getToken(), pos);
        log('результат: ' + safeJsonPretty(res));
      } catch (e) { log('ошибка: ' + e.message); }
      return;
    }

    if (action === 'cmd') {
      log('=== music_seek ===');
      if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') return;
      try {
        const resp = await android.requestCarCommandAsync({ cmd: 'music_seek', position: pos }, 2500);
        log('ответ: ' + safeJsonPretty(resp));
      } catch (e) { log('ошибка: ' + e.message); }
      return;
    }

    if (action === 'enum') {
      log('=== MEDIA_SEEK ===');
      if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') return;
      try {
        const resp = await android.requestCarCommandAsync({ cmd: 'MEDIA_SEEK_' + pos }, 2500);
        log('ответ: ' + safeJsonPretty(resp));
      } catch (e) { log('ошибка: ' + e.message); }
      return;
    }
  }

  function init() {
    if (started) return;
    started = true;
    injectStyles();
    const node = ensureEl();
    if (node) {
      node.addEventListener('click', (e) => {
        if (e.target.closest('.diag-close')) { e.stopPropagation(); hide(); }
      });
    }
    log('Диагностика готова. 10 кликов по значку сети — открыть.');
  }

  function handleNetworkClick() {
    const now = Date.now();
    if (now - clickFirstAt > CLICK_WINDOW_MS) { clickFirstAt = now; clickCount = 0; }
    clickCount++;
    if (clickResetTimer) clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => { clickCount = 0; clickFirstAt = 0; }, CLICK_WINDOW_MS);

    if (clickCount >= CLICKS_NEEDED) {
      clickCount = 0; clickFirstAt = 0;
      if (clickResetTimer) { clearTimeout(clickResetTimer); clickResetTimer = null; }
      log('=== ОТКРЫВАЮ ПЛАШКУ ===');
      show();
      return true;
    }
    return false;
  }

  function onEvent(type, data) {
    if (!IMPORTANT_EVENTS.has(type)) return;
    if (type === 'musicInfo') lastMusicInfoRaw = data;
    if (type === 'weather') lastWeatherRaw = data;
    else if (type === 'carData' && data && data.weather) lastWeatherRaw = data.weather;
    
    if (type === 'carData') return; 

    let preview;
    try {
      preview = (typeof data === 'string') ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
    } catch { preview = String(data).slice(0, 200); }
    log(`СОБЫТИЕ "${type}" → ${preview}`);
  }

  return { init, log, onEvent, show, hide, handleNetworkClick };
})();