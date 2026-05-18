/**********************************************
 * Модуль: Плеер (ИСПРАВЛЕН)
 *
 * Что изменено:
 *   - Удалена кнопка динамика
 *   - Слайдер громкости всегда виден под кнопками управления
 *   - Убрана логика показа/скрытия слайдера через кнопку
 *   - Бегунок расположен по центру
 **********************************************/

modules.player = (function() {
  // DOM элементы
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
  const volumeFill = document.getElementById("player__volume_fill");
  const volumeValue = document.getElementById("player__volume_value");

  // Состояние
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

  function formatTime(ms) {
    if (ms === Infinity || ms > 86400000) return "∞";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ":" + String(s).padStart(2, '0');
  }

  function updateProgressUI(pos, dur) {
    const percent = dur > 0 ? Math.min(pos / dur * 100, 100) : 0;
    if (progressFill) progressFill.style.width = percent + "%";
    if (timeCurrentSpan) timeCurrentSpan.textContent = formatTime(pos);
    if (timeDurationSpan) timeDurationSpan.textContent = formatTime(dur);
  }

  function startProgressTick() {
    if (progressTimer) clearInterval(progressTimer);
    if (!isPlaying) return;
    progressTimer = setInterval(() => {
      if (!isPlaying || trackDuration <= 0) return;
      const elapsed = Date.now() - positionTimestamp;
      let newPos = trackPosition + elapsed;
      if (newPos >= trackDuration) newPos = trackDuration;
      updateProgressUI(newPos, trackDuration);
    }, 200);
  }

  function stopProgressTick() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function renderPlayState() {
    if (playBtn && pauseBtn) {
      playBtn.style.display  = isPlaying ? "none" : "flex";
      pauseBtn.style.display = isPlaying ? "flex" : "none";
    }
  }

  function applyPlayState(playing, fromUser = false) {
    if (!fromUser && Date.now() < playStateLockUntil) return;

    if (playing === isPlaying) {
      renderPlayState();
      return;
    }
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

  function onProgressClick(e) {
    if (trackDuration <= 0) return;
    let clientX;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      e.preventDefault();
    } else {
      clientX = e.clientX;
    }
    const rect = trackLine.getBoundingClientRect();
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    const newPos = Math.floor(percent * trackDuration);
    if (typeof android.runEnum === 'function') android.runEnum("MEDIA_SEEK_" + newPos);
    trackPosition = newPos;
    positionTimestamp = Date.now();
    updateProgressUI(newPos, trackDuration);
  }

  // === ГРОМКОСТЬ ===
  function updateVolumeUI(percent) {
    percent = Math.min(100, Math.max(0, parseInt(percent, 10)));
    if (isNaN(percent)) return;
    if (volumeFill) volumeFill.style.width = percent + "%";
    if (volumeValue) volumeValue.textContent = percent + "%";
    currentVolume = percent;
  }

  function setVolume(volume) {
    let vol = Math.min(100, Math.max(0, parseInt(volume, 10)));
    if (isNaN(vol)) return;

    updateVolumeUI(vol);

    if (modules.volume && typeof modules.volume.setVolume === 'function') {
      modules.volume.setVolume(vol, true);
    } else {
      android.setVolume(vol);
    }
  }

  function onVolumeLineClick(e) {
    e.stopPropagation();
    e.preventDefault();

    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    if (clientX === undefined) return;

    const volumeLine = volumeSlider.querySelector('.widget_player__volume_line');
    if (!volumeLine) return;

    const rect = volumeLine.getBoundingClientRect();
    if (rect.width <= 0) return;

    let percent = (clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    const newVolume = Math.round(percent * 100);
    setVolume(newVolume);
  }

  function initVolumeSliderDrag(volumeLine) {
    const volumeDot = volumeSlider.querySelector('.widget_player__volume_dot');
    if (!volumeDot) return;

    let isDragging = false;

    const applyFromEvent = (e) => {
      let clientX = e.touches ? e.touches[0].clientX : e.clientX;
      if (clientX === undefined) return;
      const rect = volumeLine.getBoundingClientRect();
      if (rect.width <= 0) return;
      let percent = (clientX - rect.left) / rect.width;
      percent = Math.min(1, Math.max(0, percent));
      setVolume(Math.round(percent * 100));
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

    const stopDrag = () => {
      isDragging = false;
    };

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

    // Начальная громкость из единого модуля
    let sysVolume = 50;
    try {
      if (modules.volume && typeof modules.volume.getVolume === 'function') {
        sysVolume = modules.volume.getVolume();
      }
    } catch (e) {}
    updateVolumeUI(sysVolume);
  }

  function handleVolumeFromSystem(volume) {
    if (volume === undefined || volume === null) return;
    const vol = parseInt(volume, 10);
    if (!isNaN(vol) && vol >= 0 && vol <= 100 && vol !== currentVolume) {
      updateVolumeUI(vol);
    }
  }

  function updateMusicInfo(data) {
    if (typeof data === "string") data = JSON.parse(data);
    if (titleEl) titleEl.textContent = data.SongName || "—";
    if (artistEl) artistEl.textContent = data.SongArtist || "";
    if (imgEl && data.SongAlbumPicture) imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;

    let dur = parseFloat(data.Trdur) || 0;
    let pos = parseFloat(data.Trpos) || 0;
    if (dur < 1000 && dur > 0) dur *= 1000;
    if (pos < 1000 && pos > 0) pos *= 1000;
    trackDuration = dur;
    trackPosition = Math.min(pos, trackDuration);
    positionTimestamp = Date.now();
    updateProgressUI(trackPosition, trackDuration);

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

  function init() {
    document.getElementById("player__prev")?.addEventListener("click", () => android.runEnum("MEDIA_BLACK"));
    document.getElementById("player__next")?.addEventListener("click", () => android.runEnum("MEDIA_NEXT"));
    if (playBtn) playBtn.addEventListener("click", onPlayPauseClick);
    if (pauseBtn) pauseBtn.addEventListener("click", onPlayPauseClick);
    if (trackLine) {
      trackLine.addEventListener("click", onProgressClick);
      trackLine.addEventListener("touchstart", onProgressClick);
    }
    initVolumeSlider();
    if (modules.volume && modules.volume.subscribe) {
      modules.volume.subscribe(handleVolumeFromSystem);
    }
    renderPlayState();
    android.requestMusicState();
    setTimeout(() => { if (!playStateKnown) android.requestMusicState(); }, 400);
    setTimeout(() => { if (!playStateKnown) android.requestMusicState(); }, 1200);
  }

  return { updateMusicInfo, init, handleVolumeFromSystem };
})();