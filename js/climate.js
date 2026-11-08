/**********************************************
 * Модуль: Климат — точка входа
 * Часть 4 из 4.
 * [FIX] sendFanSpeed: убран устаревший прямой вызов android.runEnum('fan_speed_X').
 *       Используется нормализованный android.requestCarCommandAsync из core.js.
 * [FIX] Вентилятор без зацикливания: «+» до 10, «−» до 1.
 * [FIX] fan_speed и fan_speed_down синхронизированы через общий climateState['fan_speed'].
 * [FIX] onSlotClick: обработка ошибки отправки команды вентилятора с откатом UI.
 * [FIX 6.3] Убраны прямые вызовы window.androidApi.requestCarCommandAsync(getToken(), ...).
 *       Все команды климата идут через android.requestCarCommandAsync(json, timeout)
 *       из core.js (2-аргументная сигнатура). android.runEnum остаётся только для
 *       enum-команд (память сидений, fan_speed_X, off-команды слотов).
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
  const COMMAND_TIMEOUT_MS = 3000;

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
      const res = await android.requestCarCommandAsync({ cmd: 'climate_get_state' }, 2000);
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

  /**
   * [FIX] Отправка скорости вентилятора через нормализованный API core.js.
   * Никаких прямых android.runEnum('fan_speed_X') — только requestCarCommandAsync.
   * Возвращает Promise<boolean> — успех отправки.
   */
  function sendFanSpeed(value) {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') {
      return Promise.resolve(false);
    }
    return android.requestCarCommandAsync(
      { cmd: 'climate_set_fan_speed', value: value },
      COMMAND_TIMEOUT_MS
    ).then(res => {
      return !!(res && (res.success === true || res.status === 'ok'));
    }).catch(() => false);
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

  // [FIX 6.3] Единая отправка команды-действия (обогрев/рециркуляция и т.д.)
  // через android.requestCarCommandAsync (2-аргументная сигнатура из core.js).
  function sendActionCommand(apiCmd, value) {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') {
      return Promise.resolve(false);
    }
    return android.requestCarCommandAsync(
      { cmd: apiCmd, value: value },
      COMMAND_TIMEOUT_MS
    ).then(res => !!(res && (res.success === true || res.status === 'ok')))
     .catch(() => false);
  }

  // [FIX 6.3] Багажник — тоже через requestCarCommandAsync, без window.androidApi.
  function sendTrunkCommand(trunkOpen) {
    if (typeof android === 'undefined' || typeof android.requestCarCommandAsync !== 'function') {
      return Promise.resolve(false);
    }
    const cmd = trunkOpen ? 'close_trunk' : 'open_trunk';
    return android.requestCarCommandAsync({ cmd }, COMMAND_TIMEOUT_MS)
      .then(res => !!(res && (res.success === true || res.status === 'ok')))
      .catch(() => false);
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
      const newTrunk = !trunkOpen;

      // [FIX 6.3] Оптимистично обновляем UI, затем отправляем через единый API.
      Render.setTrunk(newTrunk);
      storage.save('climateTrunkOpen', newTrunk);
      Render.renderSlot(slotElement);
      if (typeof showToast === 'function') showToast(newTrunk ? 'Багажник открыт' : 'Багажник закрыт');

      sendTrunkCommand(trunkOpen).then(ok => {
        if (!ok) {
          // Откат UI при ошибке.
          Render.setTrunk(trunkOpen);
          storage.save('climateTrunkOpen', trunkOpen);
          Render.renderSlot(slotElement);
          if (typeof showToast === 'function') showToast('Не удалось изменить состояние багажника', 2000);
        }
      });
      return;
    }

    if (saved.startsWith('voditel_seat_')) {
      if (typeof android.runEnum === 'function') android.runEnum(saved);
      if (typeof showToast === 'function') showToast(c.label.replace(/\\n/g, ' '));
      return;
    }

    // === ВЕНТИЛЯТОР + (только увеличение, до FAN_MAX) ===
    if (saved === 'fan_speed') {
      const cur = climateState['fan_speed'] || 0;
      const base = cur < FAN_MIN ? FAN_MIN - 1 : cur;
      if (base >= FAN_MAX) {
        if (typeof showToast === 'function') showToast('Вентилятор уже на максимуме', 1500);
        return;
      }
      const prev = climateState['fan_speed'];
      const next = Math.min(FAN_MAX, base + 1);
      climateState['fan_speed'] = next;
      optimisticLevels['fan_speed'] = { level: next, until: Date.now() + OPTIMISTIC_MS };
      renderAllFanSlots();

      sendFanSpeed(next).then(ok => {
        if (!ok) {
          climateState['fan_speed'] = prev || 0;
          delete optimisticLevels['fan_speed'];
          renderAllFanSlots();
          if (typeof showToast === 'function') showToast('Не удалось изменить скорость вентилятора', 2000);
        }
      });
      return;
    }

    // === ВЕНТИЛЯТОР − (только уменьшение, до FAN_MIN) ===
    if (saved === 'fan_speed_down') {
      const cur = climateState['fan_speed'] || 0;
      const base = cur < FAN_MIN ? FAN_MIN : cur;
      if (base <= FAN_MIN) {
        if (typeof showToast === 'function') showToast('Вентилятор уже на минимуме', 1500);
        return;
      }
      const prev = climateState['fan_speed'];
      const next = Math.max(FAN_MIN, base - 1);
      climateState['fan_speed'] = next;
      optimisticLevels['fan_speed'] = { level: next, until: Date.now() + OPTIMISTIC_MS };
      renderAllFanSlots();

      sendFanSpeed(next).then(ok => {
        if (!ok) {
          climateState['fan_speed'] = prev || 0;
          delete optimisticLevels['fan_speed'];
          renderAllFanSlots();
          if (typeof showToast === 'function') showToast('Не удалось изменить скорость вентилятора', 2000);
        }
      });
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

    // [FIX 6.3] Все команды-действия (обогрев/рециркуляция) идут через
    // android.requestCarCommandAsync, без window.androidApi и getToken().
    if (ACTION_STATE_COMMANDS[saved]) {
      const m = ACTION_STATE_COMMANDS[saved];
      sendActionCommand(m.apiCmd, next > 0);
    } else if (saved === 'Recirculation_On') {
      sendActionCommand('climate_set_recirculation', next > 0);
    } else {
      // Enum-команда (heat_seat_l_0, fan_speed_X, off-команды слотов).
      let cmd;
      if (next === 0) cmd = getOff(c);
      else if (c.max === 1) cmd = saved;
      else cmd = `${saved}_${next}`;
      if (typeof android.runEnum === 'function') android.runEnum(cmd);
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
          if (typeof android.runEnum === 'function') android.runEnum(getOff(c));
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