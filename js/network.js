/**********************************************
 * Модуль: Индикатор сети внутри виджета данных
 * [FIX] Баг #4: applyVisibilityFromSettings учитывает off-mode корректно.
 **********************************************/

modules.network = (function() {
  let online = false;
  let status = 0;
  let checking = false;
  let checkInterval = null;
  const btn = document.getElementById('btnNetwork');
  const icon = document.getElementById('networkIconContainer');
  const widget = document.getElementById('widgetPlaceholder');

  if (!btn || !icon) {
    return { init() {}, stopAutoCheck() {}, setVisible() {}, check() {}, forceStatus() {} };
  }

  const WHITE_URLS = [
    'https://music.yandex.ru/favicon.ico',
    'https://app.jcartools.ru/'
  ];
  const OPEN_URLS = [
    'https://clients3.google.com/generate_204',
    'https://cp.cloudflare.com/generate_204',
    'https://www.gstatic.com/generate_204'
  ];
  const WHITE_IMG_URLS = [
    'https://music.yandex.ru/favicon.ico',
    'https://app.jcartools.ru/favicon.ico'
  ];
  const OPEN_IMG_URLS = [
    'https://www.google.com/favicon.ico',
    'https://www.gstatic.com/favicon.ico',
    'https://cp.cloudflare.com/favicon.ico'
  ];

  const FETCH_TIMEOUT_MS = 4000;
  const IMG_TIMEOUT_MS = 4000;
  const TOTAL_CHECK_TIMEOUT_MS = 12000;
  const TOAST_DURATION_MS = 2500;

  const STATUS_HINTS = {
    0: '❌ Нет интернета',
    1: '⚠️ Ограниченный доступ (белые списки)',
    2: '✅ Есть интернет'
  };

  function showStatusHint(text) {
    if (typeof showToast === 'function') {
      showToast(text, TOAST_DURATION_MS);
    }
  }

  function applyVisibilityFromSettings() {
    const show = storage.load('setting_showNetworkStatus');
    const visible = show !== false;
    const target = widget || btn;
    if (target) target.classList.toggle('widget-hidden', !visible);
  }

  function svgNoNetwork() {
    return '<svg class="network-svg" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="10" stroke="#F44336" stroke-width="1.5" fill="none"/>' +
      '<path d="M8 8l8 8M16 8l-8 8" stroke="#F44336" stroke-width="1.5"/>' +
      '</svg>';
  }

  function svgWifi(fill) {
    return '<svg class="network-svg" viewBox="0 0 24 24">' +
      '<path d="M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4.95-5.95c-1.6-1.6-3.1-2.3-4.95-2.3s-3.35.7-4.95 2.3l1.4 1.4c1.3-1.3 2.5-1.7 3.55-1.7s2.25.4 3.55 1.7l1.4-1.4zm3.15-3.95C17.8 5.8 15.1 4.75 12 4.75S6.2 5.8 3.9 8.1l1.4 1.4c2-2 4.3-2.75 6.7-2.75s4.7.75 6.7 2.75l1.4-1.4zm3.1-3.9C19.9.9 16.1-.5 12-.5S4.1.9.8 4.2l1.4 1.4c3-3 6.3-4.1 9.8-4.1s6.8 1.1 9.8 4.1l1.4-1.4z" fill="' + fill + '"/>' +
      '</svg>';
  }

  function svgWifiLimited() {
    return '<svg class="network-svg" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="10" fill="#F44336" opacity="0.92"/>' +
      '<path d="M12 16.4c-.75 0-1.35.6-1.35 1.35S11.25 19.1 12 19.1s1.35-.6 1.35-1.35S12.75 16.4 12 16.4zm3.34-4.02c-1.08-1.08-2.09-1.55-3.34-1.55s-2.26.47-3.34 1.55l.94.94c.88-.88 1.69-1.15 2.4-1.15s1.52.27 2.4 1.15l.94-.94zm2.13-2.67C16.03 8.27 14.2 7.56 12 7.56s-4.03.71-5.47 2.15l.94.94c1.35-1.35 2.9-1.86 4.53-1.86s3.18.51 4.53 1.86l.94-.94zm2.09-2.64C17.45 4.96 14.89 4.06 12 4.06s-5.45.9-7.56 3.01l.94.94c2.02-2.02 4.25-2.78 6.62-2.78s4.6.76 6.62 2.78l.94-.94z" fill="#FFFFFF"/>' +
      '</svg>';
  }

  function setStatus(newStatus) {
    status = newStatus;
    online = newStatus > 0;

    if (newStatus === 0) {
      icon.innerHTML = svgNoNetwork();
      btn.title = 'Нет интернета';
    } else if (newStatus === 1) {
      icon.innerHTML = svgWifiLimited();
      btn.title = 'Ограниченный доступ (белые списки)';
    } else {
      icon.innerHTML = svgWifi('#7BA7FF');
      btn.title = 'Есть интернет';
    }
  }

  function fetchCheck(url) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const opts = { mode: 'no-cors', cache: 'no-store' };
    if (controller) opts.signal = controller.signal;

    const fetchPromise = (async () => {
      try {
        await fetch(url, opts);
        return true;
      } catch (e) {
        return false;
      }
    })();

    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        if (controller) { try { controller.abort(); } catch (e) { /* noop */ } }
        resolve(false);
      }, FETCH_TIMEOUT_MS);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  function imageCheck(url) {
    return new Promise(resolve => {
      let settled = false;
      const img = new Image();
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        img.src = '';
        resolve(false);
      }, IMG_TIMEOUT_MS);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });
  }

  async function checkGroup(fetchUrls, imgUrls) {
    for (const url of fetchUrls) {
      const ok = await fetchCheck(url);
      if (ok) return true;
    }
    for (const url of imgUrls) {
      const ok = await imageCheck(url);
      if (ok) return true;
    }
    return false;
  }

  async function check(showHintAfter = false) {
    if (checking) {
      if (showHintAfter) showStatusHint('🔄 Проверка уже идёт...');
      return;
    }
    checking = true;

    if (showHintAfter) showStatusHint('🔄 Проверка сети...');

    let resultStatus = 0;

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        resultStatus = 0;
      } else {
        const whiteOk = await checkGroup(WHITE_URLS, WHITE_IMG_URLS);
        const openOk = await checkGroup(OPEN_URLS, OPEN_IMG_URLS);

        if (openOk) resultStatus = 2;
        else if (whiteOk) resultStatus = 1;
        else resultStatus = 0;
      }
      setStatus(resultStatus);
    } catch (e) {
      console.warn('[Network] check error:', e);
      resultStatus = 0;
      setStatus(0);
    } finally {
      checking = false;
      if (showHintAfter) {
        showStatusHint(STATUS_HINTS[resultStatus] || STATUS_HINTS[0]);
      }
    }
  }

  function stopAutoCheck() {
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  }

  function forceStatus(newStatus) {
    if ([0, 1, 2].includes(newStatus)) {
      setStatus(newStatus);
      showStatusHint('Принудительно установлен статус: ' + newStatus);
    }
  }

  function init() {
    applyVisibilityFromSettings();
    check();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof diag !== 'undefined' && diag.handleNetworkClick()) return;
      if (!checking) {
        check(true);
      } else {
        showStatusHint(STATUS_HINTS[status] || STATUS_HINTS[0]);
      }
    });
    window.addEventListener('online', () => { check(); });
    window.addEventListener('offline', () => setStatus(0));
    checkInterval = setInterval(check, 60000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !checking) check();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'setting_showNetworkStatus') {
        applyVisibilityFromSettings();
      }
    });
  }

  return { init, stopAutoCheck, check, setVisible: applyVisibilityFromSettings, forceStatus };
})();