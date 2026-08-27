// ==========================================================================
// state.js
// Fuente única de verdad en memoria + persistencia en localStorage.
//
// Cada playlist puede ser:
//  - remota (pl.remotePath = "music/mi-carpeta"): descubierta escaneando el
//    repo de GitHub, o creada desde la app y ya materializada allí.
//  - local pura (pl.remotePath = null): creada en la app pero todavía no
//    subida a GitHub (solo existe en este navegador).
//
// Cada canción puede ser:
//  - remota (song.remotePath = "music/mi-carpeta/tema.mp3", song.local=false):
//    se reproduce desde esa ruta (mismo origen que la app en GitHub Pages).
//  - local (song.local = true, song.file = File, song.src = blob URL):
//    arrastrada por el usuario, solo dura esta sesión salvo que se suba.
//
// La metadata (título/artista/álbum) se cachea aparte (deck.metaCache) para
// no tener que re-leer los tags ID3 de cada canción en cada carga.
// ==========================================================================

import { titleCaseFromSlug } from './utils.js';

const LS_LIBRARY_KEY = 'deck.library.v2';
const LS_PREFS_KEY = 'deck.prefs.v1';
const LS_META_CACHE_KEY = 'deck.metaCache.v1';
const LS_GITHUB_KEY = 'deck.github.v1';

export const state = {
  library: { playlists: [] },
  currentPlaylistId: null,
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  volume: 0.8,
  searchTerm: '',
  github: { owner: '', repo: '', branch: 'main', token: '' },
  scanning: false,
};

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function stripExt(name) {
  return name.replace(/\.[a-z0-9]+$/i, '');
}

// -------------------------- carga inicial --------------------------------

export async function loadLibrary() {
  const saved = localStorage.getItem(LS_LIBRARY_KEY);
  if (saved) {
    try {
      state.library = JSON.parse(saved);
      if (!Array.isArray(state.library.playlists)) state.library.playlists = [];
      return { source: 'localStorage' };
    } catch (e) {
      console.warn('No se pudo leer la librería guardada, se recarga desde el repo.', e);
    }
  }
  try {
    const res = await fetch('data/library.json', { cache: 'no-store' });
    state.library = res.ok ? await res.json() : { playlists: [] };
  } catch (e) {
    state.library = { playlists: [] };
  }
  if (!Array.isArray(state.library.playlists)) state.library.playlists = [];
  persistLibrary();
  return { source: 'repo' };
}

export function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(LS_PREFS_KEY) || '{}');
    if (typeof prefs.volume === 'number') state.volume = prefs.volume;
    if (typeof prefs.shuffle === 'boolean') state.shuffle = prefs.shuffle;
    if (prefs.repeat) state.repeat = prefs.repeat;
  } catch (e) { /* sin preferencias guardadas todavía */ }
}

export function persistPrefs() {
  localStorage.setItem(LS_PREFS_KEY, JSON.stringify({
    volume: state.volume, shuffle: state.shuffle, repeat: state.repeat,
  }));
}

// -------------------------- persistencia de la librería -----------------------

export function persistLibrary() {
  const toSave = {
    playlists: state.library.playlists.map(pl => ({
      id: pl.id,
      name: pl.name,
      remotePath: pl.remotePath || null,
      songs: pl.songs.filter(s => !s.local).map(s => ({
        id: s.id, title: s.title, artist: s.artist, album: s.album || '',
        src: s.src, cover: s.cover || '', remotePath: s.remotePath || null,
        duration: s.duration || null,
      })),
    })),
  };
  localStorage.setItem(LS_LIBRARY_KEY, JSON.stringify(toSave));
  return toSave;
}

export function exportLibraryJSON() {
  return JSON.stringify(persistLibrary(), null, 2);
}

export function replaceLibrary(newLibrary) {
  state.library = newLibrary && Array.isArray(newLibrary.playlists)
    ? newLibrary
    : { playlists: [] };
  persistLibrary();
}

// -------------------------- consultas --------------------------------------

export function getPlaylist(id) {
  return state.library.playlists.find(p => p.id === id) || null;
}

export function getCurrentPlaylist() {
  return getPlaylist(state.currentPlaylistId);
}

// -------------------------- CRUD playlists ----------------------------------

export function createPlaylist(name) {
  const pl = { id: 'pl-' + uid(), name: name.trim() || 'Sin nombre', songs: [], remotePath: null };
  state.library.playlists.push(pl);
  persistLibrary();
  return pl;
}

export function deletePlaylist(id) {
  state.library.playlists = state.library.playlists.filter(p => p.id !== id);
  persistLibrary();
  if (state.currentPlaylistId === id) state.currentPlaylistId = null;
}

export function renamePlaylist(id, name) {
  const pl = getPlaylist(id);
  if (!pl) return;
  pl.name = name.trim() || pl.name;
  persistLibrary();
}

export function setPlaylistRemotePath(id, remotePath) {
  const pl = getPlaylist(id);
  if (!pl) return;
  pl.remotePath = remotePath;
  persistLibrary();
}

// -------------------------- CRUD canciones -----------------------------------

