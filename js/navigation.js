/**********************************************
 * Модуль: Мини-карта (navigation)
 * [FIX] Жесткая привязка темы: day=день, night=ночь, auto=по времени.
 * [FIX] Не кэшируем тему, если мост не принял вызов (res === null).
 * [FIX] applyThemeNow(force) — принудительное применение темы.
 * [FIX] Тема применяется при каждом кадре и при каждой подписке.
 * [FIX] Тема зависит ТОЛЬКО от настройки дашборда, не от данных моста.
 **********************************************/

modules.navigation = (function() {
  const imgEl = document.getElementById('navMinimapImg');
  const widgetEl = document.getElementById('widgetNavigation');
  let subscribed = false;
  let lastFrameTs = 0;
  let themeApplied = null;
  let noDataTimeout = null;
  let autoThemeInterval = null;
  let lastFrameAt = 0;
  let themeReassertTimer = null;

  function isEnabledInSettings() {
    return storage.load('setting_showMiniMap') === true;
  }

  function applyVisibility() {
    if (!widgetEl) return;
    const enabled = isEnabledInSettings();
    if (!enabled) {
      widgetEl.classList.add('widget-hidden');
      unsubscribe();
      if (imgEl) imgEl.removeAttribute('src');
      clearTimeout(noDataTimeout);
      return;
    }

    if (!imgEl || !imgEl.src || imgEl.src === '' || imgEl.src === window.location.href) {
      widgetEl.classList.add('widget-hidden');
      subscribe();
      startNoDataTimeout();
    } else {
      widgetEl.classList.remove('widget-hidden');
      subscribe();
      clearTimeout(noDataTimeout);
    }
  }

  function startNoDataTimeout() {
    clearTimeout(noDataTimeout);
    noDataTimeout = setTimeout(() => {
      if (widgetEl) widgetEl.classList.add('widget-hidden');
    }, 5000);
  }

  function getAutoTheme() {
    const hour = new Date().getHours();
    return (hour >= 7 && hour < 19) ? 'day' : 'night';
  }

  function getTargetTheme() {
    const setting = storage.load('setting_miniMapTheme'); // 'day', 'night' или 'auto'
    if (setting === 'day') return 'day';
    if (setting === 'night') return 'night';
    if (setting === 'auto') return getAutoTheme();
    return 'night';
  }

  function applyTheme(force) {
    if (typeof IS_ANDROID !== 'undefined' && !IS_ANDROID) return;
    if (!window.androidApi || typeof window.androidApi.setMiniMapTheme !== 'function') return;

    const targetMode = getTargetTheme();

    if (!force && themeApplied === targetMode) return;

    try {
      const res = callAndroid('setMiniMapTheme', targetMode);
      if (res === null) return;
      themeApplied = targetMode;
    } catch (e) {
      themeApplied = null;
    }
  }

  function applyThemeNow() {
    applyTheme(true);
  }

  function scheduleThemeReassert() {
    if (themeReassertTimer) clearTimeout(themeReassertTimer);
    themeReassertTimer = setTimeout(function() {
      applyTheme(true);
      themeReassertTimer = null;
    }, 200);
  }

  function subscribe() {
    if (!isEnabledInSettings()) return;
    if (subscribed) return;
    if (typeof callAndroid !== 'function') return;
    try {
      const res = callAndroid('subscribeMiniMap');
      if (typeof res === 'string') {
        try { JSON.parse(res); } catch (e) { /* noop */ }
      }
      subscribed = true;
      // Сбрасываем кэш темы, чтобы после подписки тема ушла в Android заново
      themeApplied = null;
      applyTheme(true);
    } catch (e) {
      subscribed = false;
    }
  }

  function unsubscribe() {
    if (!subscribed) return;
    if (typeof callAndroid !== 'function') { subscribed = false; return; }
    try {
      callAndroid('unsubscribeMiniMap');
    } catch (e) { /* noop */ }
    subscribed = false;
    themeApplied = null;
  }

  function onMiniMapFrame(data) {
    if (!isEnabledInSettings()) return;
    if (!imgEl) return;
    let payload = data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) { return; }
    }
    if (!payload || !payload.image) return;
    const ts = payload.timestamp || 0;
    if (ts && ts < lastFrameTs) return;
    lastFrameTs = ts;
    imgEl.src = payload.image;
    lastFrameAt = Date.now();

    if (widgetEl) {
      widgetEl.classList.remove('widget-hidden');
    }
    clearTimeout(noDataTimeout);

    // Принудительно переприменяем тему после каждого кадра.
    // Это гарантирует, что даже если Android сменил тему сам,
    // дашборд её вернёт к настройке пользователя.
    if (themeApplied !== getTargetTheme()) {
      applyTheme(true);
    } else {
      scheduleThemeReassert();
    }
  }

  function refresh() {
    applyVisibility();
    applyTheme(true);
  }

  function init() {
    applyVisibility();
    applyTheme(true);

    if (autoThemeInterval) clearInterval(autoThemeInterval);
    autoThemeInterval = setInterval(function() {
      const currentSetting = storage.load('setting_miniMapTheme');
      if (currentSetting === 'auto') {
        applyTheme(true);
      } else {
        // Не авто — перепроверяем, вдруг Android сбросил тему
        if (themeApplied !== getTargetTheme()) {
          applyTheme(true);
        }
      }
    }, 15000);

    const _origOnAndroidEventNav = window.onAndroidEvent;
    window.onAndroidEvent = function(type, data) {
      if (type === 'miniMapFrame') onMiniMapFrame(data);
      if (typeof _origOnAndroidEventNav === 'function') {
        try { _origOnAndroidEventNav(type, data); } catch (e) {}
      }
    };

    window.addEventListener('storage', function(e) {
      if (e.key === 'setting_showMiniMap') {
        applyVisibility();
      } else if (e.key === 'setting_miniMapTheme') {
        themeApplied = null;
        applyTheme(true);
      }
    });
  }

  function destroy() {
    unsubscribe();
    clearTimeout(noDataTimeout);
    if (autoThemeInterval) { clearInterval(autoThemeInterval); autoThemeInterval = null; }
    if (themeReassertTimer) { clearTimeout(themeReassertTimer); themeReassertTimer = null; }
  }

  return {
    init: init,
    refresh: refresh,
    destroy: destroy,
    applyThemeNow: applyThemeNow
  };
})();