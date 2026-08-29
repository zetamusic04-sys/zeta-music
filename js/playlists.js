// ============ Zeta Music — playlists ============
// Cada subcarpeta escaneada es una "playlist". El orden de las canciones
// dentro de cada una se guarda en localStorage (arrastrar y soltar), y los
// metadatos leídos se cachean ahí también para no re-descargarlos siempre.

const ZM = {
  playlists: [],
  source: null, // "github" | "local"
  metaCache: loadMetaCache(),
  favorites: loadFavoritesSet(),
};

function loadFavoritesSet() {
  try { return new Set(JSON.parse(localStorage.getItem("zm_favorites") || "[]")); }
  catch (e) { return new Set(); }
}
function saveFavoritesSet() {
  try { localStorage.setItem("zm_favorites", JSON.stringify(Array.from(ZM.favorites))); }
  catch (e) { /* cuota llena */ }
}
function isFavorite(trackId) {
  return ZM.favorites.has(trackId);
}
/** Agrega/quita una canción de favoritos. Devuelve el nuevo estado. */
function toggleFavorite(trackId) {
  if (ZM.favorites.has(trackId)) ZM.favorites.delete(trackId);
  else ZM.favorites.add(trackId);
  saveFavoritesSet();
  return ZM.favorites.has(trackId);
}
function favoriteTracksList() {
  return allTracksFlat().filter(t => ZM.favorites.has(t.id));
}

function loadMetaCache() {
  try { return JSON.parse(localStorage.getItem("zm_meta_cache") || "{}"); }
  catch (e) { return {}; }
}
function saveMetaCache() {
  try { localStorage.setItem("zm_meta_cache", JSON.stringify(ZM.metaCache)); }
  catch (e) { /* cuota llena: seguimos sin cachear */ }
}
function clearMetaCache() {
  ZM.metaCache = {};
  localStorage.removeItem("zm_meta_cache");
}

function getSavedOrder(playlistId) {
  try { return JSON.parse(localStorage.getItem("zm_order_" + playlistId) || "null"); }
  catch (e) { return null; }
}
function setSavedOrder(playlistId, idsArray) {
  localStorage.setItem("zm_order_" + playlistId, JSON.stringify(idsArray));
}

function applySavedOrder(playlist) {
  const saved = getSavedOrder(playlist.id);
  if (!saved) return;
  const byId = new Map(playlist.tracks.map(t => [t.id, t]));
  const ordered = saved.map(id => byId.get(id)).filter(Boolean);
  const remaining = playlist.tracks.filter(t => !saved.includes(t.id));
  playlist.tracks = [...ordered, ...remaining];
}

function persistOrder(playlist) {
  setSavedOrder(playlist.id, playlist.tracks.map(t => t.id));
}

/** Mueve una canción de una posición a otra dentro de su playlist y guarda el orden. */
function reorderPlaylistTrack(playlist, fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [moved] = playlist.tracks.splice(fromIndex, 1);
  playlist.tracks.splice(toIndex, 0, moved);
  persistOrder(playlist);
}

/** Carga la biblioteca completa desde GitHub o desde una carpeta local. */
async function loadLibrary(mode, onProgress) {
  const cfg = getConfig();
  let playlists;
  if (mode === "local") {
    playlists = await scanLocalLibrary();
    ZM.source = "local";
  } else {
    playlists = await scanGithubLibrary(cfg, onProgress);
    ZM.source = "github";
  }
  playlists.forEach(applySavedOrder);
  ZM.playlists = playlists;
  return playlists;
}

/** Lee metadatos (título, artista, álbum, portada) de todas las canciones de una playlist,
 *  usando la caché cuando existe, y llama a onTrackReady tras cada una. */
async function hydratePlaylistMetadata(playlist, onTrackReady) {
  for (const track of playlist.tracks) {
    if (track.title) { onTrackReady && onTrackReady(track); continue; }

    const cached = ZM.metaCache[track.id];
    if (cached) {
      Object.assign(track, cached);
      onTrackReady && onTrackReady(track);
      continue;
    }

    try {
      const meta = await readAudioMetadata(track.fileRef || track.url, track.filename);
      Object.assign(track, meta);
      ZM.metaCache[track.id] = meta;
      saveMetaCache();
    } catch (e) {
      Object.assign(track, { title: track.filename, artist: "Artista desconocido", album: "—", cover: null });
    }
    onTrackReady && onTrackReady(track);
  }
}

function findPlaylist(id) {
  return ZM.playlists.find(p => p.id === id) || null;
}

function allTracksFlat() {
  return ZM.playlists.flatMap(p => p.tracks.map(t => ({ ...t, playlistId: p.id, playlistName: p.name })));
}

function exportPlaylistOrder(playlist) {
  const data = { playlist: playlist.name, path: playlist.path, order: playlist.tracks.map(t => t.filename) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${playlist.name.replace(/[^\w\-]+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importPlaylistOrder(playlist, jsonData) {
  if (!jsonData || !Array.isArray(jsonData.order)) throw new Error("Archivo de orden inválido.");
  const byName = new Map(playlist.tracks.map(t => [t.filename, t]));
  const ordered = jsonData.order.map(name => byName.get(name)).filter(Boolean);
  const remaining = playlist.tracks.filter(t => !jsonData.order.includes(t.filename));
  playlist.tracks = [...ordered, ...remaining];
  persistOrder(playlist);
}
