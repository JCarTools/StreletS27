/**********************************************
 * Модуль: Климат — отрисовка
 * Часть 3 из 4.
 * [FIX] Убран бейдж "+"/"−" с иконки вентилятора.
 *       Знаки остаются только в подписи ("Вентилятор +" / "Вентилятор −").
 **********************************************/

modules.climateRender = (function() {
  const Icons = modules.climateIcons;
  const State = modules.climateState;
  const { getClimateColorInfo, getIconColorHex, getIconSvg } = Icons;
  const { climateState, OPTIMISTIC_MS } = State;

  let climateCommands = [];
  let currentPickerSlot = null;
  let trunkOpen = false;

  function init(trunk) { trunkOpen = !!trunk; }
  function setCommands(cmds) { climateCommands = cmds; }
  function setCurrentPickerSlot(slot) { currentPickerSlot = slot; }
  function getCurrentPickerSlot() { return currentPickerSlot; }
  function setTrunk(open) { trunkOpen = open; }
  function getTrunk() { return trunkOpen; }
  function getCommands() { return climateCommands; }

  function getFanLevel() {
    return climateState['fan_speed'] || 0;
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
    else if (saved === 'fan_speed' || saved === 'fan_speed_down') lvl = getFanLevel();
    else lvl = climateState[saved] || 0;

    const iconColor = getIconColorHex();

    if (saved === 'fan_speed') {
      const displayVal = lvl === 0 ? '—' : lvl;
      const isActive = lvl > 0;
      s.innerHTML = `
        <div class="climate-svg-icon" style="width: 2.2rem; height: 2.2rem; margin-bottom: 0.3rem;">${getIconSvg('fan', iconColor)}</div>
        <div class="climate-label">${c.label}</div>
        <div class="climate-fan-value" style="font-size: 0.8rem; font-weight: 700; line-height: 1; color: ${iconColor}; opacity: ${lvl > 0 ? 0.95 : 0.45}; font-variant-numeric: tabular-nums; margin-top: 0.2rem; padding: 0; position: relative;">${displayVal}</div>
      `;
      s.classList.toggle('active', isActive);
      return;
    }

    if (saved === 'fan_speed_down') {
      const displayVal = lvl === 0 ? '—' : lvl;
      const isActive = lvl > 0;
      s.innerHTML = `
        <div class="climate-svg-icon" style="width: 2.2rem; height: 2.2rem; margin-bottom: 0.3rem;">${getIconSvg('fan_down', iconColor)}</div>
        <div class="climate-label">${c.label}</div>
        <div class="climate-fan-value" style="font-size: 0.8rem; font-weight: 700; line-height: 1; color: ${iconColor}; opacity: ${lvl > 0 ? 0.95 : 0.45}; font-variant-numeric: tabular-nums; margin-top: 0.2rem; padding: 0; position: relative;">${displayVal}</div>
      `;
      s.classList.toggle('active', isActive);
      return;
    }

    if (saved === 'trunk') {
      s.innerHTML = `<div class="climate-svg-icon" style="width:1.95rem; height:1.95rem; margin-bottom:0.25rem;">${getIconSvg('trunk', iconColor)}</div><div class="climate-label">${c.label}</div>`;
      s.classList.toggle('active', lvl > 0);
      return;
    }

    const dots = Array.from({ length: c.max }, (_, i) => `<span class="climate-dot${i < lvl ? ' on' : ''}"></span>`).join('');
    const iconHtml = `<div class="climate-svg-icon" style="width:1.95rem; height:1.95rem; margin-bottom:0.25rem;">${getIconSvg(c.icon, iconColor)}</div>`;

    s.innerHTML = `${iconHtml}<div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
    s.classList.toggle('active', lvl > 0);
  }

  function updateAll() {
    document.querySelectorAll('.climate_slot').forEach(renderSlot);
  }

  function updateIconColors() {
    const colorName = storage.load('setting_climateIconColor') || 'Белый';
    const info = getClimateColorInfo(colorName);

    document.documentElement.style.setProperty('--climate-icon-color', info.hex);
    document.documentElement.style.setProperty('--climate-temp-rgb', info.rgb);

    const isWhite = colorName === 'Белый';
    const isBlack = colorName === 'Черный' || colorName === 'Чёрный';
    document.body.classList.toggle('climate-icons-white', isWhite);
    document.body.classList.toggle('climate-icons-black', isBlack);

    document.querySelectorAll('.climate_slot').forEach(renderSlot);
  }

  function openPicker(slotElement, onSelect) {
    currentPickerSlot = slotElement.dataset.climateSlot;
    const picker = document.getElementById('climate-picker');
    const grid = document.getElementById('climate-picker-grid');
    if (!picker || !grid) return;
    grid.innerHTML = '';

    const iconColor = getIconColorHex();

    climateCommands.forEach(cmd => {
      const d = document.createElement('div');
      d.className = 'picker-item';

      const iconHtml = `<div class="climate-svg-icon" style="width: 2.2rem; height: 2.2rem; margin: 0 auto 0.5rem;">${getIconSvg(cmd.icon, iconColor)}</div>`;

      d.innerHTML = `${iconHtml}<span>${cmd.label.replace(/\\n/g,' ')}</span>`;
      d.onclick = () => {
        if (typeof onSelect === 'function') {
          onSelect(cmd.cmd);
        }
        picker.classList.remove('open');
      };
      grid.appendChild(d);
    });
    picker.classList.add('open');
  }

  function initSlots(onSlotClick, onLongPress) {
    document.querySelectorAll('.climate_slot').forEach(slot => {
      if (slot._clickHandler) slot.removeEventListener('click', slot._clickHandler);

      if (slot._lpHandlers && slot._lpHandlers.teardown) {
        slot._lpHandlers.teardown();
        slot._lpHandlers = null;
      }

      slot._clickHandler = (e) => { e.stopPropagation(); e.preventDefault(); onSlotClick(slot); };
      slot.addEventListener('click', slot._clickHandler);
      makeLongPressable(slot, () => onLongPress(slot), { delay: 700 });
    });
  }

  return {
    init,
    setCommands,
    getCommands,
    setCurrentPickerSlot,
    getCurrentPickerSlot,
    setTrunk,
    getTrunk,
    renderSlot,
    updateAll,
    updateIconColors,
    openPicker,
    initSlots
  };
})();