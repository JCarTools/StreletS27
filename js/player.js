/**********************************************
 * Модуль: Плеер (управление, прогресс)
 * Логика: оптимистичный UI + синхронизация с Android
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
  
  // Состояние плеера
  let isPlaying = true;              // предполагаем, что музыка уже играет
  let trackDuration = 0;             // длительность в мс
  let trackPosition = 0;             // текущая позиция в мс
  let positionTimestamp = 0;         // время последнего обновления позиции (Date.now())
  let progressTimer = null;
  let pendingPlayState = null;       // ожидаемое состояние после нажатия
  let pendingTimer = null;
  
  // Форматирование времени
  function formatTime(ms) {
    if (ms === Infinity || ms > 86400000) return "∞";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + ":" + String(s).padStart(2, '0');
  }
  
  // Обновление прогресс-бара и времени
  function updateProgressUI(pos, dur) {
    const percent = dur > 0 ? Math.min(pos / dur * 100, 100) : 0;
    if (progressFill) progressFill.style.width = percent + "%";
    if (timeCurrentSpan) timeCurrentSpan.textContent = formatTime(pos);
    if (timeDurationSpan) timeDurationSpan.textContent = formatTime(dur);
  }
  
  // Запуск таймера прогресса (только когда играет)
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
  
  // Применение состояния воспроизведения (UI + таймер)
  function applyPlayState(playing) {
    if (playing === isPlaying) return;
    isPlaying = playing;
    if (playBtn && pauseBtn) {
      playBtn.style.display = isPlaying ? "none" : "flex";
      pauseBtn.style.display = isPlaying ? "flex" : "none";
    }
    if (isPlaying) {
      startProgressTick();
    } else {
      stopProgressTick();
    }
  }
  
  // Оптимистичное изменение UI при нажатии кнопки
  function optimisticSetPlaying(playing) {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingPlayState = playing;
    applyPlayState(playing);
    pendingTimer = setTimeout(() => {
      pendingPlayState = null;
      pendingTimer = null;
    }, 5000);
  }
  
  // Обработчик нажатия Play/Pause
  function onPlayPauseClick() {
    const cmd = isPlaying ? "MEDIA_PAUSE" : "MEDIA_PLAY";
    const expected = !isPlaying;
    if (typeof android.runEnum === 'function') android.runEnum(cmd);
    optimisticSetPlaying(expected);
  }
  
  // Обработчик клика по прогресс-бару (перемотка)
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
    // Оптимистично обновляем позицию
    trackPosition = newPos;
    positionTimestamp = Date.now();
    updateProgressUI(newPos, trackDuration);
  }
  
  // Обработчик событий от Android (musicInfo)
  function updateMusicInfo(data) {
    if (typeof data === "string") data = JSON.parse(data);
    
    if (titleEl) titleEl.textContent = data.SongName || "—";
    if (artistEl) artistEl.textContent = data.SongArtist || "";
    if (imgEl && data.SongAlbumPicture) imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;
    
    // Длительность и позиция (могут приходить в секундах или миллисекундах)
    let dur = parseFloat(data.Trdur) || 0;
    let pos = parseFloat(data.Trpos) || 0;
    if (dur < 1000 && dur > 0) dur *= 1000;
    if (pos < 1000 && pos > 0) pos *= 1000;
    trackDuration = dur;
    trackPosition = Math.min(pos, trackDuration);
    positionTimestamp = Date.now();
    updateProgressUI(trackPosition, trackDuration);
    
    // Статус воспроизведения
    let newPlaying = null;
    if (typeof data.IsPlaying === 'boolean') newPlaying = data.IsPlaying;
    else if (typeof data.playState === 'boolean') newPlaying = data.playState;
    else if (typeof data.playStat === 'boolean') newPlaying = data.playStat;
    
    if (newPlaying !== null) {
      // Если ожидаем подтверждение и состояние совпало – сбрасываем ожидание
      if (pendingPlayState !== null && newPlaying === pendingPlayState) {
        pendingPlayState = null;
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      applyPlayState(newPlaying);
    }
    
    // Перезапускаем таймер прогресса (на случай, если позиция обновилась)
    if (isPlaying) {
      stopProgressTick();
      startProgressTick();
    }
  }
  
  function init() {
    // Навигация
    document.getElementById("player__prev")?.addEventListener("click", () => {
      if (typeof android.runEnum === 'function') android.runEnum("MEDIA_BLACK");
    });
    document.getElementById("player__next")?.addEventListener("click", () => {
      if (typeof android.runEnum === 'function') android.runEnum("MEDIA_NEXT");
    });
    
    // Play / Pause
    if (playBtn) playBtn.addEventListener("click", onPlayPauseClick);
    if (pauseBtn) pauseBtn.addEventListener("click", onPlayPauseClick);
    
    // Прогресс-бар
    if (trackLine) {
      trackLine.addEventListener("click", onProgressClick);
      trackLine.addEventListener("touchstart", onProgressClick);
    }
    
    // Начальное состояние – играет (кнопка паузы видна)
    applyPlayState(true);
    
    // Запрашиваем текущее состояние у Android
    if (typeof android.requestMusicState === 'function') {
      android.requestMusicState();
    } else {
      // fallback: команда, которая может инициировать ответ
      if (typeof android.runEnum === 'function') android.runEnum("MEDIA_GET_STATUS");
    }
  }
  
  return { updateMusicInfo, init };
})();