/**********************************************
 * Модуль: Плеер
 * [FIX] Пауза progressTick при document.hidden
 * [UX] Drag прогресса пальцем/мышью
 * [FIX] Защита от NaN в updateMusicInfo/onProgressClick
 **********************************************/

modules.player = (function() {
  const PLACEHOLDER_COVER = "images/img.jpg";
  const titleEl = document.querySelector(".widget_player__title");
  const artistEl = document.querySelector(".widget_player__artist");
  const imgEl = document.querySelector(".widget_player__image img");
  const progressFill = document.querySelector(".widget_player__track_progress");
  const timeSpans = document.querySelectorAll(".widget_player__track_time span");
  const timeCurrentSpan = timeSpans[0];
  const timeDurationSpan = timeSpans[1];
  const playBtn = document.getElementById("player__play");
  const pauseBtn = document.getElementById("player__pause");
  const trackLine = document.querySelector(".widget_player__track_line");
  const volumeSlider = document.getElementById("player__volume_slider");
  const volumeValue = document.getElementById("player__volume_value");

  let isPlaying = false;
  let playStateKnown = false;
  let playStateLockUntil = 0;
  const PLAYSTATE_ECHO_MS = 1500;

  const PLAYPAUSE_TOGGLE_CMD = null;
  let trackDuration = 0;
  let trackPosition = 0;
  let positionTimestamp = 0;
  let progressTimer = null;
  let currentVolume = 50;
  let isDraggingProgress = false;

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

  function startProgressTick() {
    if (progressTimer) clearInterval(progressTimer);
    if (!isPlaying) return;
    progressTimer = setInterval(() => {
      if (!isPlaying || isDraggingProgress) return;
      if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
      const elapsed = Date.now() - positionTimestamp;
      let newPos = trackPosition + elapsed;
      if (newPos >= trackDuration) newPos = trackDuration;
      updateProgressUI(newPos, trackDuration);
    }, 200);
  }

  function stopProgressTick() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  }

  function renderPlayState() {
    if (playBtn && pauseBtn) {
      playBtn.style.display = isPlaying ? "none" : "flex";
      pauseBtn.style.display = isPlaying ? "flex" : "none";
    }
  }

  function applyPlayState(playing, fromUser = false) {
    if (!fromUser && Date.now() < playStateLockUntil) return;
    if (playing === isPlaying) { renderPlayState(); return; }
    isPlaying = playing;
    renderPlayState();
    if (isPlaying) startProgressTick();
    else stopProgressTick();
  }

  function onPlayPauseClick(e) {
    e?.stopPropagation?.();
    if (PLAYPAUSE_TOGGLE_CMD) {
      if (typeof android.runEnum === 'function') android.runEnum(PLAYPAUSE_TOGGLE_CMD);
    } else {
      const cmd = isPlaying ? "MEDIA_PAUSE" : "MEDIA_PLAY";
      if (typeof android.runEnum === 'function') android.runEnum(cmd);
    }
    playStateLockUntil = Date.now() + PLAYSTATE_ECHO_MS;
    applyPlayState(!isPlaying, true);
    if (!playStateKnown) android.requestMusicState();
  }

  function seekToClientX(clientX) {
    if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
    if (!trackLine) return;
    const rect = trackLine.getBoundingClientRect();
    if (rect.width <= 0) return;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    const newPos = Math.floor(percent * trackDuration);
    if (!Number.isFinite(newPos)) return;
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

  // [UX] Drag прогресса
  function initProgressDrag() {
    if (!trackLine) return;
    let active = false;

    const apply = (e) => {
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      seekToClientX(clientX);
    };

    const start = (e) => {
      if (!Number.isFinite(trackDuration) || trackDuration <= 0) return;
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      const rect = trackLine.getBoundingClientRect();
      if (rect.width <= 0) return;
      // Начинаем drag только если попали в линию
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

  // === ГРОМКОСТЬ ===
  function updateVolumeUI(percent) {
    const safe = Math.min(100, Math.max(0, parseInt(percent, 10)));
    if (isNaN(safe)) return;
    const volumeFill = document.getElementById("player__volume_fill");
    if (volumeFill) volumeFill.style.width = safe + "%";
    if (volumeValue) volumeValue.textContent = safe + "%";
    currentVolume = safe;
  }

  function setVolume(volume, showToast = false) {
    const vol = Math.min(100, Math.max(0, parseInt(volume, 10)));
    if (isNaN(vol)) return;
    updateVolumeUI(vol);
    if (modules.volume && typeof modules.volume.setVolume === 'function') {
      modules.volume.setVolume(vol, showToast);
    } else {
      android.setVolume(vol);
    }
  }

  function onVolumeLineClick(e) {
    e.stopPropagation();
    e.preventDefault();
    const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
    if (clientX === undefined) return;
    const volumeLine = volumeSlider.querySelector('.widget_player__volume_line');
    if (!volumeLine) return;
    const rect = volumeLine.getBoundingClientRect();
    if (rect.width <= 0) return;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    setVolume(Math.round(percent * 100), false);
  }

  function initVolumeSliderDrag(volumeLine) {
    const volumeDot = volumeSlider.querySelector('.widget_player__volume_dot');
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

  function updateMusicInfo(rawData) {
    let data = rawData;
    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch (e) {
      console.warn('[Player] updateMusicInfo: JSON parse error', e);
      return;
    }
    if (!data || typeof data !== 'object') return;

    if (titleEl) titleEl.textContent = data.SongName || "—";
    if (artistEl) artistEl.textContent = data.SongArtist || "";
    if (imgEl) {
      if (data.SongAlbumPicture) {
        imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;
      } else {
        imgEl.src = PLACEHOLDER_COVER;
      }
    }

    let dur = parseFloat(data.Trdur);
    let pos = parseFloat(data.Trpos);
    if (!Number.isFinite(dur)) dur = 0;
    if (!Number.isFinite(pos)) pos = 0;
    if (dur < 1000 && dur > 0) dur *= 1000;
    if (pos < 1000 && pos > 0) pos *= 1000;
    trackDuration = dur;
    trackPosition = Math.min(pos, trackDuration || pos);
    positionTimestamp = Date.now();
    if (!isDraggingProgress) {
      updateProgressUI(trackPosition, trackDuration);
    }

    let newPlaying;
    if (data.IsPlaying !== undefined) {
      newPlaying = data.IsPlaying === true || data.IsPlaying === 'true' || data.IsPlaying === 1;
    } else if (data.playState !== undefined) {
      newPlaying = data.playState === true || data.playState === 'true' || data.playState === 1;
    } else if (data.playStat !== undefined) {
      newPlaying = data.playStat === true || data.playStat === 'true' || data.playStat === 1;
    }
    if (newPlaying !== undefined) {
      playStateKnown = true;
      applyPlayState(newPlaying);
    }
    if (isPlaying) {
      stopProgressTick();
      startProgressTick();
    }
  }

  let isInitialized = false;

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    document.getElementById("player__prev")?.addEventListener("click", () => android.runEnum("MEDIA_BLACK"));
    document.getElementById("player__next")?.addEventListener("click", () => android.runEnum("MEDIA_NEXT"));
    if (playBtn) playBtn.addEventListener("click", onPlayPauseClick);
    if (pauseBtn) pauseBtn.addEventListener("click", onPlayPauseClick);
    if (trackLine) {
      trackLine.addEventListener("click", onProgressClick);
      initProgressDrag();
    }
    initVolumeSlider();

    if (modules.volume && modules.volume.subscribe) {
      modules.volume.subscribe(handleVolumeFromSystem);
    }
    renderPlayState();
    android.requestMusicState();
    setTimeout(() => { if (!playStateKnown) android.requestMusicState(); }, 400);
    setTimeout(() => { if (!playStateKnown) android.requestMusicState(); }, 1200);

    // [FIX] Пауза progressTick при document.hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopProgressTick();
      } else if (isPlaying) {
        startProgressTick();
      }
    });
  }

  return { updateMusicInfo, init, handleVolumeFromSystem };
})();