export function addLocalFilesToPlaylist(playlistId, fileList) {
  const pl = getPlaylist(playlistId);
  if (!pl) return [];
  const added = [];
  for (const file of fileList) {
    const song = {
      id: 'song-' + uid(),
      title: stripExt(file.name),
      artist: '',
      album: '',
      src: URL.createObjectURL(file),
      cover: '',
      local: true,
      file,
      remotePath: null,
    };
    pl.songs.push(song);
    added.push(song);
  }
  return added;
}

export function removeSong(playlistId, songId) {
  const pl = getPlaylist(playlistId);
  if (!pl) return;
  const song = pl.songs.find(s => s.id === songId);
  if (song && song.local && song.src) URL.revokeObjectURL(song.src);
  pl.songs = pl.songs.filter(s => s.id !== songId);
  persistLibrary();
}

export function reorderSongs(playlistId, fromIndex, toIndex) {
  const pl = getPlaylist(playlistId);
  if (!pl) return;
  const songs = pl.songs;
  if (fromIndex < 0 || fromIndex >= songs.length) return;
  const [moved] = songs.splice(fromIndex, 1);
  songs.splice(Math.max(0, Math.min(toIndex, songs.length)), 0, moved);
  persistLibrary();
}

/** Marca una canción local como subida: pasa a tener una ruta remota real y persiste. */
export function markSongUploaded(playlistId, songId, remotePath) {
  const pl = getPlaylist(playlistId);
  if (!pl) return;
  const song = pl.songs.find(s => s.id === songId);
  if (!song) return;
  if (song.src && song.local) URL.revokeObjectURL(song.src);
  song.local = false;
  delete song.file;
  song.src = remotePath;
  song.remotePath = remotePath;
  persistLibrary();
}

/** Aplica metadata (de ID3 o de la caché) a una canción ya presente en la librería. */
export function applySongMetadata(songId, meta) {
  let touched = false;
  for (const pl of state.library.playlists) {
    const song = pl.songs.find(s => s.id === songId);
    if (song) {
      if (meta.title) { song.title = meta.title; touched = true; }
      if (meta.artist) { song.artist = meta.artist; touched = true; }
      if (meta.album) { song.album = meta.album; touched = true; }
      if (meta.duration) { song.duration = meta.duration; touched = true; }
      if (meta.cover) { song.cover = meta.cover; }
      break;
    }
  }
  if (touched) persistLibrary();
  return touched;
}

// -------------------------- caché de metadata (ID3) ---------------------------

let metaCache = null;
function loadMetaCache() {
  if (metaCache) return metaCache;
  try { metaCache = JSON.parse(localStorage.getItem(LS_META_CACHE_KEY) || '{}'); }
  catch (e) { metaCache = {}; }
  return metaCache;
}

export function getCachedMeta(path) {
  return loadMetaCache()[path] || null;
}

export function setCachedMeta(path, meta) {
  const cache = loadMetaCache();
  cache[path] = meta;
  try { localStorage.setItem(LS_META_CACHE_KEY, JSON.stringify(cache)); }
  catch (e) { /* localStorage lleno: seguimos sin cachear, no es crítico */ }
}

// -------------------------- integrar resultado de escaneo ---------------------

/**
 * Recibe el resultado de github.scanMusicFolder() y actualiza
 * state.library.playlists: crea playlists nuevas, sincroniza canciones
 * (conserva el orden manual existente, agrega las nuevas, quita las que
 * ya no están en el repo), y conserva las playlists puramente locales.
 */
export function applyScanResult(scannedFolders) {
  const existingByPath = new Map(
    state.library.playlists.filter(p => p.remotePath).map(p => [p.remotePath, p])
  );

  const newList = [];
  for (const folder of scannedFolders) {
    const existing = existingByPath.get(folder.folderPath);
    const knownPaths = new Set(folder.files.map(f => f.path));

    const songs = [];
    if (existing) {
      for (const s of existing.songs) {
        if (knownPaths.has(s.remotePath)) songs.push(s);
      }
    }
    const alreadyPresent = new Set(songs.map(s => s.remotePath));
    for (const f of folder.files) {
      if (alreadyPresent.has(f.path)) continue;
      const cached = getCachedMeta(f.path);
      songs.push({
        id: f.path,
        title: (cached && cached.title) || stripExt(f.name),
        artist: (cached && cached.artist) || '',
        album: (cached && cached.album) || '',
        duration: (cached && cached.duration) || null,
        src: f.path,
        cover: '',
        local: false,
        remotePath: f.path,
      });
    }

    newList.push({
      id: existing ? existing.id : folder.folderPath,
      name: existing ? existing.name : titleCaseFromSlug(folder.folderName),
      songs,
      remotePath: folder.folderPath,
    });
  }

  const localOnly = state.library.playlists.filter(p => !p.remotePath);
  state.library.playlists = [...newList, ...localOnly];
  persistLibrary();
}

// -------------------------- GitHub config -----------------------------------

export function loadGithubConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_GITHUB_KEY) || 'null');
    if (saved) state.github = { branch: 'main', ...saved };
  } catch (e) { /* nada guardado todavía */ }
}

export function saveGithubConfig(cfg) {
  state.github = cfg;
  localStorage.setItem(LS_GITHUB_KEY, JSON.stringify(cfg));
}

export function clearGithubConfig() {
  state.github = { owner: '', repo: '', branch: 'main', token: '' };
  localStorage.removeItem(LS_GITHUB_KEY);
}
