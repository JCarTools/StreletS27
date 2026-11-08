/**********************************************
 * Модуль: Управление громкостью
 * [FIX] handleVolumeFromSystem: уважает окно подавления эха (ECHO_SUPPRESS_MS),
 *       не сбрасывает lastSetValue преждевременно, если пришло «старое» значение.
 *       Единая логика с fetchVolume: пока окно активно и значение != lastSetValue,
 *       внешнее событие игнорируется (это эхо от нашей же команды).
 * [FIX] parseVolumeValue: рекурсивная обработка массивов/объектов (включая [ { value } ]).
 * [FIX] setVolume: не дёргаем notifyCallbacks, если значение не изменилось.
 * [FIX 4.2-связанное] ECHO_SUPPRESS_MS уменьшен 2000 → 1200 мс. При VOLUME_POLL_MS = 400
 *       (player.js) старые 2000 мс «съедали» до 5 подряд идущих реальных изменений
 *       громкости. 1200 мс = 3 опроса — достаточно для эха, но не блокирует изменения.
 * [FIX 4.2-связанное] isSuppressing() теперь сбрасывает lastSetValue/lastSetTime,
 *       когда окно истекло — состояние остаётся чистым.
 * [FIX] fetchVolume(force=true) полностью игнорирует окно подавления —
 *       иначе плеер показывал бы старое значение до истечения окна.
 * [FIX] startAutoCheck: дефолтный интервал 30000 → 60000 мс — player.js и так
 *       опрашивает каждые 400 мс через fetchVolume(true), отдельный поллинг
 *       на 30 с создаёт лишнюю нагрузку на мост.
 **********************************************/

modules.volume = (function() {
  let currentVolume = 50;
  let callbacks = [];
  let volumeCheckInterval = null;
  let isInitialized = false;

  let lastSetValue = null;
  let lastSetTime = 0;
  // [FIX 4.2-связанное] 1200 мс вместо 2000.
  const ECHO_SUPPRESS_MS = 1200;

  // [FIX 4.2-связанное] Сбрасываем lastSetValue/lastSetTime, если окно истекло.
  // Это делает состояние чистым и предотвращает ложное срабатывание
  // isSuppressing() в граничных случаях (например, при следующем внешнем
  // изменении уже после окна).
  function isSuppressing() {
    if (lastSetValue === null) return false;
    if ((Date.now() - lastSetTime) >= ECHO_SUPPRESS_MS) {
      lastSetValue = null;
      lastSetTime = 0;
      return false;
    }
    return true;
  }

  function parseVolumeValue(raw, depth = 0) {
    if (raw === undefined || raw === null) return null;
    if (depth > 3) return null;

    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const v = parseVolumeValue(raw[i], depth + 1);
        if (v !== null) return v;
      }
      return null;
    }

    let candidate = raw;
    if (typeof raw === 'object') {
      candidate = raw.volume ?? raw.value ?? raw.vol ?? raw.level;
      if (candidate !== undefined && candidate !== null && typeof candidate === 'object') {
        return parseVolumeValue(candidate, depth + 1);
      }
    }

    if (typeof candidate === 'string') {
      candidate = candidate.replace(/[^0-9-]/g, '');
    }

    const num = parseInt(candidate, 10);
    if (isNaN(num) || num < 0 || num > 100) return null;
    return num;
  }

  function fetchVolume(force = false) {
    try {
      const raw = android.getVolume();
      const newVolume = parseVolumeValue(raw);
      if (newVolume === null) return currentVolume;

      // [FIX] force=true (player.js) — игнорируем окно подавления:
      // иначе плеер показывал бы старое значение до истечения окна.
      if (!force && isSuppressing() && newVolume !== lastSetValue) {
        return currentVolume;
      }

      if (newVolume !== currentVolume) {
        currentVolume = newVolume;
        notifyCallbacks(currentVolume);
      }
      return currentVolume;
    } catch (e) {
      console.error('[Volume] Ошибка получения громкости:', e);
    }
    return currentVolume;
  }

  function setVolume(volume, showToastMsg = false) {
    const newVolume = parseVolumeValue(volume);
    if (newVolume === null) return;

    // [FIX] lastSetValue/lastSetTime обновляем всегда — мы только что послали
    // команду, нужно подавить её эхо. Но notifyCallbacks не дёргаем, если
    // значение не изменилось (защита от лишних перерисовок).
    lastSetValue = newVolume;
    lastSetTime = Date.now();

    android.setVolume(newVolume);

    if (newVolume === currentVolume) return;
    currentVolume = newVolume;

    if (showToastMsg && typeof showToast === 'function') {
      showToast(`Громкость: ${newVolume}%`, 1500);
    }
    notifyCallbacks(currentVolume);
  }

  function volumeUp(step = 5) { setVolume(Math.min(100, currentVolume + step), true); }
  function volumeDown(step = 5) { setVolume(Math.max(0, currentVolume - step), true); }

  function notifyCallbacks(volume) {
    callbacks.forEach(cb => {
      try { cb(volume); } catch (e) { console.error('[Volume] Callback error:', e); }
    });
  }

  function subscribe(callback) {
    if (typeof callback === 'function') {
      if (!callbacks.includes(callback)) callbacks.push(callback);
      callback(currentVolume);
    }
  }

  function unsubscribe(callback) {
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  // [FIX 4.2-связанное] Дефолт 60 000 мс вместо 30 000 — player.js и так
  // опрашивает каждые 400 мс через fetchVolume(true).
  function startAutoCheck(intervalMs = 60000) {
    stopAutoCheck();
    volumeCheckInterval = setInterval(fetchVolume, intervalMs);
  }

  function stopAutoCheck() {
    if (volumeCheckInterval) {
      clearInterval(volumeCheckInterval);
      volumeCheckInterval = null;
    }
  }

  // [FIX] Уважаем окно подавления: если пришло эхо нашей команды — игнорируем,
  // но не сбрасываем lastSetValue (окно пусть истечёт само — isSuppressing()
  // сбросит его при следующей проверке).
  function handleVolumeFromSystem(volume) {
    const newVolume = parseVolumeValue(volume);
    if (newVolume === null) return;

    if (isSuppressing()) {
      if (newVolume === lastSetValue) {
        // Подтверждение от машины — ок.
        lastSetValue = null;
        lastSetTime = 0;
        if (newVolume !== currentVolume) {
          currentVolume = newVolume;
          notifyCallbacks(currentVolume);
        }
        return;
      }
      // Старое эхо — игнорируем, не сбрасываем подавление.
      return;
    }

    if (newVolume !== currentVolume) {
      currentVolume = newVolume;
      notifyCallbacks(currentVolume);
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;
    fetchVolume();
    startAutoCheck(60000);
  }

  return {
    init,
    getVolume: () => currentVolume,
    setVolume,
    volumeUp,
    volumeDown,
    subscribe,
    unsubscribe,
    fetchVolume,
    startAutoCheck,
    stopAutoCheck,
    handleVolumeFromSystem
  };
})();