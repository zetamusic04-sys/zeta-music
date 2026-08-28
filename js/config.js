// ============ Zeta Music — configuración ============
// Valores por defecto. El usuario puede sobreescribirlos desde
// la vista "Ajustes" dentro de la app (se guardan en localStorage),
// así que puedes dejar esto tal cual y configurar todo desde la UI,
// o rellenarlo aquí para que ya venga listo al abrir la app.

const DEFAULT_CONFIG = {
  owner: "zetamusic04-sys", // usuario u organización de GitHub
  repo: "zeta-music",        // nombre del repositorio
  branch: "main",            // rama donde están subidas las canciones
  musicPath: "music"         // carpeta raíz del repo donde viven las playlists (subcarpetas)
};

const AUDIO_EXTENSIONS = ["mp3", "flac", "ogg", "oga", "wav", "m4a", "aac", "opus", "weba"];

function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem("zm_config") || "null");
    if (saved) return normalizeConfig({ ...DEFAULT_CONFIG, ...saved });
  } catch (e) { /* ignore corrupt config */ }
  return normalizeConfig({ ...DEFAULT_CONFIG });
}

// Quita barras sobrantes en owner/repo/branch/musicPath para que nunca
// se generen URLs con "//" (esto rompía la reproducción en desktop
// cuando alguien guardaba, por ejemplo, "music/" con la barra al final).
function normalizeConfig(cfg) {
  const strip = (s) => (s || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return {
    owner: strip(cfg.owner),
    repo: strip(cfg.repo),
    branch: strip(cfg.branch) || "main",
    musicPath: strip(cfg.musicPath) || "music",
  };
}

function saveConfig(cfg) {
  localStorage.setItem("zm_config", JSON.stringify(normalizeConfig(cfg)));
}

function isAudioFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}
