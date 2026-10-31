modules.climate = (function() {
  let climateCommands = [], climateState = {};
  let currentPickerSlot = null;
  let trunkOpen = !!storage.load('climateTrunkOpen');
  let optimisticLevels = Object.create(null);
  let optimisticActions = Object.create(null);
  const OPTIMISTIC_MS = 3000;
  let optimisticSweepTimer = null;
  let climatePollTimer = null;
  let bootProtection = true;

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

  function loadCommands() {
    climateCommands = [
      { cmd: "heat_seat_l", label: climateLabelFor("heat_seat_l"), max: 3, icon: "icons/Seat heated_left.svg", off: "heat_seat_l_0" },
      { cmd: "heat_seat_r", label: climateLabelFor("heat_seat_r"), max: 3, icon: "icons/Seat heated_right.svg", off: "heat_seat_r_0" },
      { cmd: "heat_zad_seat_l", label: climateLabelFor("heat_zad_seat_l"), max: 3, icon: "icons/Seat heated_left.svg", off: "heat_zad_seat_l_0" },
      { cmd: "heat_zad_seat_r", label: climateLabelFor("heat_zad_seat_r"), max: 3, icon: "icons/Seat heated_right.svg", off: "heat_zad_seat_r_off" },
      { cmd: "heat_wheel_on", label: climateLabelFor("heat_wheel_on"), max: 1, icon: "icons/Steering wheel heat.svg", off: "heat_wheel_off" },
      { cmd: "heat_windshield_on", label: climateLabelFor("heat_windshield_on"), max: 1, icon: "icons/Windshield defroster.svg", off: "heat_windshield_off" },
      { cmd: "heat_rearwindow_on", label: climateLabelFor("heat_rearwindow_on"), max: 1, icon: "icons/Rare windshield defroster.svg", off: "heat_rearwindow_off" },
      { cmd: "vent_seat_l", label: climateLabelFor("vent_seat_l"), max: 3, icon: "icons/Seat vent_left.svg", off: "vent_seat_l_0" },
      { cmd: "vent_seat_r", label: climateLabelFor("vent_seat_r"), max: 3, icon: "icons/Seat vent_right.svg", off: "vent_seat_r_0" },
      { cmd: "vent_zad_seat_l", label: climateLabelFor("vent_zad_seat_l"), max: 3, icon: "icons/Seat vent_left.svg", off: "vent_zad_seat_l_0" },
      { cmd: "vent_zad_seat_r", label: climateLabelFor("vent_zad_seat_r"), max: 3, icon: "icons/Seat vent_right.svg", off: "vent_zad_seat_r_off" },
      { cmd: "Recirculation_On", label: climateLabelFor("Recirculation_On"), max: 1, icon: "icons/Recirculation.svg", off: "Recirculation_Off" },
      { cmd: "fan_speed", label: "Вентилятор", min: 1, max: 10, icon: "FAN_SVG", off: null },
      { cmd: "trunk", label: "Багажник", max: 1, icon: "icons/Trunk_open.svg", off: "trunk" },
      { cmd: "voditel_seat_1", label: climateLabelFor("voditel_seat_1"), max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_2", label: climateLabelFor("voditel_seat_2"), max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_3", label: climateLabelFor("voditel_seat_3"), max: 1, icon: "icons/Driver.svg" }
    ];
  }

  function getOff(cmd) { return cmd.off || `${cmd.cmd}_0`; }
  function getIconColorHex() {
    const c = storage.load('setting_climateIconColor') || 'Белый';
    return (c === 'Чёрный' || c === 'Черный') ? '#000000' : '#ffffff';
  }
  function getFanSvg(color = '#fff') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; display: block;"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
  }

  function renderSlot(s) {
    const id = s.dataset.climateSlot;
    const saved = storage.load(`climate_slot_${id}`);
    s.innerHTML = "";
    if (!saved) {
      s.innerHTML = '<span style="font-size:1.5rem;opacity:0.5;">+</span>';
      s.classList.remove('active');
      return;
    }
    const c = climateCommands.find(x => x.cmd === saved);
    if (!c) return;

    let lvl = 0;
    if (saved === 'trunk') lvl = trunkOpen ? 1 : 0;
    else lvl = climateState[saved] || 0;

    const iconColor = getIconColorHex();

    if (saved === 'fan_speed') {
      const displayVal = lvl === 0 ? '—' : lvl;
      const isActive = lvl > 1;
      s.innerHTML = `
        <div class="climate-svg-icon" style="width: 2.2rem; height: 2.2rem; margin-bottom: 0.3rem;">${getFanSvg(iconColor)}</div>
        <div class="climate-label">${c.label}</div>
        <div class="climate-fan-value" style="font-size: 0.8rem; font-weight: 700; line-height: 1; color: rgba(244,248,255,${lvl > 0 ? '0.95' : '0.45'}); font-variant-numeric: tabular-nums; margin-top: 0.2rem; padding: 0; position: relative;">${displayVal}</div>
      `;
      s.classList.toggle('active', isActive);
      return;
    }

    const dots = Array.from({ length: c.max }, (_, i) => `<span class="climate-dot${i < lvl ? ' on' : ''}"></span>`).join('');
    const iconHtml = `<img src="${c.icon}" class="climate-icon">`;
    s.innerHTML = `${iconHtml}<div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
    s.classList.toggle('active', lvl > 0);
  }

  function updateAll() { document.querySelectorAll('.climate_slot').forEach(renderSlot); }

  function updateIconColors() {
    document.querySelectorAll('.climate_slot').forEach(renderSlot);
    const color = storage.load('setting_climateIconColor') || 'Белый';
    const isWhite = color === 'Белый';
    document.body.classList.toggle('climate-icons-white', isWhite);
    document.body.classList.toggle('climate-icons-black', !isWhite);
  }

  function normalizeLevel(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const r = Math.round(n);
    if (r === 0) return 0;
    if (r >= 1 && r <= 4) return r - 1;
    return null;
  }
  function normalizeFanLevel(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const r = Math.round(n);
    if (r < 0 || r > 10) return null;
    return r;
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
  function startOptimisticSweep() { if (!optimisticSweepTimer) optimisticSweepTimer = setInterval(sweepOptimistic, 1500); }
  function stopOptimisticSweep() { if (optimisticSweepTimer) { clearInterval(optimisticSweepTimer); optimisticSweepTimer = null; } }

  async function pollClimateState() {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') return;
    if (document.hidden) return;
    try {
      const res = await android.requestCarCommandAsync(JSON.stringify({ cmd: 'climate_get_state' }), 2000);
      if (res && res.success) {
        applyCarData({
          fanSpeed: res.fanSpeed,
          climate: { recirculation: res.recirculation, frontGlassHeat: res.frontGlassHeat, rearDefrost: res.rearDefrost, steeringWheelHeat: res.steeringWheelHeat }
        });
      }
    } catch (e) {}
  }
  function startPolling() { stopPolling(); climatePollTimer = setInterval(pollClimateState, 5000); }
  function stopPolling() { if (climatePollTimer) { clearInterval(climatePollTimer); climatePollTimer = null; } }

  function applyCarData(raw) {
    if (!raw) return;
    let payload;
    try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!payload || typeof payload !== 'object') return;

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
      const lvl = levels[cmd];
      if (lvl == null) return;
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

    const heat = payload.heat || payload;
    Object.keys(ACTION_STATE_COMMANDS).forEach(cmd => {
      if (cmd.startsWith('Recirculation')) return;
      const m = ACTION_STATE_COMMANDS[cmd];
      let v = null;
      if (payload.climate && payload.climate[m.apiCmd.replace('climate_set_', '')] !== undefined) {
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
    if (payload.climate && payload.climate.recirculation !== undefined) {
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

    if (changed) updateAll();
  }

  function sendFanSpeed(value) {
    if (window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
      window.androidApi.requestCarCommandAsync(getToken(), 'fan_' + Date.now(), JSON.stringify({ cmd: 'climate_set_fan_speed', value: value }));
    } else if (typeof android.runEnum === 'function') {
      android.runEnum(`fan_speed_${value}`);
    }
  }

  function onSlotClick(slotElement) {
    const slotId = slotElement.dataset.climateSlot;
    const saved = storage.load(`climate_slot_${slotId}`);
    if (!saved) { openPicker(slotElement); return; }
    const c = climateCommands.find(x => x.cmd === saved);
    if (!c) return;

    if (saved === 'trunk') {
      const cmd = trunkOpen ? 'close_trunk' : 'open_trunk';
      if (window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
        window.androidApi.requestCarCommandAsync(getToken(), 'trunk_' + Date.now(), JSON.stringify({ cmd }));
      } else if (typeof android.runEnum === 'function') {
        android.runEnum(cmd);
      }
      trunkOpen = !trunkOpen;
      storage.save('climateTrunkOpen', trunkOpen);
      renderSlot(slotElement);
      if (typeof showToast === 'function') showToast(trunkOpen ? 'Багажник открыт' : 'Багажник закрыт');
      return;
    }

    if (saved.startsWith('voditel_seat_')) {
      android.runEnum(saved);
      if (typeof showToast === 'function') showToast(c.label.replace(/\\n/g, ' '));
      return;
    }

    if (saved === 'fan_speed') {
      const cur = climateState['fan_speed'] || 0;
      let next = cur === 0 ? 1 : (cur >= 10 ? 1 : cur + 1);
      climateState['fan_speed'] = next;
      optimisticLevels['fan_speed'] = { level: next, until: Date.now() + OPTIMISTIC_MS };
      renderSlot(slotElement);
      sendFanSpeed(next);
      return;
    }

    const curLvl = climateState[saved] || 0;
    const maxLvl = c.max || 1;
    let next;
    if (curLvl === 0) next = maxLvl;
    else if (curLvl === 1) next = 0;
    else next = curLvl - 1;

    climateState[saved] = next;

    if (saved === 'Recirculation_On') {
      optimisticActions['recirculation'] = { value: next > 0, until: Date.now() + OPTIMISTIC_MS };
    } else if (ACTION_STATE_COMMANDS[saved]) {
      optimisticActions[ACTION_STATE_COMMANDS[saved].key] = { value: next > 0, until: Date.now() + OPTIMISTIC_MS };
    } else {
      optimisticLevels[saved] = { level: next, until: Date.now() + OPTIMISTIC_MS };
    }
    renderSlot(slotElement);

    if (ACTION_STATE_COMMANDS[saved] && window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
      const m = ACTION_STATE_COMMANDS[saved];
      window.androidApi.requestCarCommandAsync(getToken(), 'climate_' + Date.now(), JSON.stringify({ cmd: m.apiCmd, value: next > 0 }));
    } else if (saved === 'Recirculation_On' && window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
      window.androidApi.requestCarCommandAsync(getToken(), 'climate_' + Date.now(), JSON.stringify({ cmd: 'climate_set_recirculation', value: next > 0 }));
    } else {
      let cmd;
      if (next === 0) cmd = getOff(c);
      else if (c.max === 1) cmd = saved;
      else cmd = `${saved}_${next}`;
      android.runEnum(cmd);
    }
  }

  function initSlots() {
    document.querySelectorAll('.climate_slot').forEach(slot => {
      if (slot._clickHandler) slot.removeEventListener('click', slot._clickHandler);
      slot._clickHandler = (e) => { e.stopPropagation(); e.preventDefault(); onSlotClick(slot); };
      slot.addEventListener('click', slot._clickHandler);
      makeLongPressable(slot, () => openPicker(slot), { delay: 700 });
    });
  }

  function openPicker(slotElement) {
    currentPickerSlot = slotElement.dataset.climateSlot;
    const picker = document.getElementById('climate-picker');
    const grid = document.getElementById('climate-picker-grid');
    if (!picker || !grid) return;
    grid.innerHTML = '';
    const iconColor = getIconColorHex();
    climateCommands.forEach(cmd => {
      const d = document.createElement('div');
      d.className = 'picker-item';
      let iconHtml = cmd.cmd === 'fan_speed'
        ? `<div style="width: 2.2rem; height: 2.2rem; margin: 0 auto 0.5rem;">${getFanSvg(iconColor)}</div>`
        : `<img src="${cmd.icon}" class="picker-icon">`;
      d.innerHTML = `${iconHtml}<span>${cmd.label.replace(/\\n/g,' ')}</span>`;
      d.onclick = () => {
        storage.save(`climate_slot_${currentPickerSlot}`, cmd.cmd);
        climateState[cmd.cmd] = 0;
        updateAll();
        picker.classList.remove('open');
      };
      grid.appendChild(d);
    });
    picker.classList.add('open');
  }

  function reinitSlots() { setTimeout(() => { initSlots(); updateAll(); }, 50); }

  function init() {
    loadCommands();
    initSlots();
    updateIconColors();
    startOptimisticSweep();
    startPolling();
    if (modules.carData) modules.carData.subscribe(applyCarData);
    setTimeout(() => { bootProtection = false; }, 10000);

    document.getElementById('climate-picker-close')?.addEventListener('click', () => {
      document.getElementById('climate-picker')?.classList.remove('open');
    });

    document.getElementById('climateOffAll')?.addEventListener('click', () => {
      let anyOff = false;
      document.querySelectorAll('.climate_slot').forEach(slot => {
        const id = slot.dataset.climateSlot;
        const saved = storage.load(`climate_slot_${id}`);
        if (!saved || saved === 'trunk' || saved === 'fan_speed') return;
        const c = climateCommands.find(x => x.cmd === saved);
        if (c && (climateState[saved] || 0) > 0) {
          android.runEnum(getOff(c));
          climateState[saved] = 0;
          renderSlot(slot);
          anyOff = true;
        }
      });
      if (anyOff && typeof showToast === 'function') showToast('Все функции выключены');
    });
  }

  function destroy() { stopOptimisticSweep(); stopPolling(); }

  return { init, updateState: applyCarData, destroy, reinitSlots, updateIconColors };
})();