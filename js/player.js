// ============ Zeta Music — reproductor ============
// Envuelve el elemento <audio> y maneja cola, orden aleatorio y repetición.
// Se comunica con la interfaz mediante CustomEvents en document, así
// player.js e ui.js quedan desacoplados.

const audioEl = document.getElementById("audio");

const Player = {
  playlist: null,
  index: -1,
  shuffle: false,
  repeat: "off", // off | all | one
  shuffleBag: [],
};

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function currentTrack() {
  if (!Player.playlist || Player.index < 0) return null;
  return Player.playlist.tracks[Player.index] || null;
}

function playPlaylistAt(playlist, index) {
  Player.playlist = playlist;
  Player.index = index;
  Player.shuffleBag = [];
  loadAndPlayCurrent();
}

function loadAndPlayCurrent() {
  const track = currentTrack();
  if (!track) return;
  audioEl.src = track.url;
  audioEl.play().catch(() => {});
  emit("zm:trackchange", { track, playlist: Player.playlist });
}

function togglePlay() {
  if (!currentTrack()) return;
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
}

function pickNextShuffleIndex() {
  const n = Player.playlist.tracks.length;
  if (Player.shuffleBag.length === 0) {
    Player.shuffleBag = Array.from({ length: n }, (_, i) => i).filter(i => i !== Player.index);
    for (let i = Player.shuffleBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [Player.shuffleBag[i], Player.shuffleBag[j]] = [Player.shuffleBag[j], Player.shuffleBag[i]];
    }
  }
  return Player.shuffleBag.length ? Player.shuffleBag.pop() : Player.index;
}

function next(auto = false) {
  if (!Player.playlist) return;
  const n = Player.playlist.tracks.length;
  if (!n) return;

  if (auto && Player.repeat === "one") { loadAndPlayCurrent(); return; }

  if (Player.shuffle) {
    Player.index = pickNextShuffleIndex();
  } else if (Player.index < n - 1) {
    Player.index++;
  } else if (Player.repeat === "all") {
    Player.index = 0;
  } else if (auto) {
    emit("zm:playstate", { playing: false });
    return; // fin de la cola
  } else {
    Player.index = 0;
  }
  loadAndPlayCurrent();
}

function prev() {
  if (!Player.playlist) return;
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  const n = Player.playlist.tracks.length;
  Player.index = Player.index > 0 ? Player.index - 1 : (Player.repeat === "all" ? n - 1 : 0);
  loadAndPlayCurrent();
}

function toggleShuffle() {
  Player.shuffle = !Player.shuffle;
  Player.shuffleBag = [];
  emit("zm:shufflechange", { shuffle: Player.shuffle });
}

function cycleRepeat() {
  Player.repeat = Player.repeat === "off" ? "all" : Player.repeat === "all" ? "one" : "off";
  emit("zm:repeatchange", { repeat: Player.repeat });
}

function seekTo(fraction) {
  if (!audioEl.duration) return;
  audioEl.currentTime = fraction * audioEl.duration;
}

function setVolume(v) {
  audioEl.volume = Math.min(1, Math.max(0, v));
}

audioEl.addEventListener("play", () => emit("zm:playstate", { playing: true }));
audioEl.addEventListener("pause", () => emit("zm:playstate", { playing: false }));
audioEl.addEventListener("ended", () => next(true));
const MEDIA_ERROR_NAMES = { 1: "ABORTED", 2: "NETWORK", 3: "DECODE", 4: "SRC_NOT_SUPPORTED" };

audioEl.addEventListener("error", () => {
  const track = currentTrack();
  if (!track) return;
  const err = audioEl.error;
  const codeName = err ? (MEDIA_ERROR_NAMES[err.code] || `código ${err.code}`) : "desconocido";
  console.warn(`Zeta Music: no se pudo cargar "${track.filename}" (${codeName}) — saltando a la siguiente.`);
  console.warn("URL que falló:", track.url);
  if (codeName === "NETWORK" || codeName === "SRC_NOT_SUPPORTED") {
    console.warn("Sugerencia: abre esa URL directo en una pestaña nueva. Si ahí tampoco carga, probablemente algo en el navegador/red (bloqueador de anuncios, antivirus, firewall) está filtrando raw.githubusercontent.com.");
  }
  emit("zm:trackerror", { track });
  next(true);
});
audioEl.addEventListener("timeupdate", () => emit("zm:timeupdate", { current: audioEl.currentTime, duration: audioEl.duration || 0 }));
audioEl.addEventListener("loadedmetadata", () => {
  const track = currentTrack();
  if (track) track.duration = audioEl.duration;
  emit("zm:timeupdate", { current: audioEl.currentTime, duration: audioEl.duration || 0 });
});
