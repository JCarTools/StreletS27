/**********************************************
 * Модуль: Данные автомобиля
 * Получение информации о состоянии сидений
 * Преобразование: входная шкала 1-4 → внутренняя 0-3
 **********************************************/

modules.carData = (function() {
  let frontSeatsData = {
    frontLeft: { heat: 0, vent: 0 },
    frontRight: { heat: 0, vent: 0 }
  };
  let updateInterval = null;
  let callbacks = [];
  let lastRawData = null;

  // Преобразование из шкалы 1-4 в 0-3
  function transformIncomingLevel(level) {
    if (level === undefined || level === null) return 0;
    let num = Number(level);
    if (isNaN(num)) return 0;
    if (num >= 1 && num <= 4) return num - 1;
    return Math.min(3, Math.max(0, num));
  }

  function updateDebugPanel(raw, transformed) {
    const panel = document.getElementById('debugContent');
    if (!panel) return;
    const now = new Date().toLocaleTimeString();
    let html = `[${now}] getCarData raw: ${JSON.stringify(raw)}<br>`;
    if (transformed) {
      html += `→ heat: Л${transformed.frontLeft.heat}/${transformed.frontRight.heat} vent: Л${transformed.frontLeft.vent}/${transformed.frontRight.vent}<br>`;
    } else {
      html += `→ ошибка преобразования<br>`;
    }
    panel.innerHTML = html + panel.innerHTML;
    if (panel.innerHTML.length > 3000) panel.innerHTML = panel.innerHTML.slice(0, 2500);
  }

  function parseCarData(data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      lastRawData = parsed;
      
      let newData = {
        frontLeft: { heat: 0, vent: 0 },
        frontRight: { heat: 0, vent: 0 }
      };
      
      // Разбор различных форматов с применением transformIncomingLevel
      if (parsed.frontSeats) {
        const seats = parsed.frontSeats;
        newData.frontLeft.heat = transformIncomingLevel(seats.driverHeatLevel ?? seats.driver_heat_level ?? 0);
        newData.frontLeft.vent = transformIncomingLevel(seats.driverVentLevel ?? seats.driver_vent_level ?? 0);
        newData.frontRight.heat = transformIncomingLevel(seats.passengerHeatLevel ?? seats.passenger_heat_level ?? 0);
        newData.frontRight.vent = transformIncomingLevel(seats.passengerVentLevel ?? seats.passenger_vent_level ?? 0);
      }
      else if (parsed.frontLeft !== undefined || parsed.frontRight !== undefined) {
        newData.frontLeft.heat = transformIncomingLevel(parsed.frontLeft?.heat ?? 0);
        newData.frontLeft.vent = transformIncomingLevel(parsed.frontLeft?.vent ?? 0);
        newData.frontRight.heat = transformIncomingLevel(parsed.frontRight?.heat ?? 0);
        newData.frontRight.vent = transformIncomingLevel(parsed.frontRight?.vent ?? 0);
      }
      else if (parsed.driverTemp !== undefined) {
        let rawLeft = (parsed.driverTemp === true) ? 4 : (parsed.driverTemp === false ? 1 : parsed.driverTemp);
        let rawRight = (parsed.passengerTemp === true) ? 4 : (parsed.passengerTemp === false ? 1 : parsed.passengerTemp);
        newData.frontLeft.heat = transformIncomingLevel(rawLeft);
        newData.frontRight.heat = transformIncomingLevel(rawRight);
      }
      else if (parsed.heat_seat_l !== undefined) {
        newData.frontLeft.heat = transformIncomingLevel(parsed.heat_seat_l);
        newData.frontRight.heat = transformIncomingLevel(parsed.heat_seat_r);
        newData.frontLeft.vent = transformIncomingLevel(parsed.vent_seat_l);
        newData.frontRight.vent = transformIncomingLevel(parsed.vent_seat_r);
      }
      
      console.log('[CarData] Raw:', lastRawData);
      console.log('[CarData] Transformed:', newData);
      updateDebugPanel(lastRawData, newData);
      return newData;
    } catch (e) {
      console.error('[CarData] Parse error:', e);
      updateDebugPanel({error: e.message}, null);
      return null;
    }
  }

  function fetchData() {
    try {
      const rawData = android.getCarData("frontSeats");
      if (rawData && rawData !== '{}' && rawData !== 'null' && rawData !== 'undefined') {
        const data = parseCarData(rawData);
        if (data) {
          let changed = false;
          if (frontSeatsData.frontLeft.heat !== data.frontLeft.heat) changed = true;
          if (frontSeatsData.frontLeft.vent !== data.frontLeft.vent) changed = true;
          if (frontSeatsData.frontRight.heat !== data.frontRight.heat) changed = true;
          if (frontSeatsData.frontRight.vent !== data.frontRight.vent) changed = true;
          
          if (changed) {
            frontSeatsData = data;
            notifyCallbacks({ ...frontSeatsData });
          }
        }
      } else {
        updateDebugPanel({noData: true}, null);
      }
    } catch (e) {
      console.error('[CarData] Fetch error:', e);
      updateDebugPanel({error: e.message}, null);
    }
  }

  function updateFromEvent(data) {
    const parsed = parseCarData(data);
    if (parsed) {
      frontSeatsData = parsed;
      notifyCallbacks({...frontSeatsData});
    }
  }

  function notifyCallbacks(data) {
    callbacks.forEach(cb => { try { cb(data); } catch(e) {} });
  }

  function subscribe(callback) {
    if (typeof callback === 'function') {
      callbacks.push(callback);
      callback({ ...frontSeatsData });
    }
    return () => { const idx = callbacks.indexOf(callback); if(idx!==-1) callbacks.splice(idx,1); };
  }

  function getData() { return { ...frontSeatsData }; }
  function startAutoUpdate(intervalMs = 5000) { stopAutoUpdate(); fetchData(); updateInterval = setInterval(fetchData, intervalMs); }
  function stopAutoUpdate() { if(updateInterval) { clearInterval(updateInterval); updateInterval=null; } }
  function init() { startAutoUpdate(5000); }

  return {
    init,
    getData,
    subscribe,
    fetchData,
    startAutoUpdate,
    stopAutoUpdate,
    updateFromEvent
  };
})();