// ============ Zeta Music — interfaz ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const UIState = {
  selectedPlaylistId: null,
  query: "",
};

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function trackIconOrCover(track, extraClass = "") {
  if (track.cover) return `<div class="track-thumb ${extraClass}"><img src="${track.cover}" alt=""></div>`;
  return `<div class="track-thumb ${extraClass}"><i class="ri-music-2-line"></i></div>`;
}

/* ============ Sidebar / navegación ============ */

function renderSidebarPlaylists() {
  const el = $("#playlist-list");
  if (!ZM.playlists.length) {
    el.innerHTML = `<div class="empty-hint">No hay carpetas todavía. Configura tu repo en Ajustes.</div>`;
    return;
  }
  el.innerHTML = ZM.playlists.map(p => `
    <button class="playlist-item ${p.id === UIState.selectedPlaylistId ? "active" : ""}" data-id="${escapeHtml(p.id)}">
      <i class="ri-folder-music-line"></i>
      <span>${escapeHtml(p.name)}</span>
      <span class="count">${p.tracks.length}</span>
    </button>
  `).join("");
  $$(".playlist-item").forEach(btn => btn.addEventListener("click", () => selectPlaylist(btn.dataset.id)));
}

function switchView(view) {
  ["playlists", "queue", "settings"].forEach(v => {
    $(`#view-${v}`).hidden = v !== view;
  });
  $$(".side-link").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  closeMobileSidebar();
  if (view === "queue") renderQueueView();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============ Vista de canciones ============ */

async function selectPlaylist(id) {
  UIState.selectedPlaylistId = id;
  UIState.query = "";
  $("#search-input").value = "";
  switchView("playlists");
  renderSidebarPlaylists();
  renderTrackView();
}

function currentSelectedPlaylist() {
  return findPlaylist(UIState.selectedPlaylistId);
}

function renderTrackView() {
  const query = UIState.query.trim().toLowerCase();
  const header = $("#playlists-header");

  let playlist, tracks;
  if (query) {
    tracks = allTracksFlat().filter(t =>
      (t.title || t.filename).toLowerCase().includes(query) ||
      (t.artist || "").toLowerCase().includes(query) ||
      (t.album || "").toLowerCase().includes(query)
    );
    header.querySelector("h1").textContent = `Resultados para "${UIState.query}"`;
    header.querySelector("#playlists-sub").textContent = `${tracks.length} canción(es)`;
    playlist = null;
  } else {
    playlist = currentSelectedPlaylist();
    if (!playlist) {
      header.querySelector("h1").textContent = "Todas las carpetas";
      header.querySelector("#playlists-sub").textContent = ZM.playlists.length ? "Elige una carpeta a la izquierda" : "—";
      $("#track-tbody").innerHTML = "";
      $("#track-empty").hidden = false;
      $("#track-empty").textContent = ZM.playlists.length ? "Selecciona una carpeta para ver sus canciones." : "Configura tu repositorio en Ajustes para empezar.";
      return;
    }
    tracks = playlist.tracks;
    header.querySelector("h1").textContent = playlist.name;
    header.querySelector("#playlists-sub").textContent = `${tracks.length} canción(es)`;
  }

  renderTrackRows($("#track-tbody"), tracks, playlist, "#track-empty");

  if (playlist) {
    hydratePlaylistMetadata(playlist, (track) => {
      // sólo repinta si seguimos mirando esta misma playlist y sin búsqueda activa
      if (!UIState.query && UIState.selectedPlaylistId === playlist.id) {
        updateTrackRow(track);
      }
    });
  } else if (query) {
    // hidratar todas las playlists visibles en los resultados de búsqueda
    const seen = new Set();
    tracks.forEach(t => seen.add(t.playlistId));
    seen.forEach(pid => {
      const pl = findPlaylist(pid);
      if (pl) hydratePlaylistMetadata(pl, (track) => { if (UIState.query) updateTrackRow(track); });
    });
  }
}

function renderTrackRows(tbody, tracks, playlist, emptyElSelector) {
  const emptyEl = $(emptyElSelector);
  if (!tracks.length) {
    tbody.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  const draggable = !!playlist; // sólo se puede reordenar dentro de una playlist concreta

  tbody.innerHTML = tracks.map((t, i) => `
    <tr class="track-row" data-id="${escapeHtml(t.id)}" data-index="${i}">
      <td class="col-idx">${i + 1}</td>
      <td class="col-art">${trackIconOrCover(t)}</td>
      <td class="col-title track-title-cell">
        <div class="t">${t.looksEncoded ? '<i class="ri-error-warning-line warn-icon" title="Este nombre de archivo parece mal codificado (contiene %20, %C3%A1, etc). Puede fallar al reproducirse — renómbralo en GitHub quitando esos códigos."></i> ' : ""}${escapeHtml(t.title || t.filename)}</div>
        <div class="a">${escapeHtml(t.artist || "")}${t.playlistName ? " · " + escapeHtml(t.playlistName) : ""}</div>
      </td>
      <td class="col-album">${escapeHtml(t.album || "")}</td>
      <td class="col-dur">${t.duration ? formatTime(t.duration) : ""}</td>
      <td class="col-handle">${draggable ? '<i class="ri-draggable drag-handle"></i>' : ""}</td>
    </tr>
  `).join("");

  $$(".track-row", tbody).forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".drag-handle")) return;
      const idx = parseInt(row.dataset.index, 10);
      if (playlist) playPlaylistAt(playlist, idx);
      else {
        const t = tracks[idx];
        const pl = findPlaylist(t.playlistId);
        const realIdx = pl.tracks.findIndex(x => x.id === t.id);
        playPlaylistAt(pl, realIdx);
      }
    });
  });

  if (draggable) attachDragReorder(tbody, playlist);
  highlightPlayingRow();
}

