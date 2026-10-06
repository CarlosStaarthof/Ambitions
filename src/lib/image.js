// Vision board pictures come from the camera roll, where a single photo is easily
// 3–8 MB. Stored raw they would bloat IndexedDB and make the JSON export — the only
// backup — unusable. Everything is downscaled and re-encoded to JPEG on the way in.

export const MAX_EDGE = 1200;
export const QUALITY = 0.75;

export function fileToScaledDataUrl(file, maxEdge = MAX_EDGE, quality = QUALITY) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("That isn't an image file.")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) { reject(new Error("Could not process that image.")); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}

// Rough byte count of a data: URI, for showing how much room the board is using.
export function dataUrlBytes(dataUrl) {
  const i = String(dataUrl || "").indexOf(",");
  if (i < 0) return 0;
  return Math.round((String(dataUrl).length - i - 1) * 0.75);
}

export function humanSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
