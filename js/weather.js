/**********************************************
 * Модуль: Погода (только данные моста JCarTools)
 * [FIX] Передача токена в androidApi.getWeather(getToken()) для надежности.
 * [FIX] Безопасный парсинг forecast (проверка на существование parts).
 * [NEW] Вывод ошибок в консоль, если мост вернул weather.error.
 * [NEW] Модалка прогноза адаптирована под структуру из документации JCarTools.
 **********************************************/

modules.weather = (function() {
  const container = document.getElementById('widgetWeatherContent');

  let bridgeData = null;
  let callbacks = [];

  let eventsBound = false;
  let eventBusHandlers = [];
  let forecastOverlay = null;
  let weatherPollInterval = null;
  let visibilityHandler = null;
  
  let startupAttempts = 0;
  const MAX_STARTUP_ATTEMPTS = 4;
  const STARTUP_DELAYS = [1000, 3000, 5000, 10000];

  const POLL_INTERVAL_MS = 5 * 60 * 1000; 

  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>'
  };

  function getWeatherIcon(condition) {
    const t = String(condition || '').toLowerCase();
    if (t.includes('гроза') || t.includes('молния')) return ICONS.storm;
    if (t.includes('дождь') || t.includes('ливень')) return ICONS.rain;
    if (t.includes('снег') || t.includes('метель')) return ICONS.snow;
    if (t.includes('облач') || t.includes('пасмур') || t.includes('туман')) return ICONS.cloud;
    if (t.includes('ясно') || t.includes('солнеч')) return ICONS.sun;
    return ICONS.cloud;
  }

  function pick(obj, keys, defaultVal = undefined) {
    if (!obj || typeof obj !== 'object') return defaultVal;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return defaultVal;
  }

  function notify() {
    callbacks.forEach(cb => { try { cb(bridgeData); } catch(e){} });
  }

  function render() {
    if (!container) return;

    if (!bridgeData || bridgeData.temp === '-' || !bridgeData.city || bridgeData.city === 'N/A') {
      container.innerHTML = `
        <div class="weather-icon">${ICONS.cloud}</div>
        <div class="weather-temp">—°</div>
        <div class="weather-city">Погода</div>
        <div class="weather-cond">Ожидание данных</div>
      `;
      return;
    }

    const tempRaw = pick(bridgeData, ['temp', 'temperature']);
    const city = pick(bridgeData, ['city', 'location', 'name'], 'Погода');
    const condition = pick(bridgeData, ['condition', 'desc', 'weather'], '');
    
    let tempStr = '—';
    if (tempRaw !== undefined && tempRaw !== '-' && !isNaN(parseFloat(tempRaw))) {
      const t = Math.round(parseFloat(tempRaw));
      tempStr = `${t > 0 ? '+' : ''}${t}°`;
    } else if (typeof tempRaw === 'string' && tempRaw !== '-') {
      tempStr = tempRaw.includes('°') ? tempRaw : `${tempRaw}°`;
    }

    const iconSvg = getWeatherIcon(condition);

    container.innerHTML = `
      <div class="weather-icon">${iconSvg}</div>
      <div class="weather-temp">${tempStr}</div>
      <div class="weather-city">${city}</div>
      <div class="weather-cond">${condition || '—'}</div>
    `;
    notify();
  }

  function showForecastModal() {
    const forecast = Array.isArray(bridgeData?.forecast) ? bridgeData.forecast : [];

    if (!forecast.length) {
      if (typeof showToast === 'function') showToast('Прогноз пока недоступен', 2000);
      return;
    }

    if (forecastOverlay) forecastOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'weather-forecast-overlay';

    const content = document.createElement('div');
    content.className = 'weather-forecast-content';

    const cityName = pick(bridgeData, ['city'], 'Погода');

    const header = document.createElement('div');
    header.className = 'weather-forecast-header';
    header.innerHTML = `
      <span>${cityName}</span>
      <button class="weather-forecast-close" aria-label="Закрыть">✕</button>
    `;
    content.appendChild(header);

    const slider = document.createElement('div');
    slider.className = 'weather-forecast-slider';
    
    forecast.forEach((dateItem) => {
      const parts = dateItem.parts || {};
      const day = parts.day || {};
      
      let labelMain = dateItem.label || 'День';
      let labelSub = '';
      if (labelMain.includes(',')) {
        const partsArr = labelMain.split(',');
        labelMain = partsArr[0].trim();
        labelSub = partsArr[1] ? partsArr[1].trim() : '';
      }

      const temp = day.temp !== undefined ? `${day.temp > 0 ? '+' : ''}${day.temp}°` : '—';
      const feels = day.feelsLike !== undefined ? `${day.feelsLike > 0 ? '+' : ''}${day.feelsLike}°` : '—';
      const cond = day.condition || '—';

      const dayCard = document.createElement('div');
      dayCard.className = 'weather-forecast-day';
      
      dayCard.innerHTML = `
        <div class="wf-label">
          <span class="wf-label-main">${labelMain}</span>
          <span class="wf-label-sub">${labelSub}</span>
        </div>
        <div class="wf-icon">${getWeatherIcon(cond)}</div>
        <div class="wf-temp">${temp}</div>
        <div class="wf-details">Ощущ. ${feels}</div>
        <div class="wf-details" style="font-size:0.7rem; opacity:0.9; margin-bottom: 0.4rem;">${cond}</div>
        <div class="wf-parts">
          <span>🌅 Утро: ${parts.morning?.temp ?? '—'}°</span>
          <span>☀️ День: ${parts.day?.temp ?? '—'}°</span>
          <span>🌇 Вечер: ${parts.evening?.temp ?? '—'}°</span>
          <span>🌙 Ночь: ${parts.night?.temp ?? '—'}°</span>
        </div>
      `;
      slider.appendChild(dayCard);
    });

    content.appendChild(slider);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    forecastOverlay = overlay;

    const close = () => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (forecastOverlay === overlay) forecastOverlay = null;
      }, 300);
    };

    header.querySelector('.weather-forecast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  function fetchWeather() {
    if (!window.androidApi || typeof window.androidApi.getWeather !== 'function') return;
    
    try {
      // Передаем токен, как в твоем примере
      const raw = window.androidApi.getWeather(getToken());
      
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        
        if (parsed.error) {
          console.warn("[Weather] Ошибка от JCarTools:", parsed.error);
          return;
        }

        bridgeData = parsed;
        render();
        
        // Если данные реальные (не N/A), прекращаем быстрые попытки
        if (bridgeData.city && bridgeData.city !== 'N/A' && bridgeData.temp !== '-') {
          startupAttempts = MAX_STARTUP_ATTEMPTS;
        }
      }
    } catch (e) {
      console.warn('[Weather] Ошибка парсинга:', e);
    }
  }

  function scheduleStartupAttempts() {
    if (startupAttempts >= MAX_STARTUP_ATTEMPTS) return;
    
    const delay = STARTUP_DELAYS[startupAttempts];
    startupAttempts++;
    
    setTimeout(() => {
      if (document.hidden) {
        startupAttempts = MAX_STARTUP_ATTEMPTS;
        return;
      }
      fetchWeather();
      scheduleStartupAttempts();
    }, delay);
  }

  function refreshClockDisplay() {
    notify();
  }

  function startPolling() {
    if (weatherPollInterval) return;
    weatherPollInterval = setInterval(() => {
      if (!document.hidden) fetchWeather();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (weatherPollInterval) {
      clearInterval(weatherPollInterval);
      weatherPollInterval = null;
    }
  }

  function init() {
    if (eventsBound) return;

    let bound = false;
    if (typeof EventBus !== 'undefined') {
      const weatherHandler = (data) => {
        if (data && typeof data === 'object') {
          bridgeData = data;
          render();
          if (bridgeData.city && bridgeData.city !== 'N/A' && bridgeData.temp !== '-') {
            startupAttempts = MAX_STARTUP_ATTEMPTS;
          }
        }
      };
      
      const carDataHandler = (data) => {
        if (data && data.weather) {
          bridgeData = data.weather;
          render();
          if (bridgeData.city && bridgeData.city !== 'N/A' && bridgeData.temp !== '-') {
            startupAttempts = MAX_STARTUP_ATTEMPTS;
          }
        }
      };

      EventBus.on('weather', weatherHandler);
      EventBus.on('carData', carDataHandler);
      
      eventBusHandlers.push({ type: 'weather', handler: weatherHandler });
      eventBusHandlers.push({ type: 'carData', handler: carDataHandler });
      bound = true;
    }
    eventsBound = bound;

    if (container) {
      container.style.cursor = 'pointer';
      container.addEventListener('click', showForecastModal);
    }

    fetchWeather();
    scheduleStartupAttempts();
    startPolling();

    visibilityHandler = () => {
      if (!document.hidden) {
        fetchWeather();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function destroy() {
    stopPolling();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    if (typeof EventBus !== 'undefined') {
      eventBusHandlers.forEach(({ type, handler }) => {
        EventBus.off(type, handler);
      });
      eventBusHandlers = [];
    }
    if (container) {
      container.removeEventListener('click', showForecastModal);
    }
    if (forecastOverlay && forecastOverlay.parentNode) {
      forecastOverlay.parentNode.removeChild(forecastOverlay);
      forecastOverlay = null;
    }
    eventsBound = false;
    startupAttempts = 0;
  }

  function subscribe(cb) {
    if (typeof cb === 'function') {
      if (!callbacks.includes(cb)) {
        callbacks.push(cb);
      }
      if (bridgeData) cb(bridgeData);
    }
  }

  function unsubscribe(cb) {
    const idx = callbacks.indexOf(cb);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  return { init, destroy, subscribe, unsubscribe, refreshClockDisplay, fetchWeather };
})();