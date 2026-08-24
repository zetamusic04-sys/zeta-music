// ============ Zeta Music — lector de metadatos ============
// Parser propio de ID3v2 (mp3) e ID3v1, 100% JS vanilla, sin librerías.
// Lee sólo los primeros ~700KB (tags ID3v2 + portada) y los últimos 128
// bytes (ID3v1) del archivo, así que es rápido incluso con muchas canciones.

const ZM_HEAD_BYTES = 700 * 1024;

async function fetchBytes(source, start, end) {
  if (typeof source === "string") {
    const res = await fetch(source, { headers: { Range: `bytes=${start}-${end}` } });
    if (!res.ok && res.status !== 206) throw new Error("no range support");
    return new Uint8Array(await res.arrayBuffer());
  }
  // File / Blob
  const blob = source.slice(start, end + 1);
  return new Uint8Array(await blob.arrayBuffer());
}

async function fetchFullSize(source) {
  if (typeof source === "string") {
    const res = await fetch(source, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return len ? parseInt(len, 10) : null;
  }
  return source.size;
}

function decodeText(bytes, encodingByte) {
  try {
    if (encodingByte === 1) { // UTF-16 with BOM
      return new TextDecoder(bytes[0] === 0xFF ? "utf-16le" : "utf-16be").decode(bytes.slice(2));
    }
    if (encodingByte === 2) return new TextDecoder("utf-16be").decode(bytes);
    if (encodingByte === 3) return new TextDecoder("utf-8").decode(bytes);
    return new TextDecoder("iso-8859-1").decode(bytes); // 0
  } catch (e) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function trimNulls(str) {
  return str.replace(/\u0000+$/g, "").trim();
}

function syncsafe(b0, b1, b2, b3) {
  return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
}

function readID3v2(bytes) {
  if (bytes.length < 10) return null;
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== "ID3") return null;

  const majorVersion = bytes[3];
  const flags = bytes[5];
  const tagSize = syncsafe(bytes[6], bytes[7], bytes[8], bytes[9]);
  let offset = 10;

  if (flags & 0x40) { // extended header present
    const extSize = majorVersion >= 4
      ? syncsafe(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
      : (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += extSize + (majorVersion >= 4 ? 0 : 4);
  }

  const end = Math.min(bytes.length, 10 + tagSize);
  const tags = { title: null, artist: null, album: null, cover: null, trackNo: null, lyrics: null };

  while (offset + 10 <= end) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (id === "\u0000\u0000\u0000\u0000") break;

    let frameSize;
    if (majorVersion >= 4) {
      frameSize = syncsafe(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    } else {
      frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
    }
    const frameStart = offset + 10;
    const frameEnd = frameStart + frameSize;
    if (frameSize <= 0 || frameEnd > bytes.length) break;
    const frameBytes = bytes.slice(frameStart, frameEnd);

    try {
      if (id === "TIT2") tags.title = trimNulls(decodeText(frameBytes.slice(1), frameBytes[0]));
      else if (id === "TPE1") tags.artist = trimNulls(decodeText(frameBytes.slice(1), frameBytes[0]));
      else if (id === "TALB") tags.album = trimNulls(decodeText(frameBytes.slice(1), frameBytes[0]));
      else if (id === "TRCK") tags.trackNo = trimNulls(decodeText(frameBytes.slice(1), frameBytes[0])).split("/")[0];
      else if (id === "APIC" && !tags.cover) tags.cover = parseAPIC(frameBytes);
      else if (id === "USLT" && !tags.lyrics) tags.lyrics = parseUSLT(frameBytes);
    } catch (e) { /* frame corrupta, seguimos */ }

    offset = frameEnd;
  }
  return tags;
}

// Sólo se aceptan estos tipos de imagen: cualquier otro valor (incluido
// texto malicioso intentando romper el atributo src="") se descarta.
const SAFE_IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp|bmp)$/i;

function parseAPIC(frameBytes) {
  const encoding = frameBytes[0];
  let i = 1;
  let mime = "";
  while (i < frameBytes.length && frameBytes[i] !== 0 && mime.length < 32) { mime += String.fromCharCode(frameBytes[i]); i++; }
  while (i < frameBytes.length && frameBytes[i] !== 0) i++; // por si el mime venía cortado, avanzar hasta el null real
  i++; // saltar null
  i++; // saltar picture type byte
  // saltar descripción (posiblemente UTF-16, terminador de 2 bytes)
  if (encoding === 1 || encoding === 2) {
    while (i < frameBytes.length - 1 && !(frameBytes[i] === 0 && frameBytes[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < frameBytes.length && frameBytes[i] !== 0) i++;
    i++;
  }
  const imgBytes = frameBytes.slice(i);
  if (imgBytes.length < 20) return null;
  const safeMime = SAFE_IMAGE_MIME.test(mime.trim()) ? mime.trim().toLowerCase() : "image/jpeg";
  return bytesToDataURL(imgBytes, safeMime);
}

function parseUSLT(frameBytes) {
  const encoding = frameBytes[0];
  let i = 4; // 1 byte encoding + 3 bytes de idioma
  // saltar descripción corta (encoding-dependiente, terminador null)
  if (encoding === 1 || encoding === 2) {
    while (i < frameBytes.length - 1 && !(frameBytes[i] === 0 && frameBytes[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < frameBytes.length && frameBytes[i] !== 0) i++;
    i++;
  }
  const lyricsBytes = frameBytes.slice(i);
  if (!lyricsBytes.length) return null;
  const text = trimNulls(decodeText(lyricsBytes, encoding));
  return text || null;
}

function bytesToDataURL(bytes, mime) {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function readID3v1(bytes) {
  if (bytes.length < 128) return null;
  const tag = bytes.slice(bytes.length - 128);
  if (String.fromCharCode(tag[0], tag[1], tag[2]) !== "TAG") return null;
  const dec = (start, len) => trimNulls(new TextDecoder("iso-8859-1").decode(tag.slice(start, start + len)));
  return { title: dec(3, 30) || null, artist: dec(33, 30) || null, album: dec(63, 30) || null, cover: null };
}

function guessFromFilename(filename) {
  const base = filename.replace(/\.[^/.]+$/, "");
  const cleaned = base.replace(/^\d+[\s.\-_]+/, ""); // quita "01 - "
  const parts = cleaned.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { title: parts.slice(1).join(" - ").trim(), artist: parts[0].trim(), album: null, cover: null };
  }
  return { title: cleaned.trim() || base, artist: null, album: null, cover: null };
}

/**
 * Lee metadatos de una canción.
 * @param {string|File} source URL (raw.githubusercontent.com, soporta Range) o File local
 * @param {string} filename nombre de archivo, para el fallback
 */
async function readAudioMetadata(source, filename) {
  const fallback = guessFromFilename(filename);
  try {
    const size = await fetchFullSize(source);
    const headEnd = size ? Math.min(size - 1, ZM_HEAD_BYTES) : ZM_HEAD_BYTES;
    const head = await fetchBytes(source, 0, headEnd);
    let tags = readID3v2(head);

    if ((!tags || (!tags.title && !tags.artist)) && size && size > 128) {
      const tail = await fetchBytes(source, Math.max(0, size - 128), size - 1);
      const v1 = readID3v1(tail);
      if (v1 && (v1.title || v1.artist)) tags = { ...fallback, ...v1 };
    }

    if (!tags) tags = fallback;
    return {
      title: tags.title || fallback.title,
      artist: tags.artist || fallback.artist || "Artista desconocido",
      album: tags.album || "—",
      cover: tags.cover || null,
      lyrics: tags.lyrics || null,
    };
  } catch (e) {
    return { ...fallback, artist: fallback.artist || "Artista desconocido", album: "—", cover: null };
  }
}
