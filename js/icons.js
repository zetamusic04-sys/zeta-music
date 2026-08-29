// ============ Zeta Music — íconos propios ============
// Antes la app cargaba Remix Icon desde un CDN externo. Eso significaba
// que sin conexión (justo el caso de uso de una PWA instalada) todos los
// botones se quedaban sin ícono, porque el service worker sólo cachea
// archivos del propio origen. Esta es la solución: un set mínimo de
// íconos SVG dibujados a mano, embebidos aquí mismo, sin red de por medio.
//
// Se siguen usando las mismas clases "ri-xxx" en el HTML para no tener
// que tocar el resto del código — este archivo sólo se encarga de
// convertir cada <i class="ri-xxx"> en un SVG real.

const ZM_ICONS = {
  "ri-folder-music-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 6.5a1 1 0 0 1 1-1h4.8l1.8 1.8H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="10.3" cy="15.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.6" cy="14.6" r="1.3" fill="currentColor" stroke="none"/><path d="M11.6 15.4v-3.9l5.3-1v3.9" stroke-linecap="round"/></svg>`,
  "ri-play-list-2-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h11M4 12h7M4 18h7"/><path d="M15 15v5l4.3-2.5z" fill="currentColor" stroke="none" stroke-linejoin="round"/></svg>`,
  "ri-settings-3-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M4.4 6l1.9 1.4M17.7 16.6l1.9 1.4M2.8 12h2.6M18.6 12h2.6M4.4 18l1.9-1.4M17.7 7.4l1.9-1.4"/></svg>`,
  "ri-refresh-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 0 1 13-5"/><path d="M17.5 3.5V7H14"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5"/><path d="M6.5 20.5V17H10"/></svg>`,
  "ri-menu-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  "ri-search-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.3" cy="10.3" r="6.3"/><path d="M19.5 19.5l-4.6-4.6"/></svg>`,
  "ri-download-2-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11.5M7.2 10.2 12 15l4.8-4.8"/><path d="M4.5 19h15"/></svg>`,
  "ri-time-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.3"/><path d="M12 7.5V12l3 1.8"/></svg>`,
  "ri-music-2-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8.7" cy="17.2" r="2.4"/><circle cx="17.7" cy="15.2" r="2.4"/><path d="M11 17.2V6.4L20 4.5v10.7h-2V6.9l-6.9 1.5v8.8z"/></svg>`,
  "ri-music-2-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.7" cy="17.2" r="2.2"/><circle cx="17.7" cy="15.2" r="2.2"/><path d="M10.9 17.2V6.5l8.4-1.8v10.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "ri-shuffle-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h3.6L17 18.5H21M3 18.5h3.6l2.6-3M14.5 6.5H21"/><path d="M18 3.3l3 3.2-3 3.2M18 15.3l3 3.2-3 3.2"/></svg>`,
  "ri-skip-back-mini-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5.2" y="6" width="1.9" height="12" rx="0.5"/><path d="M18 6.3v11.4L8.6 12z"/></svg>`,
  "ri-play-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 5.4v13.2a1 1 0 0 0 1.5.87l11-6.6a1 1 0 0 0 0-1.74l-11-6.6a1 1 0 0 0-1.5.87z"/></svg>`,
  "ri-pause-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>`,
  "ri-skip-forward-mini-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="17" y="6" width="1.9" height="12" rx="0.5"/><path d="M6 6.3v11.4L15.4 12z"/></svg>`,
  "ri-repeat-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.3 9A3.7 3.7 0 0 1 8 5.3H18M18 5.3l-2.6-2.6M18 5.3l-2.6 2.6"/><path d="M19.7 15A3.7 3.7 0 0 1 16 18.7H6M6 18.7l2.6 2.6M6 18.7l2.6-2.6"/></svg>`,
  "ri-repeat-one-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.3 9A3.7 3.7 0 0 1 8 5.3H18M18 5.3l-2.6-2.6M18 5.3l-2.6 2.6"/><path d="M19.7 15A3.7 3.7 0 0 1 16 18.7H6M6 18.7l2.6 2.6M6 18.7l2.6-2.6"/><path d="M11.1 10.3h1v3.9" stroke-width="1.3"/></svg>`,
  "ri-volume-up-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.2v3.6h3.3L12 17.6V6.4L7.3 10.2z" fill="currentColor" stroke="none"/><path d="M15.6 9.2a3.9 3.9 0 0 1 0 5.6M18.2 6.7a7.5 7.5 0 0 1 0 10.6"/></svg>`,
  "ri-save-3-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4.2h11l3 3V19.8H5z"/><path d="M8 4.2v5h7v-5M8 19.8v-6h8v6"/></svg>`,
  "ri-folder-open-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 8.2V6.4a1 1 0 0 1 1-1h4.8l1.8 1.8h7.9a1 1 0 0 1 1 1v1"/><path d="M3 8.2h17.9l-2 10.3a1 1 0 0 1-1 .8H5.9a1 1 0 0 1-1-.8z"/></svg>`,
  "ri-download-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10.5M7.4 10.4 12 15l4.6-4.6"/><path d="M5 19h14"/></svg>`,
  "ri-upload-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5V4M7.4 8.6 12 4l4.6 4.6"/><path d="M5 19h14"/></svg>`,
  "ri-arrow-down-s-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>`,
  "ri-file-text-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M7 3.2h6.6L18 7.6v13.2H7z"/><path d="M13.6 3.2v4.4H18M9.3 11.8h5.4M9.3 15h5.4M9.3 8.6h2"/></svg>`,
  "ri-draggable": `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>`,
  "ri-error-warning-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5.6"/><circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none"/></svg>`,
  "ri-heart-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20.3S3.8 15.2 3.8 9.7C3.8 6.8 6 4.7 8.6 4.7c1.6 0 3 .8 3.4 2.2.4-1.4 1.8-2.2 3.4-2.2 2.6 0 4.8 2.1 4.8 5 0 5.5-8.2 10.6-8.2 10.6z"/></svg>`,
  "ri-heart-fill": `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.3S3.8 15.2 3.8 9.7C3.8 6.8 6 4.7 8.6 4.7c1.6 0 3 .8 3.4 2.2.4-1.4 1.8-2.2 3.4-2.2 2.6 0 4.8 2.1 4.8 5 0 5.5-8.2 10.6-8.2 10.6z"/></svg>`,
  "ri-add-circle-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>`,
  "ri-keyboard-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="6.5" width="18" height="11" rx="1.3"/><path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M17.5 10h.01M7 13.5h10" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  "ri-close-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  "ri-check-line": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
};

/** Convierte todos los <i class="ri-xxx"> dentro de root en SVG reales. */
function zmApplyIcons(root = document) {
  root.querySelectorAll('i[class*="ri-"]').forEach((el) => {
    const cls = Array.from(el.classList).find((c) => ZM_ICONS[c]);
    if (!cls || el.dataset.zmIcon === cls) return;
    el.innerHTML = ZM_ICONS[cls];
    el.dataset.zmIcon = cls;
  });
}

/** Cambia el ícono de un elemento (para los botones play/pausa, repetir, etc). */
function zmSetIcon(el, iconClass) {
  if (!el) return;
  el.className = iconClass;
  el.innerHTML = ZM_ICONS[iconClass] || "";
  el.dataset.zmIcon = iconClass;
}

// La interfaz se re-renderiza todo el tiempo (listas de canciones,
// playlists…), así que observamos el DOM y aplicamos íconos a lo que
// vaya apareciendo, sin tener que tocar cada función de render.
document.addEventListener("DOMContentLoaded", () => {
  zmApplyIcons();
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) { zmApplyIcons(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
});
