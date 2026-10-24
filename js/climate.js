/**********************************************
 * Модуль: Климат (2x3)
 * [FIX] Добавлен reinitSlots: перепривязка кликов на новые слоты.
 **********************************************/

modules.climate = (function() {
  let climateCommands = [], climateState = {};
  let currentPickerSlot = null;
  
  let trunkOpen = false;

  let optimisticLevels = Object.create(null);
  let optimisticActions = Object.create(null);
  const OPTIMISTIC_MS = 3000;

  const ACTION_STATE_COMMANDS = {
    heat_wheel_on: { key: "rulHeat", value: true },
    heat_wheel_off: { key: "rulHeat", value: false },
    heat_windshield_on: { key: "lobHeat", value: true },
    heat_windshield_off: { key: "lobHeat", value: false },
    heat_rearwindow_on: { key: "zadHeat", value: true },
    heat_rearwindow_off: { key: "zadHeat", value: false },
    Recirculation_On: { key: "recirculation", value: true },
    Recirculation_Off: { key: "recirculation", value: false }
  };

  function loadCommands() {
    climateCommands = [
      // === ПОДОГРЕВЫ ===
      { cmd: "heat_seat_l", label: climateLabelFor("heat_seat_l"), max: 3, icon: "icons/Seat heated_left.svg", off: "heat_seat_l_0" },
      { cmd: "heat_seat_r", label: climateLabelFor("heat_seat_r"), max: 3, icon: "icons/Seat heated_right.svg", off: "heat_seat_r_0" },
      { cmd: "heat_zad_seat_l", label: climateLabelFor("heat_zad_seat_l"), max: 3, icon: "icons/Seat heated_left.svg", off: "heat_zad_seat_l_0" },
      { cmd: "heat_zad_seat_r", label: climateLabelFor("heat_zad_seat_r"), max: 3, icon: "icons/Seat heated_right.svg", off: "heat_zad_seat_r_off" },
      { cmd: "heat_wheel_on", label: climateLabelFor("heat_wheel_on"), max: 1, icon: "icons/Steering wheel heat.svg", off: "heat_wheel_off" },
      { cmd: "heat_windshield_on", label: climateLabelFor("heat_windshield_on"), max: 1, icon: "icons/Windshield defroster.svg", off: "heat_windshield_off" },
      { cmd: "heat_rearwindow_on", label: climateLabelFor("heat_rearwindow_on"), max: 1, icon: "icons/Rare windshield defroster.svg", off: "heat_rearwindow_off" },
      
      // === ВЕНТИЛЯЦИЯ ===
      { cmd: "vent_seat_l", label: climateLabelFor("vent_seat_l"), max: 3, icon: "icons/Seat vent_left.svg", off: "vent_seat_l_0" },
      { cmd: "vent_seat_r", label: climateLabelFor("vent_seat_r"), max: 3, icon: "icons/Seat vent_right.svg", off: "vent_seat_r_0" },
      { cmd: "vent_zad_seat_l", label: climateLabelFor("vent_zad_seat_l"), max: 3, icon: "icons/Seat vent_left.svg", off: "vent_zad_seat_l_0" },
      { cmd: "vent_zad_seat_r", label: climateLabelFor("vent_zad_seat_r"), max: 3, icon: "icons/Seat vent_right.svg", off: "vent_zad_seat_r_off" },
      
      // === ОСТАЛЬНОЕ ===
      { cmd: "Recirculation_On", label: climateLabelFor("Recirculation_On"), max: 1, icon: "icons/Recirculation.svg", off: "Recirculation_Off" },
      { cmd: "trunk", label: "Багажник", max: 1, icon: "TRUNK_SVG", off: "trunk" },
      { cmd: "voditel_seat_1", label: climateLabelFor("voditel_seat_1"), max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_2", label: climateLabelFor("voditel_seat_2"), max: 1, icon: "icons/Driver.svg" },
      { cmd: "voditel_seat_3", label: climateLabelFor("voditel_seat_3"), max: 1, icon: "icons/Driver.svg" }
    ];
  }

  function getOff(cmd) {
    return cmd.off || `${cmd.cmd}_0`;
  }

  function getTrunkSvg(color = '#fff') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; display: block;">
      <path d="M3 17h18" />
      <path d="M7 17l-1.5-4.5A2 2 0 0 1 7.4 10h4.2" />
      <path d="M13 10h4.6a2 2 0 0 1 1.9 1.3L21 17" />
      <path d="M12 10V6a2 2 0 0 1 2-2h3" />
      <path d="M16 2l3 2-3 2" />
    </svg>`;
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
    if (saved === 'trunk') {
      lvl = trunkOpen ? 1 : 0;
    } else {
      lvl = climateState[saved] || 0;
    }

    const dots = Array.from({ length: c.max }, (_, i) => `<span class="climate-dot${i < lvl ? ' on' : ''}"></span>`).join('');
    
    let iconHtml = '';
    if (saved === 'trunk') {
      iconHtml = `<div class="climate-svg-icon" style="width: 2.2rem; height: 2.2rem; margin-bottom: 0.3rem;">${getTrunkSvg('#fff')}</div>`;
    } else {
      iconHtml = `<img src="${c.icon}">`;
    }

    s.innerHTML = `${iconHtml}<div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
    s.classList.toggle('active', lvl > 0);
    
    if (saved !== 'trunk') {
      const img = s.querySelector('img');
      if (img) {
        img.style.filter = 'brightness(0) invert(1)';
        img.style.opacity = '0.92';
      }
    }
  }

  function updateAll() {
    document.querySelectorAll('.climate_slot').forEach(renderSlot);
  }

  function normalizeLevel(value) {
    const level = Number(value);
    if (!Number.isFinite(level)) return null;
    const rounded = Math.round(level);
    if (rounded >= 1 && rounded <= 4) return rounded - 1;
    return rounded === 0 ? 0 : null;
  }

  function normalizeBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "on", "yes"].includes(normalized)) return true;
      if (["false", "0", "off", "no"].includes(normalized)) return false;
    }
    return null;
  }

  function findKeyRecursive(obj, keyNames, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return null;
    for (const k of Object.keys(obj)) {
      const lower = k.toLowerCase();
      if (keyNames.some(name => lower.includes(name))) {
        const val = normalizeBoolean(obj[k]);
        if (val !== null) return val;
      }
    }
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === 'object') {
        const res = findKeyRecursive(obj[k], keyNames, depth + 1);
        if (res !== null) return res;
      }
    }
    return null;
  }

  function applyCarData(raw) {
    if (!raw) return;
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const seats = payload.seats || payload;
    const front = seats.front || seats.frontSeats || {};
    const rear = seats.rear || seats.rearSeats || {};
    const frontLeft = front.frontLeft || {};
    const frontRight = front.frontRight || {};
    const rearLeft = rear.rearLeft || {};
    const rearRight = rear.rearRight || {};

    const levels = {
      heat_seat_l: normalizeLevel(frontLeft.heat),
      vent_seat_l: normalizeLevel(frontLeft.vent),
      heat_seat_r: normalizeLevel(frontRight.heat),
      vent_seat_r: normalizeLevel(frontRight.vent),
      heat_zad_seat_l: normalizeLevel(rearLeft.heat),
      vent_zad_seat_l: normalizeLevel(rearLeft.vent),
      heat_zad_seat_r: normalizeLevel(rearRight.heat),
      vent_zad_seat_r: normalizeLevel(rearRight.vent)
    };

    let changed = false;
    const now = Date.now();
    
    Object.keys(levels).forEach(cmd => {
      const level = levels[cmd];
      if (level == null) return;
      const optimistic = optimisticLevels[cmd];
      if (optimistic && now < optimistic.until) {
        if (level !== optimistic.level) return;
        if (level === optimistic.level) delete optimisticLevels[cmd];
      }
      if (climateState[cmd] !== level) {
        climateState[cmd] = level;
        changed = true;
      }
    });

    const heat = payload.heat || payload;
    Object.keys(ACTION_STATE_COMMANDS).forEach(cmd => {
      if (cmd.startsWith('Recirculation')) return;
      const mapping = ACTION_STATE_COMMANDS[cmd];
      const value = normalizeBoolean(heat[mapping.key]);
      if (value == null) return;
      const optimistic = optimisticActions[mapping.key];
      if (optimistic && now < optimistic.until) {
        if (value !== optimistic.value) return;
        if (value === optimistic.value) delete optimisticActions[mapping.key];
      }
      const targetLevel = value ? 1 : 0;
      if (climateState[cmd] !== targetLevel) {
        climateState[cmd] = targetLevel;
        changed = true;
      }
    });

    const recircVal = findKeyRecursive(payload, ['recirculation', 'recirc', 'air_circulation', 'circle']);
    if (recircVal !== null) {
      const optimistic = optimisticActions['recirculation'];
      let skip = false;
      if (optimistic && now < optimistic.until) {
        if (recircVal !== optimistic.value) skip = true;
        if (recircVal === optimistic.value) delete optimisticActions['recirculation'];
      }
      if (!skip) {
        const targetLevel = recircVal ? 1 : 0;
        if (climateState['Recirculation_On'] !== targetLevel) {
          climateState['Recirculation_On'] = targetLevel;
          changed = true;
        }
      }
    }

    if (changed) updateAll();
  }

  function onSlotClick(slotElement) {
    const slotId = slotElement.dataset.climateSlot;
    const saved = storage.load(`climate_slot_${slotId}`);
    if (!saved) { openPicker(slotElement); return; }
    const c = climateCommands.find(x => x.cmd === saved);
    if (!c) return;
    
    if (saved === 'trunk') {
      const cmdToSend = trunkOpen ? 'close_trunk' : 'open_trunk';
      if (window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
        const reqId = 'trunk_' + Date.now();
        window.androidApi.requestCarCommandAsync(TOKEN, reqId, JSON.stringify({ cmd: cmdToSend }));
      } else if (typeof android.runEnum === 'function') {
        android.runEnum(cmdToSend);
      }
      
      trunkOpen = !trunkOpen;
      renderSlot(slotElement);
      showToast(trunkOpen ? 'Багажник открыт' : 'Багажник закрыт');
      return;
    }

    if (saved.startsWith('voditel_seat_')) {
      android.runEnum(saved);
      showToast(c.label.replace(/\\n/g, ' '));
      return;
    }

    const curLvl = climateState[saved] || 0;
    const next = (curLvl + 1) % ((c.max || 1) + 1);
    
    climateState[saved] = next;
    
    if (saved === 'Recirculation_On') {
       optimisticActions['recirculation'] = { value: next > 0, until: Date.now() + OPTIMISTIC_MS };
    } else if (ACTION_STATE_COMMANDS[saved]) {
       optimisticActions[ACTION_STATE_COMMANDS[saved].key] = { value: next > 0, until: Date.now() + OPTIMISTIC_MS };
    } else {
       optimisticLevels[saved] = { level: next, until: Date.now() + OPTIMISTIC_MS };
    }
    
    renderSlot(slotElement);

    let cmdToSend;
    if (next === 0) cmdToSend = getOff(c);
    else if (c.max === 1) cmdToSend = saved;
    else cmdToSend = `${saved}_${next}`;
    
    android.runEnum(cmdToSend);
  }

  // --- Инициализация слотов и перепривязка кликов ---
  function initSlots() {
    document.querySelectorAll('.climate_slot').forEach(slot => {
      if (slot._clickHandler) slot.removeEventListener('click', slot._clickHandler);
      slot._clickHandler = (e) => { e.stopPropagation(); e.preventDefault(); onSlotClick(slot); };
      slot.addEventListener('click', slot._clickHandler);
      // Перепривязываем longPress на случай если элемент новый
      makeLongPressable(slot, () => openPicker(slot), { delay: 700 });
    });
  }

  function openPicker(slotElement) {
    currentPickerSlot = slotElement.dataset.climateSlot;
    const picker = document.getElementById('climate-picker');
    const grid = document.getElementById('climate-picker-grid');
    if (!picker || !grid) return;
    grid.innerHTML = '';
    climateCommands.forEach(cmd => {
      const d = document.createElement('div');
      d.className = 'picker-item';
      
      let iconHtml = '';
      if (cmd.cmd === 'trunk') {
         iconHtml = `<div style="width: 2.2rem; height: 2.2rem; margin: 0 auto 0.5rem;">${getTrunkSvg('#fff')}</div>`;
      } else {
         iconHtml = `<img src="${cmd.icon}">`;
      }
      
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

  // Экспортируем reinitSlots, чтобы settings.js мог вызвать его после смены количества слотов
  function reinitSlots() {
    setTimeout(() => {
      initSlots();
      updateAll();
    }, 50);
  }

  function init() {
    loadCommands();
    initSlots();
    updateAll();
    
    if (modules.carData) modules.carData.subscribe(applyCarData);
    
    document.getElementById('climate-picker-close')?.addEventListener('click', () => {
      document.getElementById('climate-picker')?.classList.remove('open');
    });
    
    document.getElementById('climateOffAll')?.addEventListener('click', () => {
      let anyOff = false;
      document.querySelectorAll('.climate_slot').forEach(slot => {
        const id = slot.dataset.climateSlot;
        const saved = storage.load(`climate_slot_${id}`);
        if (!saved) return;
        if (saved === 'trunk') return;
        const c = climateCommands.find(x => x.cmd === saved);
        if (c && (climateState[saved] || 0) > 0) {
          android.runEnum(getOff(c));
          climateState[saved] = 0;
          renderSlot(slot);
          anyOff = true;
        }
      });
      if (anyOff) showToast('Все функции выключены');
    });
  }

  return { init, updateState: applyCarData, destroy: () => {}, reinitSlots };
})();