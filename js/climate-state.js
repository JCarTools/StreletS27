/**********************************************
 * Модуль: Климат — состояние и данные
 * Часть 2 из 4. Логика state + нормализация + applyCarData.
 * Зависимости: climate-icons (для getIconColorHex не нужен).
 **********************************************/

modules.climateState = (function() {
  const OPTIMISTIC_MS = 3000;

  const ACTION_STATE_COMMANDS = {
    heat_wheel_on: { key: "rulHeat", value: true, apiCmd: "climate_set_steering_wheel_heat" },
    heat_wheel_off: { key: "rulHeat", value: false, apiCmd: "climate_set_steering_wheel_heat" },
    heat_windshield_on: { key: "lobHeat", value: true, apiCmd: "climate_set_front_glass_heat" },
    heat_windshield_off: { key: "lobHeat", value: false, apiCmd: "climate_set_front_glass_heat" },
    heat_rearwindow_on: { key: "zadHeat", value: true, apiCmd: "climate_set_rear_defrost" },
    heat_rearwindow_off: { key: "zadHeat", value: false, apiCmd: "climate_set_rear_defrost" },
    Recirculation_On: { key: "recirculation", value: true, apiCmd: "climate_set_recirculation" },
    Recirculation_Off: { key: "recirculation", value: false, apiCmd: "climate_set_recirculation" }
  };

  const climateState = {};
  const optimisticLevels = Object.create(null);
  const optimisticActions = Object.create(null);

  function normalizeLevel(v) {
    const n = Number(v); if (!Number.isFinite(n)) return null;
    const r = Math.round(n); if (r === 0) return 0; if (r >= 1 && r <= 4) return r - 1; return null;
  }

  function normalizeFanLevel(v) {
    const n = Number(v); if (!Number.isFinite(n)) return null;
    const r = Math.round(n); if (r < 0 || r > 10) return null; return r;
  }

  function normalizeBoolean(v) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true","1","on","yes"].includes(s)) return true;
      if (["false","0","off","no"].includes(s)) return false;
    }
    return null;
  }

  function findKeyRecursive(obj, names, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return null;
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();
      if (names.some(n => lk.includes(n))) {
        const val = normalizeBoolean(obj[k]);
        if (val !== null) return val;
      }
    }
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === 'object') {
        const res = findKeyRecursive(obj[k], names, depth + 1);
        if (res !== null) return res;
      }
    }
    return null;
  }

  function sweepOptimistic() {
    const now = Date.now();
    Object.keys(optimisticLevels).forEach(k => { if (!optimisticLevels[k] || now >= optimisticLevels[k].until) delete optimisticLevels[k]; });
    Object.keys(optimisticActions).forEach(k => { if (!optimisticActions[k] || now >= optimisticActions[k].until) delete optimisticActions[k]; });
  }

  /**
   * Применяет сырые данные авто к climateState.
   * Возвращает true, если что-то изменилось (чтобы renderer знал, что надо перерисовать).
   */
  function applyCarData(raw, bootProtection) {
    if (!raw) return false;
    let payload;
    try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return false; }
    if (!payload || typeof payload !== 'object') return false;

    const seats = payload.seats || payload;
    const front = seats.front || seats.frontSeats || {};
    const rear = seats.rear || seats.rearSeats || {};
    const fl = front.frontLeft || {}, fr = front.frontRight || {};
    const rl = rear.rearLeft || {}, rr = rear.rearRight || {};

    const levels = {
      heat_seat_l: normalizeLevel(fl.heat), vent_seat_l: normalizeLevel(fl.vent),
      heat_seat_r: normalizeLevel(fr.heat), vent_seat_r: normalizeLevel(fr.vent),
      heat_zad_seat_l: normalizeLevel(rl.heat), vent_zad_seat_l: normalizeLevel(rl.vent),
      heat_zad_seat_r: normalizeLevel(rr.heat), vent_zad_seat_r: normalizeLevel(rr.vent)
    };

    let changed = false;
    const now = Date.now();
    Object.keys(levels).forEach(cmd => {
      const lvl = levels[cmd]; if (lvl == null) return;
      const o = optimisticLevels[cmd];
      if (o && now < o.until) { if (lvl !== o.level) return; delete optimisticLevels[cmd]; }
      if (climateState[cmd] !== lvl) { climateState[cmd] = lvl; changed = true; }
    });

    const fanRaw = payload.fanSpeed;
    if (fanRaw !== undefined && fanRaw !== null) {
      const fanLvl = normalizeFanLevel(fanRaw);
      if (fanLvl !== null) {
        const o = optimisticLevels['fan_speed'];
        let skip = false;
        if (o && now < o.until) { if (fanLvl !== o.level) skip = true; else delete optimisticLevels['fan_speed']; }
        if (bootProtection && fanLvl === 0) skip = true;
        const cur = climateState['fan_speed'] || 0;
        if (cur > 0 && fanLvl === 0) skip = true;
        if (!skip && climateState['fan_speed'] !== fanLvl) { climateState['fan_speed'] = fanLvl; changed = true; }
      }
    }

    const heat = (payload.heat && typeof payload.heat === 'object') ? payload.heat : payload;

    Object.keys(ACTION_STATE_COMMANDS).forEach(cmd => {
      if (cmd.startsWith('Recirculation')) return;
      const m = ACTION_STATE_COMMANDS[cmd];
      let v = null;
      if (payload.climate && typeof payload.climate === 'object' && payload.climate[m.apiCmd.replace('climate_set_', '')] !== undefined) {
        v = normalizeBoolean(payload.climate[m.apiCmd.replace('climate_set_', '')]);
      } else if (heat && heat[m.key] !== undefined) {
        v = normalizeBoolean(heat[m.key]);
      }
      if (v == null) return;
      const o = optimisticActions[m.key];
      if (o && now < o.until) { if (v !== o.value) return; delete optimisticActions[m.key]; }
      const target = v ? 1 : 0;
      if (climateState[cmd] !== target) { climateState[cmd] = target; changed = true; }
    });

    let recircVal = null;
    if (payload.climate && typeof payload.climate === 'object' && payload.climate.recirculation !== undefined) {
      recircVal = normalizeBoolean(payload.climate.recirculation);
    } else {
      recircVal = findKeyRecursive(payload, ['recirculation', 'recirc', 'air_circulation', 'circle']);
    }
    if (recircVal !== null) {
      const o = optimisticActions['recirculation'];
      let skip = false;
      if (o && now < o.until) { if (recircVal !== o.value) skip = true; else delete optimisticActions['recirculation']; }
      if (!skip) {
        const target = recircVal ? 1 : 0;
        if (climateState['Recirculation_On'] !== target) { climateState['Recirculation_On'] = target; changed = true; }
      }
    }

    return changed;
  }

  return {
    OPTIMISTIC_MS,
    ACTION_STATE_COMMANDS,
    climateState,
    optimisticLevels,
    optimisticActions,
    normalizeLevel,
    normalizeFanLevel,
    normalizeBoolean,
    sweepOptimistic,
    applyCarData
  };
})();