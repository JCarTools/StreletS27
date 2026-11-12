/**********************************************
 * Модуль: Топливо, АКБ и свободное место на диске
 * [FIX] storageFree приходит в БАЙТАХ → пересчитываем в GiB (/ 1024^3).
 * [FIX] Вместо 'л' отображается 'Л', вместо 'V' — 'В', вместо 'GiB' — 'ГБ'.
 * [FIX 6.4] Убран сырой вызов window.androidApi.getCarData(getToken(), 'storageFree').
 *       Теперь используется android.requestCarDataAsync('storageFree', 2000)
 *       из core.js — единый путь, без ручного JSON.parse и getToken().
 * [FIX] window storage-listener теперь именованный (storageHandler) —
 *       сохраняется в модуле и снимается в destroy(). Раньше при повторном
 *       init() после destroy() слушатели накапливались.
 * [FIX] fetchStorageFreeSync: нормализация ответа моста — поддерживаем
 *       и число (байты), и объект { value: number } / { storageFree: number }.
 **********************************************/

modules.fuel = (function() {
  let fuelPercent = null;
  let batteryVoltage = null;
  let storageFreeGiB = null;
  let pollInterval = null;
  let subscribed = false;
  let storageHandler = null;

  const elFuelValue = document.getElementById('fuelValue');
  const elFuelUnit = document.getElementById('fuelUnit');
  const elBatteryValue = document.getElementById('batteryValue');
  const elStorageValue = document.getElementById('storageValue');
  const elStorageUnit = document.querySelector('.widget_placeholder__storage .widget_placeholder__unit');

  const FUEL_LOW_LITERS = 10;
  const BATTERY_LOW_VOLTS = 12;
  const STORAGE_WARN_GIB = 3;
  const STORAGE_LOW_GIB = 1.5;
  const BYTES_IN_GIB = 1024 * 1024 * 1024;

  function getTankSize() {
    const n = parseFloat(storage.load('setting_fuelTankSize'));
    return (Number.isFinite(n) && n > 0) ? n : 57;
  }

  function getDisplayMode() {
    return storage.load('setting_fuelDisplayMode') === 'percent' ? 'percent' : 'liters';
  }

  function isFuelLow(percentValue, tankSize) {
    if (percentValue === null || !Number.isFinite(percentValue)) return false;
    const liters = percentValue * tankSize / 100;
    return liters < FUEL_LOW_LITERS;
  }

  function isBatteryLow(volts) {
    if (volts === null || !Number.isFinite(volts)) return false;
    return volts < BATTERY_LOW_VOLTS;
  }

  function setColorState(el, state) {
    if (!el) return;
    el.classList.remove('is-low', 'is-warn');
    if (state === 'low') el.classList.add('is-low');
    else if (state === 'warn') el.classList.add('is-warn');
  }

  function setColorStateForPair(valueEl, unitEl, state) {
    setColorState(valueEl, state);
    setColorState(unitEl, state);
  }

  function bytesToGiB(bytes) {
    if (bytes === null || bytes === undefined) return null;
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return null;
    return n / BYTES_IN_GIB;
  }

  function render() {
    const tankSize = getTankSize();
    const displayMode = getDisplayMode();
    const fuelLow = isFuelLow(fuelPercent, tankSize);

    if (elFuelValue && elFuelUnit) {
      if (fuelPercent === null) {
        elFuelValue.textContent = '—';
        elFuelUnit.textContent = displayMode === 'liters' ? 'Л' : '%';
        setColorStateForPair(elFuelValue, elFuelUnit, null);
      } else {
        if (displayMode === 'liters') {
          const liters = fuelPercent * tankSize / 100;
          elFuelValue.textContent = liters.toFixed(1);
          elFuelUnit.textContent = 'Л';
        } else {
          elFuelValue.textContent = String(Math.round(fuelPercent));
          elFuelUnit.textContent = '%';
        }
        setColorStateForPair(elFuelValue, elFuelUnit, fuelLow ? 'low' : null);
      }
    }

    if (elBatteryValue) {
      elBatteryValue.textContent = batteryVoltage !== null ? batteryVoltage.toFixed(1) : '—';
      const batteryUnit = elBatteryValue.nextElementSibling;
      const unitEl = (batteryUnit && batteryUnit.classList.contains('widget_placeholder__unit')) ? batteryUnit : null;
      if (unitEl) unitEl.textContent = 'В';
      setColorStateForPair(elBatteryValue, unitEl, isBatteryLow(batteryVoltage) ? 'low' : null);
    }

    if (elStorageValue) {
      if (storageFreeGiB === null || !Number.isFinite(storageFreeGiB)) {
        elStorageValue.textContent = '—';
        setColorStateForPair(elStorageValue, elStorageUnit, null);
      } else {
        elStorageValue.textContent = storageFreeGiB.toFixed(1);
        let state = null;
        if (storageFreeGiB < STORAGE_LOW_GIB) state = 'low';
        else if (storageFreeGiB <= STORAGE_WARN_GIB) state = 'warn';
        setColorStateForPair(elStorageValue, elStorageUnit, state);
      }
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

    let sRaw = null;
    if (data.storageFree !== undefined) {
      sRaw = data.storageFree;
    } else if (data.storage && data.storage.free !== undefined) {
      sRaw = data.storage.free;
    } else if (data.vehicle && data.vehicle.storageFree !== undefined) {
      sRaw = data.vehicle.storageFree;
    }

    const s = bytesToGiB(sRaw);
    if (s !== null && Number.isFinite(s)) {
      if (storageFreeGiB !== s) {
        storageFreeGiB = s;
        changed = true;
      }
    }

    if (changed) render();
  }

  // [FIX] Единый путь через android.requestCarDataAsync.
  // Поддерживаем оба формата ответа моста: число (байты) и объект { value } / { storageFree }.
  async function fetchStorageFreeSync() {
    if (typeof android === 'undefined' || typeof android.requestCarDataAsync !== 'function') return;
    try {
      const res = await android.requestCarDataAsync('storageFree', 2000);
      if (res === null || res === undefined) return;

      let bytes = null;
      if (typeof res === 'number') {
        bytes = res;
      } else if (typeof res === 'object') {
        if (res.storageFree !== undefined) bytes = Number(res.storageFree);
        else if (res.value !== undefined) bytes = Number(res.value);
        else if (res.free !== undefined) bytes = Number(res.free);
      }

      if (bytes === null || !Number.isFinite(bytes)) return;
      applyCarData({ storageFree: bytes });
    } catch (e) {
      console.warn('[Fuel] storageFree sync error:', e);
    }
  }

  function init() {
    render();

    if (!subscribed && modules.carData && typeof modules.carData.subscribe === 'function') {
      modules.carData.subscribe(applyCarData);
      subscribed = true;
    }

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!isAndroid() || typeof android.requestCarDataAsync !== 'function') return;

      const fRes = await android.requestCarDataAsync('fuel', 2000);
      if (fRes) applyCarData({ fuel: fRes });

      const bRes = await android.requestCarDataAsync('battery', 2000);
      if (bRes) applyCarData({ battery: bRes });

      // Не await — чтобы не блокировать цикл. Внутри своя защита.
      fetchStorageFreeSync();

      if (storageFreeGiB === null) {
        const sRes = await android.requestCarDataAsync('storageFree', 2000);
        if (sRes) {
          let bytes = null;
          if (typeof sRes === 'number') bytes = sRes;
          else if (typeof sRes === 'object') {
            if (sRes.storageFree !== undefined) bytes = Number(sRes.storageFree);
            else if (sRes.value !== undefined) bytes = Number(sRes.value);
            else if (sRes.free !== undefined) bytes = Number(sRes.free);
          }
          if (bytes !== null && Number.isFinite(bytes)) {
            applyCarData({ storageFree: bytes });
          }
        }
      }
    }, 10000);

    setTimeout(fetchStorageFreeSync, 200);

    // [FIX] Именованный storage-обработчик — снимается в destroy().
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler);
      storageHandler = null;
    }
    storageHandler = (e) => {
      if (e.key === 'setting_fuelTankSize' || e.key === 'setting_fuelDisplayMode') render();
    };
    window.addEventListener('storage', storageHandler);
  }

  function destroy() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    // [FIX] Снимаем storage-обработчик, чтобы не накапливался при повторном init().
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler);
      storageHandler = null;
    }
    subscribed = false;
  }

  return { init, refreshDisplay: render, destroy, updateFromEvent: applyCarData };
})();