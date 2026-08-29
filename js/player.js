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
  upNext: [],        // cola manual: "agregar a la cola" desde cualquier carpeta
  overrideTrack: null, // canción de la cola sonando ahora mismo, fuera de la playlist activa
};

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function currentTrack() {
  if (Player.overrideTrack) return Player.overrideTrack;
  if (!Player.playlist || Player.index < 0) return null;
  return Player.playlist.tracks[Player.index] || null;
}

function playPlaylistAt(playlist, index) {
  Player.playlist = playlist;
  Player.index = index;
  Player.shuffleBag = [];
  Player.overrideTrack = null;
  loadAndPlayCurrent();
}

/** Agrega una canción al final de la cola manual ("Reproducir después"). */
function addToQueue(track) {
  Player.upNext.push(track);
  emit("zm:queuechange", {});
}

/** Reproduce de inmediato un elemento concreto de la cola manual (y lo quita de ahí). */
function playQueueItemAt(index) {
  const [track] = Player.upNext.splice(index, 1);
  if (!track) return;
  Player.overrideTrack = track;
  loadAndPlayCurrent();
  emit("zm:queuechange", {});
}

function loadAndPlayCurrent() {
  const track = currentTrack();
  if (!track) return;
  audioEl.src = track.url;
  audioEl.play().catch(() => {});
  emit("zm:trackchange", { track, playlist: Player.playlist });
  updateMediaSession(track);
}

/* ============ Media Session API ============ */
// Controles en pantalla de bloqueo / notificación de Android / audífonos.
function updateMediaSession(track) {
  if (!("mediaSession" in navigator)) return;
  const coverMime = track.cover ? (track.cover.match(/^data:([^;]+);/) || [])[1] || "image/jpeg" : null;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || track.filename,
    artist: track.artist || "",
    album: track.album && track.album !== "—" ? track.album : "",
    artwork: track.cover ? [
      { src: track.cover, sizes: "512x512", type: coverMime },
    ] : [],
  });
}

function setupMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", () => audioEl.play().catch(() => {}));
  navigator.mediaSession.setActionHandler("pause", () => audioEl.pause());
  navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  navigator.mediaSession.setActionHandler("nexttrack", () => next(false));
  try {
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) audioEl.currentTime = details.seekTime;
    });
  } catch (e) { /* algunos navegadores no soportan seekto */ }
}
setupMediaSessionHandlers();

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
  // La cola manual ("agregar a la cola") siempre tiene prioridad: se toca
  // entera antes de continuar con la carpeta activa, sin tocar su índice.
  if (Player.upNext.length) {
    Player.overrideTrack = Player.upNext.shift();
    loadAndPlayCurrent();
    emit("zm:queuechange", {});
    return;
  }
  Player.overrideTrack = null;

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

audioEl.addEventListener("play", () => {
  emit("zm:playstate", { playing: true });
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
});
audioEl.addEventListener("pause", () => {
  emit("zm:playstate", { playing: false });
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});
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
