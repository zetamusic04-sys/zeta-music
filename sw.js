// ============ Zeta Music — service worker ============
// Sólo cachea el "app shell" (HTML/CSS/JS/íconos). Las canciones NO se
// cachean aquí a propósito: son archivos grandes y suelen venir de
// raw.githubusercontent.com, así que se piden siempre en directo.

const CACHE_NAME = "zeta-music-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/id3.js",
  "./js/github-scanner.js",
  "./js/local-scanner.js",
  "./js/playlists.js",
  "./js/player.js",
  "./js/ui.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a la API/CDN de GitHub ni audio: siempre en vivo.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
