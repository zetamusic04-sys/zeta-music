// ============ Zeta Music — escáner local ============
// Alternativa a GitHub: deja elegir una carpeta del propio dispositivo.
// Útil para probar la app, o para quien prefiera no subir música a GitHub.
// Usa File System Access API si existe; si no, cae a <input webkitdirectory>.

async function scanLocalLibrary() {
  if (window.showDirectoryPicker) {
    const rootHandle = await window.showDirectoryPicker();
    return scanLocalViaFSA(rootHandle);
  }
  return scanLocalViaInput();
}

async function scanLocalViaFSA(rootHandle) {
  const playlists = [];
  const looseFiles = [];

  for await (const [name, handle] of rootHandle.entries()) {
    if (handle.kind === "file" && (isAudioFile(name) || /\.(lrc|txt)$/i.test(name))) {
      looseFiles.push(await handle.getFile());
    } else if (handle.kind === "directory") {
      const files = [];
      for await (const [fname, fhandle] of handle.entries()) {
        if (fhandle.kind === "file" && (isAudioFile(fname) || /\.(lrc|txt)$/i.test(fname))) files.push(await fhandle.getFile());
      }
      if (files.some(f => isAudioFile(f.name))) playlists.push(buildLocalPlaylist(name, files));
    }
  }
  if (looseFiles.some(f => isAudioFile(f.name))) playlists.unshift(buildLocalPlaylist(rootHandle.name || "Música", looseFiles));
  return playlists;
}

function scanLocalViaInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files).filter(f => isAudioFile(f.name) || /\.(lrc|txt)$/i.test(f.name));
      if (!files.some(f => isAudioFile(f.name))) return reject(new Error("No se encontraron canciones en esa carpeta."));

      const groups = new Map();
      for (const f of files) {
        const rel = f.webkitRelativePath || f.name;
        const parts = rel.split("/");
        const folder = parts.length > 2 ? parts[1] : (parts[0] || "Música");
        if (!groups.has(folder)) groups.set(folder, []);
        groups.get(folder).push(f);
      }
      resolve(Array.from(groups.entries()).filter(([, fs]) => fs.some(f => isAudioFile(f.name))).map(([name, fs]) => buildLocalPlaylist(name, fs)));
    };
    input.click();
  });
}

function basenameNoExtLocal(filename) {
  return filename.replace(/\.[^/.]+$/, "").toLowerCase();
}

function buildLocalPlaylist(name, files) {
  const audioFiles = files.filter(f => isAudioFile(f.name));
  const lyricFiles = files.filter(f => /\.(lrc|txt)$/i.test(f.name));
  const lyricsByBase = new Map(lyricFiles.map(f => [basenameNoExtLocal(f.name), f]));

  const tracks = audioFiles.map(file => {
    const lyricMatch = lyricsByBase.get(basenameNoExtLocal(file.name));
    return {
      id: `local/${name}/${file.name}`,
      filename: file.name,
      url: URL.createObjectURL(file),
      fileRef: file,
      lyricsUrl: lyricMatch ? URL.createObjectURL(lyricMatch) : null,
      title: null, artist: null, album: null, cover: null, duration: null, lyrics: null,
    };
  });
  return { id: `local/${name}`, name, source: "local", path: name, tracks };
}
