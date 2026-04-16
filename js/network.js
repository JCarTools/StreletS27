/**********************************************
 * Модуль: Перетаскиваемая кнопка сети + проверка интернета
 **********************************************/

modules.draggableNetwork = (function() {
  const btn = document.getElementById('btnNetwork');
  if (!btn) return { init(){} };
  let isDragging = false, startX, startY, startLeft, startTop, rafPending = false, newLeft, newTop;
  const saved = storage.load('networkPos');
  if (saved) { btn.style.left = saved.left+'px'; btn.style.top = saved.top+'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto'; }
  function getPos() { const r = btn.getBoundingClientRect(); return { left: r.left, top: r.top }; }
  function onStart(e) {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    const p = getPos(); startLeft = p.left; startTop = p.top;
    isDragging = true; btn.style.cursor = 'grabbing'; btn.style.transition = 'none';
  }
  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    newLeft = Math.max(0, Math.min(startLeft + t.clientX - startX, window.innerWidth - btn.offsetWidth));
    newTop = Math.max(0, Math.min(startTop + t.clientY - startY, window.innerHeight - btn.offsetHeight));
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        btn.style.left = newLeft+'px'; btn.style.top = newTop+'px';
        btn.style.right = 'auto'; btn.style.bottom = 'auto';
        rafPending = false;
      });
    }
  }
  function onEnd() {
    if (isDragging) {
      isDragging = false; btn.style.cursor = 'grab'; btn.style.transition = '';
      storage.save('networkPos', { left: parseFloat(btn.style.left), top: parseFloat(btn.style.top) });
    }
  }
  function init() {
    btn.addEventListener('touchstart', onStart, { passive: false });
    btn.addEventListener('touchmove', onMove, { passive: false });
    btn.addEventListener('touchend', onEnd); btn.addEventListener('touchcancel', onEnd);
    btn.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
  }
  return { init };
})();

modules.network = (function() {
  let online = false, checking = false, checkInterval = null;
  const icon = document.getElementById('networkIconContainer'), btn = document.getElementById('btnNetwork');
  function setStatus(ok) {
    online = ok;
    if (ok) {
      icon.innerHTML = '<svg class="network-svg" viewBox="0 0 24 24"><path d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4.95-5.95c-1.6-1.6-3.1-2.3-4.95-2.3s-3.35.7-4.95 2.3l1.4 1.4c1.3-1.3 2.5-1.7 3.55-1.7s2.25.4 3.55 1.7l1.4-1.4zm3.15-3.95C17.8 5.8 15.1 4.75 12 4.75S6.2 5.8 3.9 8.1l1.4 1.4c2-2 4.3-2.75 6.7-2.75s4.7.75 6.7 2.75l1.4-1.4zm3.1-3.9C19.9.9 16.1-.5 12-.5S4.1.9.8 4.2l1.4 1.4c3-3 6.3-4.1 9.8-4.1s6.8 1.1 9.8 4.1l1.4-1.4z" fill="#4CAF50"/></svg>';
      btn.title = 'Есть интернет';
    } else {
      icon.innerHTML = '<svg class="network-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#F44336" stroke-width="1.5" fill="none"/><path d="M8 8l8 8M16 8l-8 8" stroke="#F44336" stroke-width="1.5"/></svg>';
      btn.title = 'Нет интернета';
    }
  }
  function check() {
    if (checking) return;
    checking = true;
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; setStatus(false); checking = false; }, 5000);
    img.onload = () => { clearTimeout(t); setStatus(true); checking = false; };
    img.onerror = () => { clearTimeout(t); setStatus(false); checking = false; };
    img.src = 'https://yandex.ru/favicon.ico?_=' + Date.now();
  }
  function init() {
    check();
    btn.addEventListener('click', () => { if (!checking) check(); });
    window.addEventListener('online', () => { setStatus(true); check(); });
    window.addEventListener('offline', () => setStatus(false));
    checkInterval = setInterval(check, 120000);
  }
  return { init };
})();