// Utilitaires image : chargement (JPG/PNG/HEIC) et recadrage haute définition.

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const HEIC_TYPES = ["image/heic", "image/heif"];

function isHeic(file: File) {
  const name = file.name.toLowerCase();
  return HEIC_TYPES.includes(file.type) || name.endsWith(".heic") || name.endsWith(".heif");
}

/** Convertit un fichier utilisateur en URL affichable (les HEIC sont convertis en JPEG). */
export async function fileToImageUrl(file: File): Promise<string> {
  if (isHeic(file)) {
    // Safari sait décoder le HEIC nativement : on essaie d'abord directement.
    const direct = URL.createObjectURL(file);
    if (await canDecode(direct)) return direct;
    URL.revokeObjectURL(direct);
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
    const blob = Array.isArray(out) ? out[0] : out;
    return URL.createObjectURL(blob);
  }
  return URL.createObjectURL(file);
}

function canDecode(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = src;
  });
}

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Taille de la boîte englobante d'une image tournée. */
function rotatedSize(w: number, h: number, rotation: number) {
  const r = rad(rotation);
  return {
    width: Math.abs(Math.cos(r) * w) + Math.abs(Math.sin(r) * h),
    height: Math.abs(Math.sin(r) * w) + Math.abs(Math.cos(r) * h),
  };
}

/**
 * Produit la photo recadrée à la taille demandée (ex. 826×1062 px pour 600 DPI).
 * `crop` est exprimé en pixels de l'image tournée (convention react-easy-crop).
 * Les zones hors image sont remplies avec `fill`.
 */
export async function renderCrop(
  src: string,
  crop: PixelCrop,
  rotation: number,
  outW: number,
  outH: number,
  fill = "#ffffff"
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const { width: bW, height: bH } = rotatedSize(img.naturalWidth, img.naturalHeight, rotation);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, outW, outH);

  const sx = outW / crop.width;
  const sy = outH / crop.height;
  ctx.setTransform(sx, 0, 0, sy, -crop.x * sx, -crop.y * sy);
  // Place l'image tournée dans le repère de la boîte englobante.
  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(rad(rotation));
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return out;
}
