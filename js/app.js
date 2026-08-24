// ============ Zeta Music — arranque ============

let deferredInstallPrompt = null;

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
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#install-btn").hidden = true;
  });

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
});
