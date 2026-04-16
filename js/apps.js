/**********************************************
 * Модуль: Приложения (слоты 2x2)
 **********************************************/

modules.apps = (function() {
  function init() {
    const slots = document.querySelectorAll(".app_slot"), picker = document.getElementById("app_picker"),
          grid = document.getElementById("app-picker-grid"), close = document.getElementById("app-picker-close");
    slots.forEach(s=>{ const saved=storage.load("app_slot_"+s.dataset.slot); if(saved) s.innerHTML=`<img src="data:image/png;base64,${saved.icon}">`; });
    let cur=null;
    function open(slot){ cur=slot.dataset.slot; grid.innerHTML='<div style="grid-column:1/-1;padding:20px;">Загрузка...</div>'; picker.classList.add('open');
      setTimeout(()=>{ grid.innerHTML='';
        try{ JSON.parse(android.getUserApps()).forEach(app=>{ const d=document.createElement('div'); d.className='picker-item'; d.innerHTML=`<img src="data:image/png;base64,${app.icon}"><span>${app.name}</span>`;
          d.onclick=()=>{ storage.save("app_slot_"+cur,{package:app.package,name:app.name,icon:app.icon}); document.querySelector(`.app_slot[data-slot="${cur}"]`).innerHTML=`<img src="data:image/png;base64,${app.icon}">`; picker.classList.remove('open'); };
          grid.appendChild(d); }); }catch{ grid.innerHTML='<div style="padding:20px;">Ошибка</div>'; } },10);
    }
    close?.addEventListener('click',()=>picker.classList.remove('open'));
    picker.addEventListener('click',e=>{ if(e.target===picker) picker.classList.remove('open'); });
    slots.forEach(s=>{ makeLongPressable(s,()=>open(s),{delay:700});
      s.addEventListener('click',e=>{ if(e.detail===0) return; const app=storage.load("app_slot_"+s.dataset.slot); if(!app) open(s); else android.runApp(app.package); });
    });
  }
  return { init };
})();