/**********************************************
 * Модуль: Климат (2x3, 6 слотов)
 * Исправлено: корректное выключение для всех устройств
 **********************************************/

modules.climate = (function() {
  let climateCommands = [], climateState = {};
  const fallback = [
    { cmd: "heat_seat_l", label: "Подогрев\nводителя", max:3, icon:"icons/Seat heated_left.svg" },
    { cmd: "heat_seat_r", label: "Подогрев\nпассажира", max:3, icon:"icons/Seat heated_right.svg" },
    { cmd: "heat_zad_seat_l", label: "Подогрев\nзад. лево", max:3, icon:"icons/Seat heated_left.svg" },
    { cmd: "heat_zad_seat_r", label: "Подогрев\nзад. право", max:3, icon:"icons/Seat heated_right.svg", off: "heat_zad_seat_r_off" },
    { cmd: "heat_wheel_on", label: "Подогрев\nруля", max:1, icon:"icons/Steering wheel heat.svg", off: "heat_wheel_off" },
    { cmd: "heat_windshield_on", label: "Подогрев\nлобового", max:1, icon:"icons/Windshield defroster.svg", off: "heat_windshield_off" },
    { cmd: "heat_rearwindow_on", label: "Подогрев\nзаднего", max:1, icon:"icons/Rare windshield defroster.svg", off: "heat_rearwindow_off" },
    { cmd: "vent_seat_l", label: "Вентиляция\nводителя", max:3, icon:"icons/Seat vent_left.svg" },
    { cmd: "vent_seat_r", label: "Вентиляция\nпассажира", max:3, icon:"icons/Seat vent_right.svg" },
    { cmd: "voditel_seat_1", label: "Память\nводитель 1", max:1, icon:"icons/Driver.svg" },
    { cmd: "voditel_seat_2", label: "Память\nводитель 2", max:1, icon:"icons/Driver.svg" },
    { cmd: "voditel_seat_3", label: "Память\nводитель 3", max:1, icon:"icons/Driver.svg" },
    { cmd: "Recirculation_On", label: "Рециркуляция", max:1, icon:"icons/Recirculation.svg", off: "Recirculation_Off" }
  ];
  
  let isInitialized = false;
  let currentPickerSlot = null;
  
  function formatLabel(cmd){ return cmd; }
  
  async function loadCommands(){
    try{
      const list = JSON.parse(android.getRunEnum());
      const filtered = list.filter(c=>c.startsWith('heat_')||c.startsWith('vent_')||c.startsWith('voditel_')||c==='Recirculation_On'||c==='Recirculation_Off');
      if(!filtered.length) throw new Error();
      climateCommands = [];
      for(const cmd of filtered){
        if(cmd === 'Recirculation_Off') continue;
        const base = { 
          cmd, 
          label: formatLabel(cmd), 
          max: (cmd.includes('seat') || cmd.includes('vent')) ? 3 : 1,
          off: null
        };
        // Устанавливаем off для команд, у которых он особый
        if (cmd === 'heat_wheel_on') base.off = 'heat_wheel_off';
        if (cmd === 'heat_windshield_on') base.off = 'heat_windshield_off';
        if (cmd === 'heat_rearwindow_on') base.off = 'heat_rearwindow_off';
        if (cmd === 'Recirculation_On') base.off = 'Recirculation_Off';
        if (cmd === 'heat_zad_seat_r') base.off = 'heat_zad_seat_r_off';  // <-- важно!
        try{ 
          const p=android.getRunEnumPic(cmd); 
          base.icon=p?`data:image/png;base64,${p}`:'icons/Default.svg'; 
        }catch{ 
          base.icon='icons/Default.svg'; 
        }
        climateCommands.push(base);
      }
    }catch{ 
      climateCommands = fallback.map(c=>({...c})); 
    }
  }
  
  function getOff(cmd){
    if(cmd.off) return cmd.off;
    // Для команд с max=3 используем cmd_0
    return `${cmd.cmd}_0`;
  }
  
  function applyIconColor(imgElement) {
    if (!imgElement) return;
    const iconColor = storage.load('setting_climateIconColor');
    imgElement.style.filter = (iconColor === 'Черный') ? 'brightness(0) invert(0)' : 'brightness(0) invert(1)';
    imgElement.style.opacity = (iconColor === 'Черный') ? '0.85' : '0.92';
  }
  
  function renderSlot(s){
    const id = s.dataset.climateSlot, saved = storage.load(`climate_slot_${id}`);
    s.innerHTML = "";
    if(!saved){ 
      s.innerHTML='<span style="font-size:1.5rem;opacity:0.5;">+</span>'; 
      s.classList.remove('active'); 
      return; 
    }
    const c = climateCommands.find(x=>x.cmd===saved); 
    if(!c) return;
    const lvl = climateState[saved]||0, max=c.max||1;
    const dots = Array.from({length:max},(_,i)=>`<span class="climate-dot${i<lvl?' on':''}"></span>`).join('');
    s.innerHTML = `<img src="${c.icon}"><div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
    s.classList.toggle('active', lvl>0);
    const img = s.querySelector('img');
    if (img) applyIconColor(img);
  }
  
  function updateAll(){ 
    document.querySelectorAll('.climate_slot').forEach(renderSlot); 
  }
  
  function turnOffAll(){
    let anyOffSent = false;
    const slots = document.querySelectorAll('.climate_slot');
    for(let i = 0; i < slots.length; i++){ 
      const slot = slots[i];
      const slotId = slot.dataset.climateSlot;
      const cmd = storage.load(`climate_slot_${slotId}`); 
      if(!cmd) continue;
      const c = climateCommands.find(x=>x.cmd===cmd); 
      if(!c) continue;
      const currentLevel = climateState[cmd] || 0;
      if(currentLevel === 0) continue;
      const offCmd = getOff(c);
      if (typeof android.runEnum === 'function') {
        android.runEnum(offCmd);
        anyOffSent = true;
      }
      climateState[cmd] = 0;
    }
    updateAll();
    if (anyOffSent) {
      if (typeof showToast === 'function') showToast('Все активные функции выключены', 2000);
    } else {
      if (typeof showToast === 'function') showToast('Нет активных функций', 1500);
    }
  }
  
  function openPicker(slotElement) {
    const slotId = slotElement.dataset.climateSlot;
    if (!slotId) return;
    currentPickerSlot = slotId;
    const picker = document.getElementById('climate-picker');
    const grid = document.getElementById('climate-picker-grid');
    if (!picker || !grid) return;
    grid.innerHTML = '';
    if (!climateCommands.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;">Нет функций</div>';
      picker.classList.add('open');
      return;
    }
    climateCommands.forEach(cmd => {
      const d = document.createElement('div');
      d.className = 'picker-item';
      d.innerHTML = `<img src="${cmd.icon}"><span>${cmd.label.replace(/\\n/g,' ')}</span>`;
      d.onclick = () => {
        storage.save(`climate_slot_${currentPickerSlot}`, cmd.cmd);
        climateState[cmd.cmd] = 0;
        updateAll();
        picker.classList.remove('open');
        currentPickerSlot = null;
        if (typeof android.requestClimateStateForCommand === 'function') {
          android.requestClimateStateForCommand(cmd.cmd);
        }
      };
      grid.appendChild(d);
    });
    picker.classList.add('open');
  }
  
  function onSlotClick(slotElement, event) {
    const slotId = slotElement.dataset.climateSlot;
    if (!slotId) return;
    if (slotElement.getAttribute('data-long-pressed') === 'true') {
      slotElement.removeAttribute('data-long-pressed');
      return;
    }
    const saved = storage.load(`climate_slot_${slotId}`);
    if (!saved) {
      openPicker(slotElement);
      return;
    }
    const c = climateCommands.find(x => x.cmd === saved);
    if (!c) return;
    const max = c.max || 1;
    const curLvl = climateState[saved] || 0;
    const next = (curLvl + 1) % (max + 1);
    climateState[saved] = next;
    
    let cmdToSend;
    if (next === 0) {
      cmdToSend = getOff(c);
    } else {
      if (max === 1) {
        cmdToSend = saved; // например heat_wheel_on
      } else {
        cmdToSend = `${saved}_${next}`;
      }
    }
    if (typeof android.runEnum === 'function') android.runEnum(cmdToSend);
    renderSlot(slotElement);
  }
  
  function initSlots() {
    const slots = document.querySelectorAll('.climate_slot');
    slots.forEach(slot => {
      const oldClickHandler = slot._clickHandler;
      const oldLongPressHandler = slot._longPressHandler;
      if (oldClickHandler) slot.removeEventListener('click', oldClickHandler);
      if (oldLongPressHandler) slot.removeEventListener('contextmenu', oldLongPressHandler);
      const clickHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onSlotClick(slot, e);
      };
      const longPressHandler = () => openPicker(slot);
      slot._clickHandler = clickHandler;
      slot._longPressHandler = longPressHandler;
      slot.addEventListener('click', clickHandler);
      makeLongPressable(slot, longPressHandler, { delay: 700, preventDefaultOnStart: false });
    });
  }
  
  function initPicker() {
    const picker = document.getElementById('climate-picker');
    const close = document.getElementById('climate-picker-close');
    if (close) {
      const newClose = close.cloneNode(true);
      close.parentNode.replaceChild(newClose, close);
      newClose.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.classList.remove('open');
        currentPickerSlot = null;
      });
    }
    if (picker) {
      picker.addEventListener('click', (e) => { 
        if (e.target === picker) {
          picker.classList.remove('open');
          currentPickerSlot = null;
        }
      });
    }
  }
  
  function updateIconColors() {
    const allImages = document.querySelectorAll('.climate_slot img');
    allImages.forEach(img => applyIconColor(img));
  }
  
  function updateState(data) {
    try {
      if (typeof data === 'string') data = JSON.parse(data);
      for (const cmd of climateCommands) {
        const value = data[cmd.cmd];
        if (value !== undefined) {
          climateState[cmd.cmd] = value;
        }
      }
      updateAll();
    } catch (e) {
      console.error('[Climate] Ошибка обновления состояния:', e);
    }
  }
  
  function reinitSlots() {
    setTimeout(() => {
      initSlots();
      updateAll();
      updateIconColors();
      const offButton = document.getElementById('climateOffAll');
      const slotCount = document.querySelectorAll('.climate_slot').length;
      if (offButton) {
        if (slotCount === 4) offButton.style.left = '50%';
        else if (slotCount === 6) offButton.style.left = '33.33%';
        else if (slotCount === 8) offButton.style.left = '25%';
      }
    }, 50);
  }
  
  async function init(){ 
    if (isInitialized) return;
    isInitialized = true;
    await loadCommands(); 
    initPicker(); 
    initSlots();
    updateAll(); 
    const offAllBtn = document.getElementById('climateOffAll');
    if (offAllBtn) {
      const newOffBtn = offAllBtn.cloneNode(true);
      offAllBtn.parentNode.replaceChild(newOffBtn, offAllBtn);
      newOffBtn.addEventListener('click', turnOffAll);
    }
    setTimeout(() => updateIconColors(), 100);
  }
  
  return { 
    init, 
    updateState,
    updateIconColors,
    reinitSlots,
    getCommandBySlot: function(slotId) {
      const saved = storage.load(`climate_slot_${slotId}`);
      if (!saved) return null;
      return climateCommands.find(x => x.cmd === saved);
    },
    getState: function() { return climateState; },
    setState: function(cmd, level) { climateState[cmd] = level; },
    getOffCommand: function(c) { return getOff(c); },
    renderSlotElement: function(slot) { renderSlot(slot); },
    turnOffAll,
    openPicker
  };
})();