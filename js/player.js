/**********************************************
 * Модуль: Плеер (исправленный слайдер громкости)
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
  const volumeBtn = document.getElementById("player__volume");
  const volumeSlider = document.getElementById("player__volume_slider");
  const volumeFill = document.getElementById("player__volume_fill");
  const volumeValue = document.getElementById("player__volume_value");
  
  // Состояние
  let isPlaying = true;
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
  
  function applyPlayState(playing) {
    if (playing === isPlaying) return;
    isPlaying = playing;
    if (playBtn && pauseBtn) {
      playBtn.style.display = isPlaying ? "none" : "flex";
      pauseBtn.style.display = isPlaying ? "flex" : "none";
    }
    if (isPlaying) startProgressTick();
    else stopProgressTick();
  }
  
  function onPlayPauseClick() {
    const cmd = isPlaying ? "MEDIA_PAUSE" : "MEDIA_PLAY";
    if (typeof android.runEnum === 'function') android.runEnum(cmd);
    applyPlayState(!isPlaying);
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
    percent = Math.min(100, Math.max(0, percent));
    if (volumeFill) volumeFill.style.width = percent + "%";
    if (volumeValue) volumeValue.textContent = percent + "%";
    currentVolume = percent;
  }
  
  function setVolume(volume) {
    let vol = Math.min(100, Math.max(0, parseInt(volume)));
    if (isNaN(vol)) return;
    if (vol === currentVolume) return;
    
    android.setVolume(vol);
    updateVolumeUI(vol);
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
    
    const startDrag = (e) => {
      e.preventDefault();
      isDragging = true;
      let clientX = e.touches ? e.touches[0].clientX : e.clientX;
      if (clientX !== undefined) {
        const rect = volumeLine.getBoundingClientRect();
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.min(1, Math.max(0, percent));
        setVolume(Math.round(percent * 100));
      }
    };
    
    const onDrag = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      let clientX = e.touches ? e.touches[0].clientX : e.clientX;
      if (clientX !== undefined) {
        const rect = volumeLine.getBoundingClientRect();
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.min(1, Math.max(0, percent));
        setVolume(Math.round(percent * 100));
      }
    };
    
    const stopDrag = () => { isDragging = false; };
    
    volumeDot.addEventListener('mousedown', startDrag);
    volumeDot.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    volumeDot.addEventListener('touchmove', onDrag, { passive: false });
    volumeDot.addEventListener('touchend', stopDrag);
  }
  
  function initVolumeSlider() {
    if (!volumeSlider || !volumeBtn) return;
    
    // Кнопка открытия слайдера
    volumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      volumeSlider.classList.toggle('visible');
    });
    
    const volumeLine = volumeSlider.querySelector('.widget_player__volume_line');
    if (!volumeLine) return;
    
    volumeLine.addEventListener('click', onVolumeLineClick);
    volumeLine.addEventListener('touchstart', onVolumeLineClick, { passive: false });
    initVolumeSliderDrag(volumeLine);
    
    document.addEventListener('click', function hideSlider(e) {
      if (!volumeSlider) return;
      if (!volumeSlider.contains(e.target) && e.target !== volumeBtn) {
        volumeSlider.classList.remove('visible');
      }
    });
    
    // Начальная громкость
    let sysVolume = 50;
    try {
      if (modules.volume && typeof modules.volume.getVolume === 'function') {
        sysVolume = modules.volume.getVolume();
      } else {
        sysVolume = android.getVolume();
      }
    } catch(e) {}
    updateVolumeUI(sysVolume);
  }
  
  function handleVolumeFromSystem(volume) {
    if (volume !== undefined && volume !== null) {
      const vol = parseInt(volume);
      if (!isNaN(vol) && vol >= 0 && vol <= 100 && vol !== currentVolume) {
        updateVolumeUI(vol);
      }
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
    
    let newPlaying = data.IsPlaying === true || data.playState === true || data.playStat === true;
    if (newPlaying !== undefined) {
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
    applyPlayState(true);
    android.requestMusicState();
  }
  
  return { updateMusicInfo, init, handleVolumeFromSystem };
})();