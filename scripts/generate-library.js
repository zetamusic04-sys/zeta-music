#!/usr/bin/env node
// ============ Zeta Music — generador de library.json ============
// Uso: node scripts/generate-library.js [carpeta-de-musica]
//
// Escanea una carpeta local (por defecto ./music) y genera
// music/library.json con la lista de carpetas y archivos.
// Súbelo junto con tus canciones y la app lo usará directo,
// sin gastar la cuota de la API de GitHub en cada visita.
//
// También puedes correr esto automáticamente en cada push con un
// GitHub Action (busca "actions/checkout" + "actions/upload-artifact"
// o simplemente un job que corra `node scripts/generate-library.js`
// y haga commit del archivo resultante).

const fs = require("fs");
const path = require("path");

const AUDIO_EXT = [".mp3", ".flac", ".ogg", ".oga", ".wav", ".m4a", ".aac", ".opus", ".weba"];
const EXTRA_EXT = [".lrc", ".txt"]; // letras

const root = process.argv[2] || "music";

if (!fs.existsSync(root)) {
  console.error(`No existe la carpeta "${root}".`);
  process.exit(1);
}

function isRelevant(name) {
  const ext = path.extname(name).toLowerCase();
  return AUDIO_EXT.includes(ext) || EXTRA_EXT.includes(ext);
}

const playlists = [];
const rootEntries = fs.readdirSync(root, { withFileTypes: true });

const looseFiles = rootEntries.filter(e => e.isFile() && isRelevant(e.name)).map(e => e.name);
if (looseFiles.length) {
  playlists.push({ name: "Música", path: root.replace(/\\/g, "/"), tracks: looseFiles });
}

for (const entry of rootEntries) {
  if (!entry.isDirectory()) continue;
  const folderPath = path.join(root, entry.name);
  const files = fs.readdirSync(folderPath).filter(isRelevant);
  if (!files.length) continue;
  playlists.push({ name: entry.name, path: folderPath.replace(/\\/g, "/"), tracks: files });
}

const outPath = path.join(root, "library.json");
fs.writeFileSync(outPath, JSON.stringify({ playlists }, null, 2));
console.log(`Listo: ${outPath} (${playlists.length} carpeta(s), ${playlists.reduce((n, p) => n + p.tracks.length, 0)} archivo(s))`);