// se usa para no re-renderizar toda la tabla cada vez que llega un metadato
function updateTrackRow(track) {
  const row = document.querySelector(`.track-row[data-id="${CSS.escape(track.id)}"]`);
  if (!row) return;
  const titleEl = row.querySelector(".track-title-cell .t");
  const warnIcon = track.looksEncoded ? '<i class="ri-error-warning-line warn-icon" title="Este nombre de archivo parece mal codificado (contiene %20, %C3%A1, etc). Puede fallar al reproducirse — renómbralo en GitHub quitando esos códigos."></i> ' : "";
  titleEl.innerHTML = warnIcon + escapeHtml(track.title || track.filename);
  const aEl = row.querySelector(".track-title-cell .a");
  const plName = aEl.textContent.includes(" · ") ? " · " + aEl.textContent.split(" · ")[1] : "";
  aEl.textContent = (track.artist || "") + plName;
  if (track.cover) row.querySelector(".col-art").innerHTML = `<div class="track-thumb"><img src="${track.cover}" alt=""></div>`;
  if (track.duration) row.querySelector(".col-dur").textContent = formatTime(track.duration);
}

function highlightPlayingRow() {
  const track = currentTrack();
  $$(".track-row").forEach(row => row.classList.toggle("playing", !!track && row.dataset.id === track.id));
}

/* ============ Arrastrar y soltar (pointer events, funciona en touch) ============ */

