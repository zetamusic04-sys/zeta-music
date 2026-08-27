// ==========================================================================
// utils.js — helpers pequeños compartidos entre módulos
// ==========================================================================

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'weba'];
const AUDIO_EXT_RE = new RegExp(`\\.(${AUDIO_EXTENSIONS.join('|')})$`, 'i');

export function isAudioFileName(name) {
  return AUDIO_EXT_RE.test(name);
}

export function isAudioFile(file) {
  return (file.type && file.type.startsWith('audio/')) || isAudioFileName(file.name);
}

export function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "mi-cancion-favorita" -> "Mi Cancion Favorita" (para nombrar playlists a partir de una carpeta) */
export function titleCaseFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}
