/**********************************************
 * Модуль: Часы (flip-часы, дата, день недели)
 * Погода в часах, подписка weather один раз.
 **********************************************/

modules.clock = (function() {
  const flipClock = document.getElementById('flipClock');
  const dateDisplay = document.getElementById('dateDisplay');
  const weekdayDisplay = document.getElementById('weekdayDisplay');
  const signatureEl = document.querySelector('.widget_time__signature');
  const weatherTopEl = document.getElementById('timeWeatherTop');
  const weatherBottomEl = document.getElementById('timeWeatherBottom');
  
  let intervalId = null;
  let lastMinute = -1;
  let lastHour = -1;
  let lastDate = -1;
  let weatherSubscribed = false;

  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

  function updateDateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2,'0');
    const minutes = String(now.getMinutes()).padStart(2,'0');
    const currentDate = now.getDate();

    if (minutes !== lastMinute || hours !== lastHour) {
      lastMinute = minutes;
      lastHour = hours;
      if (flipClock) {
        flipClock.innerHTML = `<span class="flip-digit">${hours[0]}</span><span class="flip-digit">${hours[1]}</span><span class="flip-separator">:</span><span class="flip-digit">${minutes[0]}</span><span class="flip-digit">${minutes[1]}</span>`;
      }
    }

    if (currentDate !== lastDate) {
      lastDate = currentDate;
      if (dateDisplay) dateDisplay.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
      if (weekdayDisplay) weekdayDisplay.textContent = weekdays[now.getDay()];
    }
  }

  function update() {
    updateDateTime();
  }

  function applyVersion() {
    if (!signatureEl) return;
    try {
      const v = (window.MANIFEST && window.MANIFEST.version) ? String(window.MANIFEST.version) : '';
      if (v) signatureEl.textContent = `@Strelets27 v.${v}`;
    } catch (e) {}
  }

  function renderWeatherInClock(weather) {
    if (!weatherTopEl || !weatherBottomEl) return;
    
    const showWeather = storage.load('setting_showClockWeather');
    if (showWeather === false) {
      weatherTopEl.style.display = 'none';
      weatherBottomEl.style.display = 'none';
      return;
    } else {
      weatherTopEl.style.display = 'flex';
      weatherBottomEl.style.display = 'block';
    }

    if (!weather || weather.error) return;

    const temp = weather.temp || weather.temperature || '--';
    const city = weather.city || '';
    const condition = weather.condition || '';
    const tempStr = String(temp).includes('°') ? String(temp) : `${temp}°`;

    let iconSvg = '';
    const t = String(condition).toLowerCase();
    if (t.includes('дождь') || t.includes('ливень')) iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>';
    else if (t.includes('снег')) iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/></svg>';
    else if (t.includes('облач') || t.includes('пасмур')) iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>';
    else iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';

    weatherTopEl.innerHTML = `
      <div class="w-icon">${iconSvg}</div>
      <span>${tempStr}</span>
      <span>${condition}</span>
    `;

    weatherBottomEl.textContent = city || '';
  }

  function start() {
    stop();
    updateDateTime();
    applyVersion();
    
    if (!weatherSubscribed && modules.weather && typeof modules.weather.subscribe === 'function') {
      modules.weather.subscribe(renderWeatherInClock);
      weatherSubscribed = true;
    }

    intervalId = setInterval(update, 1000);
  }

  function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  return { start, stop };
})();