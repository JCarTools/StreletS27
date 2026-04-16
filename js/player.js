/**********************************************
 * Модуль: Плеер (управление, прогресс, громкость)
 **********************************************/

modules.player = (function() {
  const titleEl = document.querySelector(".widget_player__title");
  const artistEl = document.querySelector(".widget_player__artist");
  const imgEl = document.querySelector(".widget_player__image img");
  const progressEl = document.querySelector(".widget_player__track_progress");
  const timeSpans = document.querySelectorAll(".widget_player__track_time span");
  const playBtn = document.getElementById("player__play");
  const pauseBtn = document.getElementById("player__pause");
  const volumeSlider = document.getElementById("volumeSlider");
  let volumeChangeTimer = null;

  function updateMusicInfo(data) {
    if (typeof data === "string") data = JSON.parse(data);
    if (titleEl) titleEl.textContent = data.SongName || "—";
    if (artistEl) artistEl.textContent = data.SongArtist || "";
    if (imgEl && data.SongAlbumPicture) imgEl.src = "data:image/png;base64," + data.SongAlbumPicture;
    const pos = parseFloat(data.Trpos||0), dur = parseFloat(data.Trdur||1);
    let percent = (pos / dur) * 100;
    if (dur === Infinity || dur > 86400000) percent = 0;
    if (progressEl) progressEl.style.width = Math.min(percent, 100) + "%";
    const format = t => { const m = Math.floor(t/60000), s = Math.floor((t%60000)/1000); return m+":"+String(s).padStart(2,'0'); };
    if (timeSpans.length >= 2) {
      timeSpans[0].textContent = format(pos);
      timeSpans[1].textContent = (dur === Infinity || dur > 86400000) ? "∞" : format(dur);
    }
    const playing = data.IsPlaying === true;
    if (playBtn) playBtn.style.display = playing ? "none" : "flex";
    if (pauseBtn) pauseBtn.style.display = playing ? "flex" : "none";
  }

  function handleVolumeChange() {
    const volume = parseInt(volumeSlider.value, 10);
    storage.save('player_volume', volume);
    if (volumeChangeTimer) clearTimeout(volumeChangeTimer);
    volumeChangeTimer = setTimeout(() => android.setVolume(volume), 100);
  }

  function init() {
    document.getElementById("player__prev")?.addEventListener("click", ()=> android.runEnum("MEDIA_BLACK"));
    document.getElementById("player__next")?.addEventListener("click", ()=> android.runEnum("MEDIA_NEXT"));
    playBtn?.addEventListener("click", ()=>{ android.runEnum("MEDIA_PLAY"); playBtn.style.display="none"; pauseBtn.style.display="flex"; });
    pauseBtn?.addEventListener("click", ()=>{ android.runEnum("MEDIA_PAUSE"); pauseBtn.style.display="none"; playBtn.style.display="flex"; });

    if (volumeSlider) {
      const savedVolume = storage.load('player_volume');
      if (savedVolume !== null) volumeSlider.value = savedVolume;
      volumeSlider.addEventListener('input', handleVolumeChange);
    }
  }

  return { updateMusicInfo, init };
})();