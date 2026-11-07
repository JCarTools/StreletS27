/**********************************************
 * Модуль: Погода
 * [FIX] findCurrentHourIndex: безопасный парсинг времени (не дублируем 'Z').
 * [FIX] render: защита от нечислового temp.
 * [FIX] init: защита от повторного навешивания EventBus-обработчиков.
 * [NEW] destroy: очистка интервала и отписка от EventBus.
 * [NEW] getCoords: возвращает текущие координаты для модуля настроек.
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

  let eventsBound = false;
  let eventBusHandlers = [];

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
      const rawTemp = bridgeData.temp ?? bridgeData.temperature;
      const tempIsNumber = typeof rawTemp === 'number' && Number.isFinite(rawTemp);
      const temp = tempIsNumber ? Math.round(rawTemp) : rawTemp;
      const city = bridgeData.city || '';
      const condition = bridgeData.condition || '';
      let tempStr = '--';
      if (tempIsNumber) {
        tempStr = `${temp}°`;
      } else if (rawTemp !== undefined && rawTemp !== null && rawTemp !== '') {
        const s = String(rawTemp);
        tempStr = s.includes('°') ? s : `${s}°`;
      }

      const iconSvg = getWeatherIcon(condition);

      let extraHtml = '';
      if (extraData) {
        const wind = extraData.wind;
        const hum = extraData.humidity;
        const feels = extraData.feels;
        let details = [];
        if (wind !== undefined && Number.isFinite(wind)) details.push(`💨 ${wind} м/с`);
        if (hum !== undefined && Number.isFinite(hum)) details.push(`💧 ${hum}%`);
        if (feels !== undefined && Number.isFinite(feels) && feels !== temp) details.push(`Ощущ. ${feels > 0 ? '+' : ''}${feels}°`);
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

  function buildIso(s) {
    const str = String(s);
    if (/[Zz]$/.test(str) || /[+-]\d{2}:?\d{2}$/.test(str)) return str;
    return str + 'Z';
  }

  function findCurrentHourIndex(hourly) {
    if (!hourly || !Array.isArray(hourly.time)) return -1;
    const now = new Date();

    const makePrefix = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}`;
    };

    // 1. Локальный час
    const localPrefix = makePrefix(now);
    let idx = hourly.time.findIndex(t => String(t).startsWith(localPrefix));
    if (idx !== -1) return idx;

    // 2. UTC-час
    const utcPrefix = makePrefix(new Date(now.getTime() + now.getTimezoneOffset() * 60000));
    idx = hourly.time.findIndex(t => String(t).startsWith(utcPrefix));
    if (idx !== -1) return idx;

    // 3. Ближайший по времени (безопасный парсинг)
    const nowMs = now.getTime();
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      const t = Date.parse(buildIso(hourly.time[i]));
      if (!Number.isFinite(t)) continue;
      const diff = Math.abs(t - nowMs);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    return bestIdx;
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
          const idx = findCurrentHourIndex(data.hourly);
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

  function init() {
    if (eventsBound) return;
    eventsBound = true;

    if (typeof EventBus !== 'undefined') {
      const gpsHandler = (data) => {
        const lat = Number(data?.lat);
        const lon = Number(data?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          currentLat = lat; currentLon = lon;
          storage.save('weather_lat', lat);
          storage.save('weather_lon', lon);
          requestWeatherFromBridge();
          fetchOpenMeteo();
        }
      };
      const weatherHandler = (data) => {
        bridgeData = data;
        render();
      };
      EventBus.on('gps', gpsHandler);
      EventBus.on('weather', weatherHandler);
      eventBusHandlers.push({ type: 'gps', handler: gpsHandler });
      eventBusHandlers.push({ type: 'weather', handler: weatherHandler });
    }

    if (typeof android.getWeather === 'function') {
      const saved = android.getWeather();
      if (saved && !saved.error) { bridgeData = saved; render(); }
    }
    startOpenMeteoInterval();
  }

  function destroy() {
    if (openMeteoInterval) {
      clearInterval(openMeteoInterval);
      openMeteoInterval = null;
    }
    if (typeof EventBus !== 'undefined') {
      eventBusHandlers.forEach(({ type, handler }) => {
        EventBus.off(type, handler);
      });
      eventBusHandlers = [];
    }
    eventsBound = false;
  }

  function getCoords() {
    return { lat: currentLat, lon: currentLon };
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

  return { init, destroy, subscribe, unsubscribe, refreshClockDisplay, fetchWeather, getCoords };
})();