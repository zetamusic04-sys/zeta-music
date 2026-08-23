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
  bindSettings();
  bindRescan();

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
