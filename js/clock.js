/**********************************************
 * Модуль: Часы (flip-часы, дата, день недели)
 **********************************************/

modules.clock = (function() {
  const flipClock = document.getElementById('flipClock');
  const dateDisplay = document.getElementById('dateDisplay');
  const weekdayDisplay = document.getElementById('weekdayDisplay');
  let intervalId = null;
  let lastMinute = -1;

  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

  function update() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2,'0');
    const minutes = String(now.getMinutes()).padStart(2,'0');

    if (minutes !== lastMinute) {
      lastMinute = minutes;
      if (flipClock) {
        flipClock.innerHTML = `<span class="flip-digit">${hours[0]}</span><span class="flip-digit">${hours[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${minutes[0]}</span><span class="flip-digit">${minutes[1]}</span>`;
      }
      if (dateDisplay) {
        dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
      }
      if (weekdayDisplay) {
        weekdayDisplay.textContent = weekdays[now.getDay()];
      }
    }
  }

  function start() {
    stop();
    update(); // сразу показать
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