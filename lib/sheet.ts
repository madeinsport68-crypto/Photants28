// Moteur de planche : compose les photos sur une feuille 10×15 à 600 DPI
// et exporte un PNG portant la métadonnée de résolution (chunk pHYs = 600 DPI),
// afin que les logiciels d'impression respectent la taille réelle.

import type { PhotoFormat } from "./formats";

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeSlots(f: PhotoFormat): SlotRect[] {
  const { w: W, h: H } = f.sheetPx;
  const { w: pw, h: ph } = f.photoPx;
  const gapX = (W - f.cols * pw) / (f.cols + 1);
  const gapY = (H - f.rows * ph) / (f.rows + 1);
  const slots: SlotRect[] = [];
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      slots.push({
        x: Math.round(gapX + c * (pw + gapX)),
        y: Math.round(gapY + r * (ph + gapY)),
        w: pw,
        h: ph,
      });
    }
  }
  return slots;
}

export function renderSheet(photo: HTMLCanvasElement, f: PhotoFormat): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = f.sheetPx.w;
  canvas.height = f.sheetPx.h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const slots = computeSlots(f);
  ctx.imageSmoothingQuality = "high";
  for (const s of slots) ctx.drawImage(photo, s.x, s.y, s.w, s.h);

  // Traits de coupe discrets aux angles de chaque photo.
  const gapX = slots.length > 1 ? Math.max(1, slots[1].x - (slots[0].x + slots[0].w)) : 40;
  const markLen = Math.min(36, Math.max(10, gapX * 0.45));
  const off = 6;
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const s of slots) {
    const corners: [number, number, number, number][] = [
      [s.x, s.y, -1, -1],
      [s.x + s.w, s.y, 1, -1],
      [s.x, s.y + s.h, -1, 1],
      [s.x + s.w, s.y + s.h, 1, 1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.moveTo(cx + dx * off, cy);
      ctx.lineTo(cx + dx * (off + markLen), cy);
      ctx.moveTo(cx, cy + dy * off);
      ctx.lineTo(cx, cy + dy * (off + markLen));
    }
  }
  ctx.stroke();
  return canvas;
}

// ---------- PNG + pHYs ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Insère un chunk pHYs (résolution) juste après IHDR. */
export function withDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unité : mètre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Supprime un éventuel pHYs existant puis insère le nôtre après IHDR (8 + 25 octets).
  const parts: Uint8Array[] = [png.subarray(0, 33), chunk];
  let p = 33;
  while (p < png.length) {
    const len = new DataView(png.buffer, png.byteOffset + p).getUint32(0);
    const type = String.fromCharCode(...png.subarray(p + 4, p + 8));
    const end = p + 12 + len;
    if (type !== "pHYs") parts.push(png.subarray(p, end));
    p = end;
  }
  const total = parts.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of parts) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement, dpi = 600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Export PNG impossible"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      resolve(new Blob([withDpi(bytes, dpi).buffer as ArrayBuffer], { type: "image/png" }));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
