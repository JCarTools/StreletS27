/**********************************************
 * Модуль: Часы (flip-часы, дата, день недели)
 * [PERF] Пауза интервала при document.hidden
 * [FIX] Версия берётся из window.MANIFEST.version (manifest.js),
 *       который подключён синхронно в index.html — работает на file://.
 **********************************************/

modules.clock = (function() {
  const flipClock = document.getElementById('flipClock');
  const dateDisplay = document.getElementById('dateDisplay');
  const weekdayDisplay = document.getElementById('weekdayDisplay');
  const signatureEl = document.querySelector('.widget_time__signature');
  let intervalId = null;
  let lastMinute = -1;
  let lastDate = -1;

  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

  function updateDateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2,'0');
    const minutes = String(now.getMinutes()).padStart(2,'0');
    const currentDate = now.getDate();

    if (minutes !== lastMinute) {
      lastMinute = minutes;
      if (flipClock) {
        flipClock.innerHTML = `<span class="flip-digit">${hours[0]}</span><span class="flip-digit">${hours[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${minutes[0]}</span><span class="flip-digit">${minutes[1]}</span>`;
      }
    }

    if (currentDate !== lastDate) {
      lastDate = currentDate;
      if (dateDisplay) {
        dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
      }
      if (weekdayDisplay) {
        weekdayDisplay.textContent = weekdays[now.getDay()];
      }
    }
  }

  function update() {
    updateDateTime();
  }

  // [FIX] Версия из window.MANIFEST.version (manifest.js)
  function applyVersion() {
    if (!signatureEl) return;
    try {
      const v = (window.MANIFEST && window.MANIFEST.version) ? String(window.MANIFEST.version) : '';
      if (v) {
        signatureEl.textContent = `@Strelets27 v.${v}`;
      }
    } catch (e) {
      warn('[Clock] Не удалось применить версию:', e);
    }
  }

  function start() {
    stop();
    updateDateTime();
    applyVersion();
    intervalId = setInterval(update, 1000);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  return { start, stop };
})();