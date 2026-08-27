// ==========================================================================
// github.js
// Todo lo que habla con la API de contenidos de GitHub
// (https://docs.github.com/rest/repos/contents), llamada directamente
// desde el navegador con fetch(). No hay backend propio.
//
// Dos modos:
//  - LECTURA (listar/escanear música): funciona sin token en repos públicos
//    (límite ~60 peticiones/hora por IP; con token, 5000/hora).
//  - ESCRITURA (subir canciones, crear carpetas, guardar el caché del
//    catálogo): requiere el token que el usuario pega en Ajustes.
//
// Límite importante: subir archivos vía este endpoint es práctico hasta
// ~25MB. Para archivos más grandes hay que usar la Git Data API (blobs) o
// git normal — fuera del alcance de este módulo.
// ==========================================================================

import { state } from './state.js';
import { isAudioFileName } from './utils.js';

const MAX_BYTES = 25 * 1024 * 1024;

function apiUrl(path) {
  const { owner, repo } = state.github;
  const cleanPath = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
}

function authHeaders(extra = {}) {
  const headers = { Accept: 'application/vnd.github+json', ...extra };
  if (state.github.token) headers.Authorization = `Bearer ${state.github.token}`;
  return headers;
}

export function hasRepoConfigured() {
  return Boolean(state.github.owner && state.github.repo);
}

export function isGithubConfigured() {
  return Boolean(state.github.owner && state.github.repo && state.github.token);
}

async function describeError(res) {
  let body = {};
  try { body = await res.json(); } catch (e) { /* respuesta sin cuerpo JSON */ }
  if (res.status === 401) return 'Token inválido o vencido.';
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') return 'Se agotó el límite de peticiones a la API de GitHub por esta hora. Prueba de nuevo más tarde, o añade un token en Ajustes (sube el límite a 5000/hora).';
    return body.message || 'Sin permiso: revisa el alcance del token.';
  }
  if (res.status === 404) return 'Repositorio, rama o ruta no encontrada.';
  if (res.status === 409) return 'Conflicto: el archivo cambió en GitHub mientras tanto. Vuelve a intentarlo.';
  return body.message || `Error ${res.status} al hablar con la API de GitHub.`;
}

/** Lista el contenido de un directorio del repo. Devuelve [] si no existe todavía. */
export async function listDirectory(path) {
  const branch = state.github.branch || 'main';
  const res = await fetch(`${apiUrl(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await describeError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function getFileSha(path) {
  const branch = state.github.branch || 'main';
  const res = await fetch(`${apiUrl(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(),
  });
  if (res.status === 200) return (await res.json()).sha;
  if (res.status === 404) return null;
  throw new Error(await describeError(res));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo en el navegador.'));
    reader.readAsDataURL(file);
  });
}

function textToBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function putContent(path, base64Content, message) {
  const branch = state.github.branch || 'main';
  const sha = await getFileSha(path);
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, content: base64Content, branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(await describeError(res));
  return res.json();
}

/** Sube un archivo binario (audio o portada) a la ruta dada del repo. Requiere token. */
export async function uploadBinaryFile(path, file, message) {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `"${file.name}" pesa más de 25MB. La API de contenidos de GitHub no admite subidas` +
      ' así de grandes desde el navegador — súbelo con git (o Git LFS) en su lugar.'
    );
  }
  const base64 = await fileToBase64(file);
  return putContent(path, base64, message);
}

/** Crea o actualiza un archivo de texto (usado para data/library.json). Requiere token. */
export async function uploadTextFile(path, text, message) {
  return putContent(path, textToBase64(text), message);
}

/** Materializa una carpeta vacía en git subiendo un .gitkeep (git no versiona carpetas vacías). Requiere token. */
export async function createRemoteFolder(folderPath, message) {
  return putContent(`${folderPath}/.gitkeep`, textToBase64(''), message);
}

/**
 * Escanea `rootPath` (por defecto "music") y arma la lista de playlists:
 * cada subcarpeta es una playlist, cada archivo de audio dentro es una
 * canción. No requiere token en repos públicos. No lee metadata ID3 aquí
 * (eso se hace aparte, de forma perezosa) — solo descubre la estructura.
 */
export async function scanMusicFolder(rootPath = 'music') {
  const entries = await listDirectory(rootPath);
  const folders = entries.filter(e => e.type === 'dir');

  const playlists = [];
  for (const folder of folders) {
    let files = [];
    try {
      files = await listDirectory(folder.path);
    } catch (e) {
      continue; // carpeta ilegible (permisos/rate-limit puntual): se omite, no rompe el resto
    }
    const songs = files
      .filter(f => f.type === 'file' && isAudioFileName(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map(f => ({
        path: f.path,          // ruta relativa dentro del repo, ej. "music/mi-carpeta/01 - tema.mp3"
        name: f.name,
      }));

    playlists.push({ folderName: folder.name, folderPath: folder.path, files: songs });
  }
  return playlists;
}

export function repoUrl() {
  const { owner, repo, branch } = state.github;
  return `https://github.com/${owner}/${repo}/tree/${branch || 'main'}`;
}
