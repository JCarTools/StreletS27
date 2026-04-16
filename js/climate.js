/**********************************************
 * Модуль: Климат (2x3, 6 слотов)
 **********************************************/

modules.climate = (function() {
  let climateCommands = [], climateState = {};
  const fallback = [
    { cmd: "heat_seat_l", label: "Подогрев\nводителя", max:3, icon:"icons/Seat heated_left.svg" },
    { cmd: "heat_seat_r", label: "Подогрев\nпассажира", max:3, icon:"icons/Seat heated_right.svg" },
    { cmd: "heat_windshield_on", label: "Подогрев\nлобового", max:1, icon:"icons/Windshield defroster.svg", off: "heat_windshield_off" },
    { cmd: "heat_rearwindow_on", label: "Подогрев\nзаднего", max:1, icon:"icons/Rare windshield defroster.svg", off: "heat_rearwindow_off" },
    { cmd: "vent_seat_l", label: "Вентиляция\nводителя", max:3, icon:"icons/Seat vent_left.svg" },
    { cmd: "vent_seat_r", label: "Вентиляция\nпассажира", max:3, icon:"icons/Seat vent_right.svg" },
    { cmd: "heat_wheel_on", label: "Подогрев\nруля", max:1, icon:"icons/Steering wheel heat.svg", off: "heat_wheel_off" },
    { cmd: "heat_zad_seat_l", label: "Подогрев\nзад. лево", max:3, icon:"icons/Seat heated_left.svg" },
    { cmd: "heat_zad_seat_r", label: "Подогрев\nзад. право", max:3, icon:"icons/Seat heated_right.svg", off:"heat_zad_seat_r_off" },
    { cmd: "voditel_seat_1", label: "Память\nводитель 1", max:1, icon:"icons/Driver.svg" },
    { cmd: "voditel_seat_2", label: "Память\nводитель 2", max:1, icon:"icons/Driver.svg" },
    { cmd: "voditel_seat_3", label: "Память\nводитель 3", max:1, icon:"icons/Driver.svg" }
  ];
  function formatLabel(cmd){ return cmd; }
  async function loadCommands(){
    try{
      const list = JSON.parse(android.getRunEnum());
      const filtered = list.filter(c=>c.startsWith('heat_')||c.startsWith('vent_')||c.startsWith('voditel_'));
      if(!filtered.length) throw new Error();
      climateCommands = filtered.map(c=>{
        const base = { cmd:c, label:formatLabel(c), max:c.includes('seat')?3:1 };
        if (c === 'heat_zad_seat_r') base.off = 'heat_zad_seat_r_off';
        if (c === 'heat_wheel_on') base.off = 'heat_wheel_off';
        if (c === 'heat_windshield_on') base.off = 'heat_windshield_off';
        if (c === 'heat_rearwindow_on') base.off = 'heat_rearwindow_off';
        return base;
      });
      for(let c of climateCommands){ try{ const p=android.getRunEnumPic(c.cmd); c.icon=p?`data:image/png;base64,${p}`:'icons/Default.svg'; }catch{ c.icon='icons/Default.svg'; } }
    }catch{ climateCommands = fallback.map(c=>({...c})); }
  }
  function getOff(cmd){ return cmd.off || `${cmd.cmd}_0`; }
  function renderSlot(s){
    const id = s.dataset.climateSlot, saved = storage.load(`climate_slot_${id}`);
    s.innerHTML = "";
    if(!saved){ s.innerHTML='<span style="font-size:1.5rem;opacity:0.5;">+</span>'; s.classList.remove('active'); return; }
    const c = climateCommands.find(x=>x.cmd===saved); if(!c) return;
    const lvl = climateState[saved]||0, max=c.max||1;
    const dots = Array.from({length:max},(_,i)=>`<span class="climate-dot${i<lvl?' on':''}"></span>`).join('');
    s.innerHTML = `<img src="${c.icon}"><div class="climate-label">${c.label.replace(/\\n/g,'<br>')}</div><div class="climate-dots">${dots}</div>`;
    s.classList.toggle('active', lvl>0);
  }
  function updateAll(){ document.querySelectorAll('.climate_slot').forEach(renderSlot); }
  function turnOffAll(){
    for(let i=1;i<=6;i++){ 
      const cmd=storage.load(`climate_slot_${i}`); if(!cmd) continue;
      const c=climateCommands.find(x=>x.cmd===cmd); if(c){ android.runEnum(getOff(c)); climateState[cmd]=0; }
    }
    updateAll();
  }
  function initPicker(){
    const picker=document.getElementById('climate-picker'), grid=document.getElementById('climate-picker-grid'), close=document.getElementById('climate-picker-close');
    let cur=null;
    function open(id){ cur=id; grid.innerHTML='';
      if(!climateCommands.length){ grid.innerHTML='<div style="grid-column:1/-1;padding:20px;">Нет функций</div>'; picker.classList.add('open'); return; }
      climateCommands.forEach(cmd=>{ const d=document.createElement('div'); d.className='picker-item'; d.innerHTML=`<img src="${cmd.icon}"><span>${cmd.label.replace(/\\n/g,' ')}</span>`;
        d.onclick=()=>{ storage.save(`climate_slot_${cur}`,cmd.cmd); climateState[cmd.cmd]=0; updateAll(); picker.classList.remove('open'); android.requestClimateStateForCommand(cmd.cmd); };
        grid.appendChild(d); });
      picker.classList.add('open');
    }
    close?.addEventListener('click',()=>picker.classList.remove('open'));
    picker.addEventListener('click',e=>{ if(e.target===picker) picker.classList.remove('open'); });
    document.querySelectorAll('.climate_slot').forEach(s=>{
      const id=s.dataset.climateSlot;
      makeLongPressable(s,()=>open(id),{delay:700, preventDefaultOnStart: false});
      s.addEventListener('click',e=>{
        const saved=storage.load(`climate_slot_${id}`); if(!saved){ open(id); return; }
        const c=climateCommands.find(x=>x.cmd===saved); if(!c) return;
        const max=c.max||1, curLvl=climateState[saved]||0, next=(curLvl+1)%(max+1);
        climateState[saved]=next;
        const cmd = next===0 ? getOff(c) : (max>1?`${saved}_${next}`:saved);
        android.runEnum(cmd); renderSlot(s);
      });
    });
  }
  async function init(){ await loadCommands(); initPicker(); updateAll(); document.getElementById('climateOffAll')?.addEventListener('click',turnOffAll); }
  return { init, updateState: function(data){ updateAll(); } };
})();