/**********************************************
 * Модуль: Погода
 * [FIX] Баг #5: формирование локального текущего часа для Open-Meteo.
 * [FIX] Защита от null в callbacks и мосте.
 **********************************************/

modules.weather = (function() {
  const container = document.getElementById('widgetWeatherContent');
  
  let currentLat = null;
  let currentLon = null;
  let lastRequestTime = 0;
  let lastOpenMeteoTime = 0;
  let openMeteoInterval = null;
  
  let bridgeData = null;
  let extraData = null;
  let callbacks = [];

  const OPEN_METEO_THROTTLE_MS = 30000;
  const BRIDGE_REQUEST_THROTTLE_MS = 10 * 60 * 1000;

  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/></svg>'
  };

  function getWeatherIcon(condition) {
    const t = String(condition || '').toLowerCase();
    if (t.includes('дождь') || t.includes('ливень') || t.includes('гроза')) return ICONS.rain;
    if (t.includes('снег') || t.includes('метель')) return ICONS.snow;
    if (t.includes('облач') || t.includes('пасмур') || t.includes('туман')) return ICONS.cloud;
    if (t.includes('ясно') || t.includes('солнеч')) return ICONS.sun;
    return ICONS.cloud;
  }

  function notify() {
    callbacks.forEach(cb => { try { cb(bridgeData, extraData); } catch(e){} });
  }

  function render() {
    if (container && bridgeData) {
      const temp = bridgeData.temp || bridgeData.temperature || '--';
      const city = bridgeData.city || '';
      const condition = bridgeData.condition || '';
      const tempStr = String(temp).includes('°') ? String(temp) : `${temp}°`;
      
      const iconSvg = getWeatherIcon(condition);

      let extraHtml = '';
      if (extraData) {
        const wind = extraData.wind;
        const hum = extraData.humidity;
        const feels = extraData.feels;
        let details = [];
        if (wind !== undefined) details.push(`💨 ${wind} м/с`);
        if (hum !== undefined) details.push(`💧 ${hum}%`);
        if (feels !== undefined && feels !== temp) details.push(`Ощущ. ${feels > 0 ? '+' : ''}${feels}°`);
        if (details.length > 0) extraHtml = `<div class="weather-details">${details.join(' • ')}</div>`;
      }

      container.innerHTML = `
        <div class="weather-icon">${iconSvg}</div>
        <div class="weather-temp">${tempStr}</div>
        <div class="weather-city">${city}</div>
        <div class="weather-cond">${condition}</div>
        ${extraHtml}
      `;
    }
    notify();
  }

  function getLocalHourPrefix(date) {
    // Open-Meteo с timezone=auto возвращает локальное время в формате "YYYY-MM-DDTHH:00".
    // Формируем префикс "YYYY-MM-DDTHH" на основе локального времени.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}`;
  }

  async function fetchOpenMeteo() {
    if (currentLat === null || currentLon === null) return;
    const now = Date.now();
    if (now - lastOpenMeteoTime < OPEN_METEO_THROTTLE_MS) return;
    lastOpenMeteoTime = now;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      
      if (data && data.current_weather) {
        const wind = Math.round(data.current_weather.windspeed);
        let humidity = undefined;
        let feels = undefined;
        if (data.hourly && Array.isArray(data.hourly.time)) {
          const prefix = getLocalHourPrefix(new Date());
          const idx = data.hourly.time.findIndex(t => String(t).startsWith(prefix));
          if (idx !== -1) {
            if (Array.isArray(data.hourly.relativehumidity_2m) && data.hourly.relativehumidity_2m[idx] !== undefined) {
              humidity = data.hourly.relativehumidity_2m[idx];
            }
            if (Array.isArray(data.hourly.apparent_temperature) && data.hourly.apparent_temperature[idx] !== undefined) {
              feels = Math.round(data.hourly.apparent_temperature[idx]);
            }
          }
        }
        extraData = { wind, humidity, feels };
        render();
      }
    } catch (e) {
      console.warn('[Weather] Open-Meteo error:', e);
    }
  }

  function requestWeatherFromBridge() {
    if (typeof android.getWeather !== 'function') return;
    if (currentLat === null || currentLon === null) {
      const saved = android.getWeather();
      if (saved && !saved.error) { bridgeData = saved; render(); }
      return;
    }
    const now = Date.now();
    if (now - lastRequestTime < BRIDGE_REQUEST_THROTTLE_MS) return;
    lastRequestTime = now;
    if (typeof android.refreshWeather === 'function') android.refreshWeather(currentLat, currentLon);
  }

  function fetchWeather() {
    if (typeof android.getWeather !== 'function') return;
    if (currentLat !== null && currentLon !== null) {
      requestWeatherFromBridge();
      fetchOpenMeteo();
    } else {
      const saved = android.getWeather();
      if (saved && !saved.error) { bridgeData = saved; render(); }
    }
  }

  function refreshClockDisplay() {
    notify();
  }

  function startOpenMeteoInterval() {
    if (openMeteoInterval) return;
    openMeteoInterval = setInterval(() => {
      if (currentLat !== null && currentLon !== null && !document.hidden) {
        lastOpenMeteoTime = 0;
        lastRequestTime = 0;
        fetchOpenMeteo();
        requestWeatherFromBridge();
      }
    }, 10 * 60 * 1000);
  }

  const _origOnAndroidEventWeather = window.onAndroidEvent;
  window.onAndroidEvent = function(type, data) {
    if (type === 'gps') {
      const lat = Number(data?.lat);
      const lon = Number(data?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        currentLat = lat; currentLon = lon;
        requestWeatherFromBridge();
        fetchOpenMeteo();
      }
    } else if (type === 'weather') {
      bridgeData = data;
      render();
    }
    if (typeof _origOnAndroidEventWeather === 'function') {
      try { _origOnAndroidEventWeather(type, data); } catch (e) {}
    }
  };

  function init() {
    if (typeof android.getWeather === 'function') {
      const saved = android.getWeather();
      if (saved && !saved.error) { bridgeData = saved; render(); }
    }
    startOpenMeteoInterval();
  }

  function subscribe(cb) {
    if (typeof cb === 'function') {
      if (!callbacks.includes(cb)) {
        callbacks.push(cb);
      }
      if (bridgeData) cb(bridgeData, extraData);
    }
  }

  function unsubscribe(cb) {
    const idx = callbacks.indexOf(cb);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  return { init, subscribe, unsubscribe, refreshClockDisplay, fetchWeather };
})();