// ============ Zeta Music — escáner de GitHub ============
// Usa la API pública de contenidos de GitHub para "ver" las carpetas
// y archivos del repo sin necesidad de mantener JSON manuales.
// https://api.github.com/repos/{owner}/{repo}/contents/{path}

const ZM_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function ghApi(path, cfg) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`;
  const cacheKey = "zm_gh_cache_" + url;
  const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
  if (cached && Date.now() - cached.t < ZM_CACHE_TTL) return cached.data;

  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Límite de la API de GitHub alcanzado. Intenta de nuevo en unos minutos.");
    if (res.status === 404) throw new Error(`No se encontró la carpeta "${path}" en ${cfg.owner}/${cfg.repo}@${cfg.branch}.`);
    throw new Error(`Error de GitHub (${res.status})`);
  }
  const data = await res.json();
  sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data }));
  return data;
}

function rawUrl(cfg, path) {
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;
}

/**
 * Escanea la carpeta raíz de música: cada subcarpeta = una playlist.
 * Si la raíz misma contiene archivos de audio sueltos, se agrupan en "Música".
 */
async function scanGithubLibrary(cfg, onProgress) {
  if (!cfg.owner || !cfg.repo) {
    throw new Error("Configura tu usuario y repositorio de GitHub en Ajustes.");
  }
  const root = await ghApi(cfg.musicPath, cfg);
  const folders = root.filter(e => e.type === "dir");
  const looseAudio = root.filter(e => e.type === "file" && isAudioFile(e.name));

  const playlists = [];

  if (looseAudio.length) {
    playlists.push(buildPlaylistFromEntries("Música", cfg.musicPath, root, cfg));
  }

  for (const folder of folders) {
    onProgress && onProgress(`Leyendo "${folder.name}"…`);
    const entries = await ghApi(`${cfg.musicPath}/${folder.name}`, cfg);
    if (!entries.some(e => e.type === "file" && isAudioFile(e.name))) continue;
    playlists.push(buildPlaylistFromEntries(folder.name, `${cfg.musicPath}/${folder.name}`, entries, cfg));
  }

  return playlists;
}

function basenameNoExt(filename) {
  return filename.replace(/\.[^/.]+$/, "").toLowerCase();
}

/**
 * Construye una playlist a partir de TODOS los archivos de una carpeta
 * (no sólo audio): así puede emparejar cada canción con una letra
 * (.lrc o .txt) que tenga el mismo nombre de archivo, si existe.
 */
function buildPlaylistFromEntries(name, path, allEntries, cfg) {
  const audioEntries = allEntries.filter(e => e.type === "file" && isAudioFile(e.name));
  const lyricEntries = allEntries.filter(e => e.type === "file" && /\.(lrc|txt)$/i.test(e.name));
  const lyricsByBase = new Map(lyricEntries.map(e => [basenameNoExt(e.name), e]));

  const tracks = audioEntries.map(e => {
    const lyricMatch = lyricsByBase.get(basenameNoExt(e.name));
    return {
      id: `${path}/${e.name}`,
      filename: e.name,
      url: rawUrl(cfg, `${path}/${e.name}`),
      lyricsUrl: lyricMatch ? rawUrl(cfg, `${path}/${lyricMatch.name}`) : null,
      title: null, artist: null, album: null, cover: null, duration: null, lyrics: null,
      looksEncoded: /%[0-9A-Fa-f]{2}/.test(e.name),
    };
  });

  return { id: path, name, source: "github", path, tracks };
}
