/**********************************************
 * Модуль: Плеер
 * [FIX] Секунды идут только при воспроизведении.
 * [FIX] Клик по виджету плеера обновляет данные.
 * [FIX] Мгновенное обновление названия и исполнителя.
 * [FIX] Парсинг PlayStat (поле из документации musicInfo).
 * [FIX] Корректная синхронизация базы позиции при паузе/возобновлении.
 * [FIX] Перезапуск таймера после visibilitychange.
 * [FIX] Не затираем непустые поля пустыми значениями из ответа.
 * [FIX] Разворачиваем вложенные обёртки data.response / data.data.
 * [FIX] Принудительный запрос музыки при возврате к панели (pageshow, focus, visibilitychange).
 * [FIX] Принудительный запрос при любом клике по виджету плеера.
 **********************************************/

modules.player = (function() {
  const PLACEHOLDER_COVER = "images/img.jpg";
  const playerWidget = document.querySelector(".widget_player");
  const titleEl = document.querySelector(".widget_player__title");
  const artistEl = document.querySelector(".widget_player__artist");
  const imgEl = document.querySelector(".widget_player__image img");
  const progressFill = document.querySelector(".widget_player__track_progress");
  const timeSpans = document.querySelectorAll(".widget_player__track_time span");
  const timeCurrentSpan = timeSpans[0];
  const timeDurationSpan = timeSpans[1];
  
  const playPauseBtn = document.getElementById("player__playpause");
  const playPausePath = document.getElementById("player__playpause_path");

  const trackLine = document.querySelector(".widget_player__track_line");
  const volumeSlider = document.getElementById("player__volume_slider");
  const volumeValue = document.getElementById("player__volume_value");

  let isPlaying = false;
  let trackDuration = 0;
  let trackPosition = 0;
  let positionTimestamp = 0;
  let progressTimer = null;
  let currentVolume = 50;
  let isDraggingProgress = false;
  
  let musicPollInterval = null;
  let visibilityHandler = null;
  let focusHandler = null;
  let pageshowHandler = null;
  
  let lastTitle = null;
  let lastArtist = null;
  let lastImgBase64 = null;

  function formatTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "0:00";
    if (ms === Infinity || ms > 86400000) return "∞";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ":" + String(s).padStart(2, '0');
  }

  function updateProgressUI(pos, dur) {
    const safePos = Number.isFinite(pos) ? pos : 0;
    const safeDur = Number.isFinite(dur) ? dur : 0;
    const percent = safeDur > 0 ? Math.min(safePos / safeDur * 100, 100) : 0;
    if (progressFill) progressFill.style.width = percent + "%";
    if (timeCurrentSpan) timeCurrentSpan.textContent = formatTime(safePos);
    if (timeDurationSpan) timeDurationSpan.textContent = formatTime(safeDur);
  }

  function currentPosition() {
    if (!isPlaying) return trackPosition;
    if (!Number.isFinite(trackDuration) || trackDuration <= 0) return trackPosition;
    const elapsed = Date.now() - positionTimestamp;
    let pos = trackPosition + elapsed;
    if (pos > trackDuration) pos = trackDuration;
    if (pos < 0) pos = 0;
    return pos;
  }

  function startProgressTick() {
    if (progressTimer) clearInterval(progressTimer);
    if (!isPlaying) return;
    if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;

    trackPosition = currentPosition();
    positionTimestamp = Date.now();

    progressTimer = setInterval(() => {
      if (!isPlaying || isDraggingProgress) return;
      if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
      const pos = currentPosition();
      updateProgressUI(pos, trackDuration);
    }, 1000);
  }

  function stopProgressTick() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    if (isPlaying) {
      trackPosition = currentPosition();
      if (trackPosition > trackDuration) trackPosition = trackDuration;
      if (trackPosition < 0) trackPosition = 0;
      positionTimestamp = Date.now();
    }
    updateProgressUI(trackPosition, trackDuration);
  }

  function renderPlayState() {
    if (!playPausePath) return;
    if (isPlaying) {
      playPausePath.setAttribute('d', 'M9.5 7.5v9M14.5 7.5v9');
    } else {
      playPausePath.setAttribute('d', 'M9 7.5v9l7-4.5-7-4.5z');
    }
  }

  function applyPlayState(playing) {
    if (playing === isPlaying) {
      renderPlayState();
      if (isPlaying && !progressTimer) startProgressTick();
      return;
    }
    isPlaying = playing;
    renderPlayState();
    if (isPlaying) {
      startProgressTick();
    } else {
      stopProgressTick();
    }
  }

  function onPlayPauseClick(e) {
    e?.stopPropagation?.();
    applyPlayState(!isPlaying);
    if (typeof android.runEnum === 'function') {
      android.runEnum("MEDIA_PLAY_PAUSE");
    }
    requestMusicRefresh();
  }

  function seekToClientX(clientX) {
    if (!Number.isFinite(trackDuration) || trackDuration <= 0) return undefined;
    if (!trackLine) return undefined;
    const rect = trackLine.getBoundingClientRect();
    if (rect.width <= 0) return undefined;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    const newPos = Math.floor(percent * trackDuration);
    if (!Number.isFinite(newPos)) return undefined;
    trackPosition = newPos;
    positionTimestamp = Date.now();
    updateProgressUI(newPos, trackDuration);
    return newPos;
  }

  function onProgressClick(e) {
    if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
    if (!trackLine) return;
    let clientX;
    if (e.touches) {
      if (!e.touches[0]) return;
      clientX = e.touches[0].clientX;
      e.preventDefault();
    } else {
      clientX = e.clientX;
    }
    const newPos = seekToClientX(clientX);
    if (newPos === undefined) return;
    if (typeof android.runEnum === 'function') android.runEnum("MEDIA_SEEK_" + newPos);
  }

  function initProgressDrag() {
    if (!trackLine) return;
    let active = false;

    const apply = (e) => {
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return undefined;
      return seekToClientX(clientX);
    };

    const start = (e) => {
      if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      const rect = trackLine.getBoundingClientRect();
      if (rect.width <= 0) return;
      active = true;
      isDraggingProgress = true;
      apply(e);
      if (e.cancelable) e.preventDefault();
    };

    const move = (e) => {
      if (!active) return;
      if (e.cancelable) e.preventDefault();
      apply(e);
    };

    const end = (e) => {
      if (!active) return;
      active = false;
      isDraggingProgress = false;
      const clientX = e.changedTouches ? e.changedTouches[0]?.clientX : e.clientX;
      if (clientX !== undefined) {
        const newPos = seekToClientX(clientX);
        if (newPos !== undefined && typeof android.runEnum === 'function') {
          android.runEnum("MEDIA_SEEK_" + newPos);
        }
      }
    };

    trackLine.addEventListener('mousedown', start);
    trackLine.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  function updateVolumeUI(percent) {
    const safe = Math.min(100, Math.max(0, parseInt(percent, 10)));
    if (isNaN(safe)) return;
    const volumeFill = document.getElementById("player__volume_fill");
    if (volumeFill) volumeFill.style.width = safe + "%";
    if (volumeValue) volumeValue.textContent = safe + "%";
    currentVolume = safe;
  }

  function setVolume(volume, showToastMsg = false) {
    const vol = Math.min(100, Math.max(0, parseInt(volume, 10)));
    if (isNaN(vol)) return;
    updateVolumeUI(vol);
    if (modules.volume && typeof modules.volume.setVolume === 'function') {
      modules.volume.setVolume(vol, showToastMsg);
    } else if (typeof android.setVolume === 'function') {
      android.setVolume(vol);
    }
  }

  function onVolumeLineClick(e) {
    e.stopPropagation();
    e.preventDefault();
    const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
    if (clientX === undefined) return;
    const volumeLine = volumeSlider?.querySelector('.widget_player__volume_line');
    if (!volumeLine) return;
    const rect = volumeLine.getBoundingClientRect();
    if (rect.width <= 0) return;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    setVolume(Math.round(percent * 100), false);
  }

  function initVolumeSliderDrag(volumeLine) {
    const volumeDot = volumeSlider?.querySelector('.widget_player__volume_dot');
    if (!volumeDot) return;
    let isDragging = false;

    const applyFromEvent = (e) => {
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      const rect = volumeLine.getBoundingClientRect();
      if (rect.width <= 0) return;
      let percent = (clientX - rect.left) / rect.width;
      percent = Math.min(1, Math.max(0, percent));
      setVolume(Math.round(percent * 100), false);
    };

    const startDrag = (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
    };
    const onDrag = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      applyFromEvent(e);
    };
    const stopDrag = () => { isDragging = false; };

    volumeDot.addEventListener('mousedown', startDrag);
    volumeDot.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    volumeDot.addEventListener('touchmove', onDrag, { passive: false });
    volumeDot.addEventListener('touchend', stopDrag);
    volumeDot.addEventListener('touchcancel', stopDrag);
  }

  function initVolumeSlider() {
    if (!volumeSlider) return;
    const volumeLine = volumeSlider.querySelector('.widget_player__volume_line');
    if (!volumeLine) return;
    volumeLine.addEventListener('click', onVolumeLineClick);
    volumeLine.addEventListener('touchstart', onVolumeLineClick, { passive: false });
    initVolumeSliderDrag(volumeLine);

    let sysVolume = 50;
    try {
      if (modules.volume && typeof modules.volume.getVolume === 'function') {
        sysVolume = modules.volume.getVolume();
      }
    } catch (e) { /* noop */ }
    updateVolumeUI(sysVolume);
  }

  function handleVolumeFromSystem(volume) {
    if (volume === undefined || volume === null) return;
    const raw = (typeof volume === 'object') ? (volume.volume ?? volume.value) : volume;
    const vol = parseInt(raw, 10);
    if (!isNaN(vol) && vol >= 0 && vol <= 100 && vol !== currentVolume) {
      updateVolumeUI(vol);
    }
  }

  function parsePlayFlag(raw) {
    if (raw === undefined || raw === null) return undefined;
    if (raw === true) return true;
    if (raw === false) return false;
    const s = String(raw).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'on' || s === 'playing' || s === 'play') return true;
    if (s === 'false' || s === '0' || s === 'off' || s === 'paused' || s === 'pause') return false;
    return undefined;
  }

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function unwrapPayload(raw) {
    let data = raw;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return null; }
    }
    if (!data || typeof data !== 'object') return null;
    if (data.response && typeof data.response === 'object') return data.response;
    if (data.data && typeof data.data === 'object') return data.data;
    return data;
  }

  // Принудительный запрос свежих данных музыки.
  // Пробуем все доступные способы, чтобы Android прислал musicInfo.
  function requestMusicRefresh() {
    // 1. Прямой метод (если реализован в мосте)
    try { if (typeof android.requestMusicState === 'function') android.requestMusicState(); } catch (e) {}
    // 2. Через carData (некоторые реализации поддерживают ключ 'music')
    try {
      if (typeof android.requestCarDataAsync === 'function') {
        android.requestCarDataAsync('music', 1500).catch(() => {});
      }
    } catch (e) {}
    // 3. Через carData 'all' — вдруг музыка там есть
    try {
      if (typeof android.requestCarDataAsync === 'function') {
        android.requestCarDataAsync('all', 2000).catch(() => {});
      }
    } catch (e) {}
  }

  function updateMusicInfo(rawData) {
    const data = unwrapPayload(rawData);
    if (!data) return;

    // Название: не затираем старое пустым
    const rawTitle = data.SongName ?? data.title ?? data.name ?? data.track;
    if (titleEl) {
      if (isNonEmptyString(rawTitle)) {
        if (lastTitle !== rawTitle) {
          titleEl.textContent = rawTitle;
          lastTitle = rawTitle;
        }
      } else if (lastTitle === null) {
        lastTitle = titleEl.textContent;
      }
    }

    // Исполнитель: не затираем старое пустым
    const rawArtist = data.SongArtist ?? data.artist ?? data.author ?? data.singer;
    if (artistEl) {
      if (isNonEmptyString(rawArtist)) {
        if (lastArtist !== rawArtist) {
          artistEl.textContent = rawArtist;
          lastArtist = rawArtist;
        }
      } else if (lastArtist === null) {
        lastArtist = artistEl.textContent;
      }
    }

    // Обложка
    if (imgEl) {
      const pic = data.SongAlbumPicture || data.picture;
      if (pic) {
        if (lastImgBase64 !== pic) {
          imgEl.src = "data:image/png;base64," + pic;
          lastImgBase64 = pic;
        }
      } else if (lastImgBase64 === null) {
        imgEl.src = PLACEHOLDER_COVER;
        lastImgBase64 = "placeholder";
      }
    }

    // Длительность и позиция
    let dur = parseFloat(data.Trdur ?? data.duration ?? 0);
    let pos = parseFloat(data.Trpos ?? data.position ?? 0);
    if (!Number.isFinite(dur)) dur = 0;
    if (!Number.isFinite(pos)) pos = 0;

    if (trackDuration !== dur) {
      trackDuration = dur;
    }

    const computed = currentPosition();
    if (!isPlaying || Math.abs(computed - pos) > 2000) {
      trackPosition = pos;
      positionTimestamp = Date.now();
      if (trackPosition > trackDuration) trackPosition = trackDuration;
      if (trackPosition < 0) trackPosition = 0;
      if (!isPlaying) {
        updateProgressUI(trackPosition, trackDuration);
      }
    }

    // Статус воспроизведения
    const playRaw = (data.IsPlaying !== undefined) ? data.IsPlaying
                  : (data.PlayStat   !== undefined) ? data.PlayStat
                  : (data.playState  !== undefined) ? data.playState
                  : (data.playStat   !== undefined) ? data.playStat
                  : undefined;
    const newPlaying = parsePlayFlag(playRaw);
    if (newPlaying !== undefined) {
      applyPlayState(newPlaying);
    }
  }

  let isInitialized = false;

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Кнопки
    document.getElementById("player__prev")?.addEventListener("click", () => {
      if (typeof android.runEnum === 'function') android.runEnum("MEDIA_BLACK");
      requestMusicRefresh();
    });
    document.getElementById("player__next")?.addEventListener("click", () => {
      if (typeof android.runEnum === 'function') android.runEnum("MEDIA_NEXT");
      requestMusicRefresh();
    });
    if (playPauseBtn) playPauseBtn.addEventListener("click", onPlayPauseClick);
    
    // Клик по любому месту виджета (кроме интерактивных зон) — принудительный запрос
    if (playerWidget) {
      playerWidget.addEventListener('click', (e) => {
        // Если клик по кнопке — не дублируем (кнопки сами вызывают refresh)
        if (e.target.closest('button')) return;
        // Если клик по прогресс-бару или слайдеру — не мешаем
        if (e.target.closest('.widget_player__track_line') ||
            e.target.closest('.widget_player__volume_slider')) return;
        requestMusicRefresh();
      });
    }
    
    if (trackLine) {
      trackLine.addEventListener("click", onProgressClick);
      initProgressDrag();
    }
    initVolumeSlider();

    if (modules.volume && modules.volume.subscribe) {
      modules.volume.subscribe(handleVolumeFromSystem);
    }
    renderPlayState();
    
    // Первичный запрос
    requestMusicRefresh();

    // Постоянный опрос (если страница видима)
    if (musicPollInterval) clearInterval(musicPollInterval);
    musicPollInterval = setInterval(() => {
      if (!document.hidden) {
        requestMusicRefresh();
      }
    }, 1500);

    // visibilitychange — при возврате запрашиваем с задержкой (Android может ещё не быть готов)
    visibilityHandler = () => {
      if (document.hidden) {
        stopProgressTick();
      } else {
        // Небольшая задержка, чтобы Android успел выйти из фона
        setTimeout(requestMusicRefresh, 100);
        setTimeout(requestMusicRefresh, 500);
        if (isPlaying && !progressTimer) startProgressTick();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // pageshow — срабатывает при восстановлении страницы из bfcache или возврате
    pageshowHandler = (event) => {
      if (event.persisted) {
        requestMusicRefresh();
      } else {
        // Даже если не persisted — запросим на всякий случай
        setTimeout(requestMusicRefresh, 100);
      }
    };
    window.addEventListener('pageshow', pageshowHandler);

    // focus на window — когда окно получает фокус (возврат из другого приложения)
    focusHandler = () => {
      setTimeout(requestMusicRefresh, 100);
      setTimeout(requestMusicRefresh, 500);
    };
    window.addEventListener('focus', focusHandler);

    // Дополнительно: при любом касании/клике по документу (если пользователь вернулся и тапнул)
    // Но только один раз за сессию касания, чтобы не спамить
    let lastTouchRefresh = 0;
    document.addEventListener('touchstart', () => {
      const now = Date.now();
      if (now - lastTouchRefresh > 2000) {
        lastTouchRefresh = now;
        setTimeout(requestMusicRefresh, 50);
      }
    }, { passive: true });
  }

  function destroy() {
    if (musicPollInterval) { clearInterval(musicPollInterval); musicPollInterval = null; }
    stopProgressTick();
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    if (pageshowHandler) {
      window.removeEventListener('pageshow', pageshowHandler);
      pageshowHandler = null;
    }
    if (focusHandler) {
      window.removeEventListener('focus', focusHandler);
      focusHandler = null;
    }
    isInitialized = false;
  }

  return { updateMusicInfo, init, handleVolumeFromSystem, destroy };
})();