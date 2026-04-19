/** Resize and compress to JPEG data URL for localStorage-friendly profile photos */

function drawToDataUrl(img: HTMLImageElement, maxEdge: number, quality: number) {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (!w || !h) throw new Error("Image has no dimensions");
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 14 * 1024 * 1024) {
    throw new Error("Image is too large (max ~14MB before compression).");
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read image."));
      img.src = objectUrl;
    });

    let edge = 420;
    let quality = 0.88;
    for (let i = 0; i < 10; i += 1) {
      const url = drawToDataUrl(img, edge, quality);
      if (url.length < 420_000 || i >= 8) return url;
      edge = Math.max(200, Math.round(edge * 0.82));
      quality = Math.max(0.55, quality * 0.92);
    }
    throw new Error("Could not shrink image enough for storage.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
