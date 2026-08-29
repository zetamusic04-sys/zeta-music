// ============ Zeta Music — arranque ============

let deferredInstallPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $("#install-btn").hidden = false;
});

window.addEventListener("appinstalled", () => {
  $("#install-btn").hidden = true;
  deferredInstallPrompt = null;
});

document.addEventListener("DOMContentLoaded", async () => {
  bindNav();
  bindPlayerBar();
  bindNowPlayingOverlay();
  bindSettings();
  bindRescan();

  // Mide el alto real de la barra del reproductor (varía en Android/PWA
  // por los controles apilados y el gesto inferior) para que la última
  // canción de cada lista nunca quede tapada.
  const playerBar = document.getElementById("player-bar");
  const syncPlayerHeight = () => document.documentElement.style.setProperty("--player-h-live", playerBar.offsetHeight + "px");
  if (window.ResizeObserver) new ResizeObserver(syncPlayerHeight).observe(playerBar);
  syncPlayerHeight();

  $("#install-btn").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("#install-btn").hidden = true;
      return;
    }
    if (isIos()) {
      alert('Para instalar Zeta Music en iPhone/iPad:\n\n1. Toca el botón "Compartir" (el cuadrado con la flecha hacia arriba) en Safari.\n2. Elige "Agregar a pantalla de inicio".\n3. Confirma con "Agregar".');
    }
  });

  if (isIos() && !isStandalone()) {
    $("#install-btn").hidden = false;
  }

  const cfg = getConfig();
  if (cfg.owner && cfg.repo) {
    try { await initLibrary("github"); }
    catch (e) { /* el mensaje de error ya se muestra en la sidebar/ajustes */ }
  } else {
    switchView("settings");
    $("#cfg-hint").textContent = "Indica tu usuario y repositorio, o usa una carpeta local para probar la app.";
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  bindKeyboardShortcuts();
});

/* ============ Atajos de teclado ============ */
function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        if (audioEl.duration) audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
        break;
      case "ArrowLeft":
        audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        audioEl.volume = Math.min(1, audioEl.volume + 0.05);
        $("#volume-bar").value = Math.round(audioEl.volume * 100);
        break;
      case "ArrowDown":
        e.preventDefault();
        audioEl.volume = Math.max(0, audioEl.volume - 0.05);
        $("#volume-bar").value = Math.round(audioEl.volume * 100);
        break;
    }
  });
}
