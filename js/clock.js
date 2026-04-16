/**********************************************
 * Модуль: Часы (flip-часы, дата, день недели)
 **********************************************/

modules.clock = (function() {
  const flipClock = document.getElementById('flipClock'),
        dateDisplay = document.getElementById('dateDisplay'),
        weekdayDisplay = document.getElementById('weekdayDisplay');
  let rafId = null, lastMinute = -1;

  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0'), m = String(now.getMinutes()).padStart(2,'0');
    if (m !== lastMinute) {
      lastMinute = m;
      if (flipClock) flipClock.innerHTML = `<span class="flip-digit">${h[0]}</span><span class="flip-digit">${h[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${m[0]}</span><span class="flip-digit">${m[1]}</span>`;
      const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
      const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
      if (dateDisplay) dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
      if (weekdayDisplay) weekdayDisplay.textContent = weekdays[now.getDay()];
    }
    rafId = requestAnimationFrame(update);
  }

  function start() { if (rafId) cancelAnimationFrame(rafId); update(); }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  return { start, stop };
})();