/**********************************************
 * Модуль: Топливо и АКБ
 * [FIX] Точный парсинг под формат моста.
 * [FIX] Использование toFixed(1) для предотвращения ошибок округления JS.
 **********************************************/

modules.fuel = (function() {
  let fuelPercent = null;
  let batteryVoltage = null;
  let pollInterval = null;
  
  const elFuelValue = document.getElementById('fuelValue');
  const elFuelUnit = document.getElementById('fuelUnit');
  const elBatteryValue = document.getElementById('batteryValue');

  function getTankSize() {
    const n = parseFloat(storage.load('setting_fuelTankSize'));
    return (Number.isFinite(n) && n > 0) ? n : 60;
  }

  function getDisplayMode() {
    return storage.load('setting_fuelDisplayMode') === 'liters' ? 'liters' : 'percent';
  }

  function render() {
    if (elFuelValue && elFuelUnit) {
      if (fuelPercent === null) {
        elFuelValue.textContent = '—';
        elFuelUnit.textContent = getDisplayMode() === 'liters' ? 'л' : '%';
      } else {
        if (getDisplayMode() === 'liters') {
          const liters = fuelPercent * getTankSize() / 100;
          // ИСПОЛЬЗУЕМ toFixed(1) ВМЕСТО Math.round
          elFuelValue.textContent = liters.toFixed(1);
          elFuelUnit.textContent = 'л';
        } else {
          elFuelValue.textContent = String(Math.round(fuelPercent));
          elFuelUnit.textContent = '%';
        }
      }
    }
    if (elBatteryValue) {
      elBatteryValue.textContent = batteryVoltage !== null ? batteryVoltage.toFixed(1) : '—';
    }
  }

  function applyCarData(data) {
    if (!data) return;
    let changed = false;

    let f = null;
    if (data.vehicle && data.vehicle.fuelPercent !== undefined) {
      f = Number(data.vehicle.fuelPercent);
    } else if (data.fuel && data.fuel.value !== undefined) {
      f = Number(data.fuel.value);
    } else if (data.fuelPercent !== undefined) {
      f = Number(data.fuelPercent);
    } else if (data.fuel && data.fuel.raw !== undefined) {
      f = Number(data.fuel.raw) / 10;
    }
    
    if (f !== null && Number.isFinite(f)) {
      const clamped = Math.max(0, Math.min(100, f));
      if (fuelPercent !== clamped) {
        fuelPercent = clamped;
        changed = true;
      }
    }

    let b = null;
    if (data.vehicle && data.vehicle.batteryVoltage !== undefined) {
      b = Number(data.vehicle.batteryVoltage);
    } else if (data.battery && data.battery.value !== undefined) {
      b = Number(data.battery.value);
    } else if (data.batteryVoltage !== undefined) {
      b = Number(data.batteryVoltage);
    }
    
    if (b !== null && Number.isFinite(b) && b > 0 && b < 100) {
      if (batteryVoltage !== b) {
        batteryVoltage = b;
        changed = true;
      }
    }

    if (changed) render();
  }

  function init() {
    render();
    if (modules.carData) modules.carData.subscribe(applyCarData);
    
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!IS_ANDROID || typeof android.requestCarDataAsync !== 'function') return;
      
      const fRes = await android.requestCarDataAsync('fuel', 2000);
      if (fRes) applyCarData({ fuel: fRes });
      
      const bRes = await android.requestCarDataAsync('battery', 2000);
      if (bRes) applyCarData({ battery: bRes });
    }, 10000);

    window.addEventListener('storage', (e) => {
      if (e.key === 'setting_fuelTankSize' || e.key === 'setting_fuelDisplayMode') render();
    });
  }

  function destroy() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return { init, refreshDisplay: render, destroy, updateFromEvent: applyCarData };
})();