function attachDragReorder(tbody, playlist) {
  let draggingRow = null;
  let startIndex = -1;

  $$(".drag-handle", tbody).forEach(handle => {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      draggingRow = handle.closest(".track-row");
      startIndex = parseInt(draggingRow.dataset.index, 10);
      draggingRow.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const rows = $$(".track-row", tbody);
        const target = rows.find(r => {
          const rect = r.getBoundingClientRect();
          return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
        });
        rows.forEach(r => r.classList.remove("drop-target"));
        if (target && target !== draggingRow) target.classList.add("drop-target");
      };

      const onUp = (ev) => {
        const rows = $$(".track-row", tbody);
        const target = rows.find(r => {
          const rect = r.getBoundingClientRect();
          return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
        });
        rows.forEach(r => r.classList.remove("drop-target", "dragging"));
        handle.releasePointerCapture(ev.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);

        if (target && target !== draggingRow) {
          const endIndex = parseInt(target.dataset.index, 10);
          reorderPlaylistTrack(playlist, startIndex, endIndex);
          renderTrackView();
        }
        draggingRow = null;
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

/* ============ Cola de reproducción ============ */

function renderQueueView() {
  const tbody = $("#queue-tbody");
  if (!Player.playlist || !Player.playlist.tracks.length) {
    tbody.innerHTML = "";
    $("#queue-empty").hidden = false;
    return;
  }
  renderTrackRows(tbody, Player.playlist.tracks, Player.playlist, "#queue-empty");
}

/* ============ Barra del reproductor ============ */

let isSeeking = false;

function bindPlayerBar() {
  $("#play-btn").addEventListener("click", togglePlay);
  $("#prev-btn").addEventListener("click", prev);
  $("#next-btn").addEventListener("click", () => next(false));
  $("#shuffle-btn").addEventListener("click", toggleShuffle);
  $("#repeat-btn").addEventListener("click", cycleRepeat);

  const seekBar = $("#seek-bar");
  seekBar.addEventListener("pointerdown", () => isSeeking = true);
  seekBar.addEventListener("change", () => {
    seekTo(seekBar.value / 1000);
    isSeeking = false;
  });

  $("#volume-bar").addEventListener("input", (e) => setVolume(e.target.value / 100));
  setVolume(0.9);

  document.addEventListener("zm:trackchange", (e) => {
    const { track, playlist } = e.detail;
    $("#np-title").textContent = track.title || track.filename;
    $("#np-artist").textContent = track.artist || "";
    $("#np-cover").innerHTML = track.cover ? `<img src="${track.cover}" alt="">` : '<i class="ri-music-2-fill"></i>';
    document.title = `${track.title || track.filename} · Zeta Music`;
    highlightPlayingRow();
    if (!$("#view-queue").hidden) renderQueueView();

    $("#np-full-title").textContent = track.title || track.filename;
    $("#np-full-artist").textContent = track.artist || "";
    $("#np-cover-large").innerHTML = track.cover ? `<img src="${track.cover}" alt="">` : '<i class="ri-music-2-fill"></i>';
    $("#np-full-playlist").textContent = playlist ? playlist.name : "";
    loadLyricsForTrack(track);
  });

  document.addEventListener("zm:playstate", (e) => {
    const cls = e.detail.playing ? "ri-pause-fill" : "ri-play-fill";
    $("#play-btn i").className = cls;
    $("#np-play-btn i").className = cls;
  });

  document.addEventListener("zm:timeupdate", (e) => {
    const { current, duration } = e.detail;
    $("#cur-time").textContent = formatTime(current);
    $("#dur-time").textContent = formatTime(duration);
    $("#np-full-cur").textContent = formatTime(current);
    $("#np-full-dur").textContent = formatTime(duration);
    const pct = duration ? Math.round((current / duration) * 1000) : 0;
    if (!isSeeking) seekBar.value = pct;
    if (!isFullSeeking) $("#np-full-seek").value = pct;
  });

  document.addEventListener("zm:shufflechange", (e) => {
    $("#shuffle-btn").classList.toggle("active", e.detail.shuffle);
    $("#np-shuffle-btn").classList.toggle("active", e.detail.shuffle);
  });
  document.addEventListener("zm:repeatchange", (e) => {
    const iconClass = e.detail.repeat === "one" ? "ri-repeat-one-line" : "ri-repeat-line";
    const active = e.detail.repeat !== "off";
    $("#repeat-btn").classList.toggle("active", active);
    $("#repeat-btn").querySelector("i").className = iconClass;
    $("#np-repeat-btn").classList.toggle("active", active);
    $("#np-repeat-btn").querySelector("i").className = iconClass;
  });

  document.addEventListener("zm:trackerror", (e) => {
    const row = document.querySelector(`.track-row[data-id="${CSS.escape(e.detail.track.id)}"]`);
    if (row) row.classList.add("row-broken");
  });
}

/* ============ Vista "Reproduciendo ahora" (portada grande + letra) ============ */

let isFullSeeking = false;

function bindNowPlayingOverlay() {
  const overlay = $("#nowplaying-overlay");

  $("#now-playing-trigger").addEventListener("click", () => {
    if (!currentTrack()) return;
    overlay.classList.add("open");
  });
  $("#np-close-btn").addEventListener("click", () => overlay.classList.remove("open"));

  $("#np-play-btn").addEventListener("click", togglePlay);
  $("#np-prev-btn").addEventListener("click", prev);
  $("#np-next-btn").addEventListener("click", () => next(false));
  $("#np-shuffle-btn").addEventListener("click", toggleShuffle);
  $("#np-repeat-btn").addEventListener("click", cycleRepeat);

  const seekBar = $("#np-full-seek");
  seekBar.addEventListener("pointerdown", () => isFullSeeking = true);
  seekBar.addEventListener("change", () => {
    seekTo(seekBar.value / 1000);
    isFullSeeking = false;
  });
}

async function loadLyricsForTrack(track) {
  const el = $("#np-lyrics-body");
  if (!track) { el.textContent = "Elige una canción para ver su letra."; return; }

  if (track.lyrics) { el.textContent = track.lyrics; return; }

  if (!track.lyricsUrl) {
    el.textContent = "No se encontró letra para esta canción.\n\nTip: si el MP3 tiene una etiqueta de letra (USLT) la app la detecta sola. También puedes subir un archivo .lrc o .txt con el mismo nombre que la canción, en la misma carpeta.";
    return;
  }

  el.textContent = "Cargando letra…";
  try {
    const res = await fetch(track.lyricsUrl);
    if (!res.ok) throw new Error();
    const text = (await res.text()).trim();
    // si el usuario cambió de canción mientras se cargaba, no pisar la letra correcta
    if (currentTrack() && currentTrack().id === track.id) {
      el.textContent = text || "El archivo de letra está vacío.";
      track.lyrics = text || null;
    }
  } catch (e) {
    if (currentTrack() && currentTrack().id === track.id) {
      el.textContent = "No se pudo cargar el archivo de letra.";
    }
  }
}

/* ============ Navegación lateral / móvil ============ */

function bindNav() {
  $$(".side-link").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  $("#menu-btn").addEventListener("click", openMobileSidebar);
  $("#sidebar-overlay").addEventListener("click", closeMobileSidebar);
  $("#search-input").addEventListener("input", (e) => {
    UIState.query = e.target.value;
    renderTrackView();
  });
}

function openMobileSidebar() { $("#sidebar").classList.add("open"); }
function closeMobileSidebar() { $("#sidebar").classList.remove("open"); }

/* ============ Ajustes ============ */

function bindSettings() {
  const cfg = getConfig();
  $("#cfg-owner").value = cfg.owner;
  $("#cfg-repo").value = cfg.repo;
  $("#cfg-branch").value = cfg.branch;
  $("#cfg-path").value = cfg.musicPath;

  $("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newCfg = {
      owner: $("#cfg-owner").value.trim(),
      repo: $("#cfg-repo").value.trim(),
      branch: $("#cfg-branch").value.trim() || "main",
      musicPath: $("#cfg-path").value.trim() || "music",
    };

    if (!newCfg.owner || !newCfg.repo) {
      $("#cfg-hint").textContent = "Escribe al menos el usuario y el repositorio de GitHub.";
      return;
    }

    saveConfig(newCfg);
    sessionStorage.clear(); // limpia caché de la API de GitHub
    $("#cfg-hint").textContent = "Escaneando…";
    try {
      await initLibrary("github");
      $("#cfg-hint").textContent = `Listo: se encontraron ${ZM.playlists.length} carpeta(s).`;
    } catch (err) {
      $("#cfg-hint").textContent = err.message || "No se pudo escanear el repositorio.";
    }
  });

  $("#cfg-local-btn").addEventListener("click", async () => {
    $("#cfg-hint").textContent = "Elige una carpeta…";
    try {
      await initLibrary("local");
      $("#cfg-hint").textContent = "Carpeta local cargada correctamente.";
    } catch (err) {
      $("#cfg-hint").textContent = err.message || "No se pudo leer la carpeta.";
    }
  });

  $("#export-order-btn").addEventListener("click", () => {
    const playlist = currentSelectedPlaylist();
    if (!playlist) { alert("Primero selecciona una carpeta en 'Carpetas'."); return; }
    exportPlaylistOrder(playlist);
  });

  $("#import-order-input").addEventListener("change", async (e) => {
    const playlist = currentSelectedPlaylist();
    const file = e.target.files[0];
    if (!file) return;
    if (!playlist) { alert("Primero selecciona una carpeta en 'Carpetas'."); return; }
    try {
      const data = JSON.parse(await file.text());
      importPlaylistOrder(playlist, data);
      renderTrackView();
      $("#cfg-hint").textContent = "Orden importado.";
    } catch (err) {
      $("#cfg-hint").textContent = "El archivo de orden no es válido.";
    }
    e.target.value = "";
  });
}

/* ============ Escaneo / carga de biblioteca ============ */

async function initLibrary(mode) {
  $("#playlist-list").innerHTML = `<div class="empty-hint">Escaneando…</div>`;
  try {
    await loadLibrary(mode, (msg) => {
      $("#playlist-list").innerHTML = `<div class="empty-hint">${escapeHtml(msg)}</div>`;
    });
    UIState.selectedPlaylistId = ZM.playlists[0] ? ZM.playlists[0].id : null;
    renderSidebarPlaylists();
    renderTrackView();
    if (mode === "github") switchView("playlists");
  } catch (err) {
    $("#playlist-list").innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
    if (!ZM.playlists.length) switchView("settings");
    throw err;
  }
}

function bindRescan() {
  $("#rescan-btn").addEventListener("click", () => {
    clearMetaCache();
    sessionStorage.clear();
    initLibrary(ZM.source || "github");
  });
}
