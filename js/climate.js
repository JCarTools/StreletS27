/**********************************************
 * Модуль: Климат — точка входа
 * Часть 4 из 4.
 * [FIX] Вентилятор без зацикливания: «+» до 10, «−» до 1.
 * [FIX] fan_speed и fan_speed_down синхронизированы через общий climateState['fan_speed'].
 **********************************************/

modules.climate = (function() {
  const State = modules.climateState;
  const Render = modules.climateRender;
  const Icons = modules.climateIcons;

  const {
    OPTIMISTIC_MS,
    ACTION_STATE_COMMANDS,
    climateState,
    optimisticLevels,
    optimisticActions,
    sweepOptimistic,
    applyCarData
  } = State;

  let climatePollTimer = null;
  let optimisticSweepTimer = null;
  let bootProtection = true;

  const FAN_MIN = 1;
  const FAN_MAX = 10;

  function loadCommands() {
    const commands = [
      { cmd: "heat_seat_l", label: climateLabelFor("heat_seat_l"), max: 3, icon: "seat_heat", off: "heat_seat_l_0" },
      { cmd: "heat_seat_r", label: climateLabelFor("heat_seat_r"), max: 3, icon: "seat_heat", off: "heat_seat_r_0" },
      { cmd: "heat_zad_seat_l", label: climateLabelFor("heat_zad_seat_l"), max: 3, icon: "seat_heat", off: "heat_zad_seat_l_0" },
      { cmd: "heat_zad_seat_r", label: climateLabelFor("heat_zad_seat_r"), max: 3, icon: "seat_heat", off: "heat_zad_seat_r_off" },
      { cmd: "heat_wheel_on", label: climateLabelFor("heat_wheel_on"), max: 1, icon: "wheel", off: "heat_wheel_off" },
      { cmd: "heat_windshield_on", label: climateLabelFor("heat_windshield_on"), max: 1, icon: "windshield", off: "heat_windshield_off" },
      { cmd: "heat_rearwindow_on", label: climateLabelFor("heat_rearwindow_on"), max: 1, icon: "rearwindow", off: "heat_rearwindow_off" },
      { cmd: "vent_seat_l", label: climateLabelFor("vent_seat_l"), max: 3, icon: "seat_vent", off: "vent_seat_l_0" },
      { cmd: "vent_seat_r", label: climateLabelFor("vent_seat_r"), max: 3, icon: "seat_vent", off: "vent_seat_r_0" },
      { cmd: "vent_zad_seat_l", label: climateLabelFor("vent_zad_seat_l"), max: 3, icon: "seat_vent", off: "vent_zad_seat_l_0" },
      { cmd: "vent_zad_seat_r", label: climateLabelFor("vent_zad_seat_r"), max: 3, icon: "seat_vent", off: "vent_zad_seat_r_off" },
      { cmd: "Recirculation_On", label: climateLabelFor("Recirculation_On"), max: 1, icon: "recirculation", off: "Recirculation_Off" },
      { cmd: "fan_speed", label: "Вентилятор +", min: FAN_MIN, max: FAN_MAX, icon: "fan", off: null, badge: '+' },
      { cmd: "fan_speed_down", label: "Вентилятор −", min: FAN_MIN, max: FAN_MAX, icon: "fan_down", off: null, badge: '−' },
      { cmd: "trunk", label: "Багажник", max: 1, icon: "trunk", off: "trunk" },
      { cmd: "voditel_seat_1", label: climateLabelFor("voditel_seat_1"), max: 1, icon: "driver" },
      { cmd: "voditel_seat_2", label: climateLabelFor("voditel_seat_2"), max: 1, icon: "driver" },
      { cmd: "voditel_seat_3", label: climateLabelFor("voditel_seat_3"), max: 1, icon: "driver" }
    ];
    Render.setCommands(commands);
  }

  function getOff(cmd) { return cmd.off || `${cmd.cmd}_0`; }

  async function pollClimateState() {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') return;
    if (document.hidden) return;
    try {
      const res = await android.requestCarCommandAsync(JSON.stringify({ cmd: 'climate_get_state' }), 2000);
      if (res && res.success) {
        applyAndRender({
          fanSpeed: res.fanSpeed,
          heat: {
            rulHeat: res.steeringWheelHeat,
            lobHeat: res.frontGlassHeat,
            zadHeat: res.rearDefrost,
            recirculation: res.recirculation
          },
          climate: { recirculation: res.recirculation }
        });
      }
    } catch (e) {}
  }

  function startPolling() { stopPolling(); climatePollTimer = setInterval(pollClimateState, 5000); }
  function stopPolling() { if (climatePollTimer) { clearInterval(climatePollTimer); climatePollTimer = null; } }

  function startOptimisticSweep() {
    if (!optimisticSweepTimer) optimisticSweepTimer = setInterval(sweepOptimistic, 1500);
  }
  function stopOptimisticSweep() {
    if (optimisticSweepTimer) { clearInterval(optimisticSweepTimer); optimisticSweepTimer = null; }
  }

  function applyAndRender(raw) {
    const changed = applyCarData(raw, bootProtection);
    if (changed) Render.updateAll();
  }

  function sendFanSpeed(value) {
    if (window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
      window.androidApi.requestCarCommandAsync(getToken(), 'fan_' + Date.now(), JSON.stringify({ cmd: 'climate_set_fan_speed', value: value }));
    } else if (typeof android.runEnum === 'function') {
      android.runEnum(`fan_speed_${value}`);
    }
  }

  function renderAllFanSlots() {
    document.querySelectorAll('.climate_slot').forEach(slot => {
      const id = slot.dataset.climateSlot;
      const saved = storage.load(`climate_slot_${id}`);
      if (saved === 'fan_speed' || saved === 'fan_speed_down') {
        Render.renderSlot(slot);
      }
    });
  }

  function onSlotClick(slotElement) {
    const slotId = slotElement.dataset.climateSlot;
    const saved = storage.load(`climate_slot_${slotId}`);
    const commands = Render.getCommands();

    if (!saved) {
      openPicker(slotElement);
      return;
    }
    const c = commands.find(x => x.cmd === saved);
    if (!c) return;

    if (saved === 'trunk') {
      const trunkOpen = Render.getTrunk();
      const cmd = trunkOpen ? 'close_trunk' : 'open_trunk';
      if (window.androidApi && typeof window.androidApi.requestCarCommandAsync === 'function') {
        window.androidApi.requestCarCommandAsync(getToken(), 'trunk_' + Date.now(), JSON.stringify({ cmd }));
      } else if (typeof android.runEnum === 'function') {
        android.runEnum(cmd);
      }
      const newTrunk = !trunkOpen;
      Render.setTrunk(newTrunk);
      storage.save('climateTrunkOpen', newTrunk);
      Render.renderSlot(slotElement);
      if (typeof showToast === 'function') showToast(newTrunk ? 'Багажник открыт' : 'Багажник закрыт');
      return;
    }

    if (saved.startsWith('voditel_seat_')) {
      android.runEnum(saved);
      if (typeof showToast === 'function') showToast(c.label.replace(/\\n/g, ' '));
      return;
    }

    // === ВЕНТИЛЯТОР + (только увеличение, до FAN_MAX) ===
    if (saved === 'fan_speed') {
      const cur = climateState['fan_speed'] || 0;
      // Если текущее 0 — считаем «пока не включено», поднимаем до 1
      const base = cur < FAN_MIN ? FAN_MIN - 1 : cur;
      if (base >= FAN_MAX) {
        // Уже на максимуме — не отправляем команду, показываем подсказку
        if (typeof showToast === 'function') showToast('Вентилятор уже на максимуме', 1500);
        return;
      }
      const next = Math.min(FAN_MAX, base + 1);
      climateState['fan_speed'] = next;
      optimisticLevels['fan_speed'] = { level: next, until: Date.now() + OPTIMISTIC_MS };
      renderAllFanSlots();
      sendFanSpeed(next);
      return;
    }

    // === ВЕНТИЛЯТОР − (только уменьшение, до FAN_MIN) ===
    if (saved === 'fan_speed_down') {
      const cur = climateState['fan_speed'] || 0;
      // Если 0/пусто — считаем, что уже минимум
      const base = cur < FAN_MIN ? FAN_MIN : cur;
      if (base <= FAN_MIN) {
        if (typeof showToast === 'function') showToast('Вентилятор уже на минимуме', 1500);
        return;
      }
      const next = Math.max(FAN_MIN, base - 1);
      climateState['fan_speed'] = next;
      optimisticLevels['fan_speed'] = { level: next, until: Date.now() + OPTIMISTIC_MS };
      renderAllFanSlots();
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
    Render.renderSlot(slotElement);

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

  function openPicker(slotElement) {
    Render.openPicker(slotElement, (chosenCmd) => {
      const slot = Render.getCurrentPickerSlot();
      storage.save(`climate_slot_${slot}`, chosenCmd);
      climateState[chosenCmd] = 0;
      Render.updateAll();
    });
  }

  function reinitSlots() {
    setTimeout(() => {
      Render.initSlots(onSlotClick, openPicker);
      Render.updateAll();
    }, 50);
  }

  function updateIconColors() {
    Render.updateIconColors();
  }

  function init() {
    loadCommands();
    Render.init(!!storage.load('climateTrunkOpen'));

    Render.initSlots(onSlotClick, openPicker);
    Render.updateIconColors();
    startOptimisticSweep();
    startPolling();

    if (modules.carData) modules.carData.subscribe(applyAndRender);
    setTimeout(() => { bootProtection = false; }, 10000);

    document.getElementById('climate-picker-close')?.addEventListener('click', () => {
      document.getElementById('climate-picker')?.classList.remove('open');
    });

    document.getElementById('climateOffAll')?.addEventListener('click', () => {
      let anyOff = false;
      const commands = Render.getCommands();
      document.querySelectorAll('.climate_slot').forEach(slot => {
        const id = slot.dataset.climateSlot;
        const saved = storage.load(`climate_slot_${id}`);
        if (!saved || saved === 'trunk' || saved === 'fan_speed' || saved === 'fan_speed_down') return;
        const c = commands.find(x => x.cmd === saved);
        if (c && (climateState[saved] || 0) > 0) {
          android.runEnum(getOff(c));
          climateState[saved] = 0;
          Render.renderSlot(slot);
          anyOff = true;
        }
      });
      if (anyOff && typeof showToast === 'function') showToast('Все функции выключены');
    });
  }

  function destroy() {
    stopOptimisticSweep();
    stopPolling();
  }

  return {
    init,
    updateState: applyAndRender,
    destroy,
    reinitSlots,
    updateIconColors,
    getClimateColorInfo: modules.climateIcons.getClimateColorInfo
  };
})();