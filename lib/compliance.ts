// Moteur de contrôle de conformité (règles ANTS / OACI).
//
// - Géométrie & expression : détection de visage MediaPipe Face Landmarker (chargée
//   depuis un CDN à la première analyse). Si le chargement échoue (hors-ligne, navigateur
//   ancien), le moteur bascule sur des heuristiques pixel et demande une vérification visuelle.
// - Fond, éclairage, netteté, résolution : analyse des pixels, toujours disponible.
// - Obstacles (lunettes, couvre-chef, cheveux) : validation visuelle par le commerçant.
//
// Ce contrôle est une AIDE. Il ne remplace pas l'œil du commerçant et ne constitue pas
// une certification officielle.

import type { PhotoFormat } from "./formats";

export type PillarId = "geometry" | "expression" | "lighting" | "obstacles" | "quality";
export type Status = "ok" | "warn" | "fail" | "manual";

export interface Check {
  id: PillarId;
  title: string;
  status: Status;
  messages: string[];
  /** true = résultat calculé automatiquement ; false = nécessite un contrôle visuel */
  auto: boolean;
}

export interface Markers {
  crown?: number; // 0..1 (hauteur photo)
  chin?: number;
  eyeL?: { x: number; y: number };
  eyeR?: { x: number; y: number };
}

export interface ComplianceReport {
  checks: Check[];
  engine: "ia" | "heuristique";
  markers: Markers;
}

export const PILLAR_TITLES: Record<PillarId, string> = {
  geometry: "Géométrie & cadrage",
  expression: "Expression neutre",
  lighting: "Fond & éclairage",
  obstacles: "Visage dégagé",
  quality: "Netteté & résolution",
};

export const OBSTACLE_ITEMS = [
  "Pas de lunettes épaisses ni de reflet sur les verres",
  "Aucun couvre-chef ni accessoire sur la tête",
  "Front, sourcils et yeux dégagés (pas de mèche)",
  "Oreilles et contour du visage visibles",
] as const;

export const GEOMETRY_ITEMS = [
  "Sommet du crâne et menton dans les bandes vertes",
  "Visage centré sur l'axe, yeux horizontaux",
] as const;

export const EXPRESSION_ITEMS = [
  "Yeux ouverts, regard face à l'objectif",
  "Bouche fermée, sans sourire",
] as const;

// ------------------------------------------------------------------
// Chargement MediaPipe (runtime, via CDN — aucune dépendance npm)
// ------------------------------------------------------------------

const MP_VERSION = "0.10.14";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let landmarkerPromise: Promise<any> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLandmarker(): Promise<any | null> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const url = `${MP_BASE}/vision_bundle.mjs`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp: any = await import(/* webpackIgnore: true */ url);
      const fileset = await mp.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      return mp.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 2,
        outputFaceBlendshapes: true,
      });
    })();
  }
  try {
    return await withTimeout(landmarkerPromise, 20000);
  } catch (e) {
    console.warn("[PhotANTS] Détection IA indisponible, bascule en mode heuristique", e);
    landmarkerPromise = null;
    return null;
  }
}

/** Précharge le modèle en arrière-plan (appelé à l'ouverture de l'atelier). */
export function preloadDetector() {
  void getLandmarker();
}

// ------------------------------------------------------------------
// Outils pixel
// ------------------------------------------------------------------

interface Px {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function regionStats(px: Px, x0: number, y0: number, x1: number, y1: number) {
  const X0 = Math.max(0, Math.floor(x0 * px.w));
  const X1 = Math.min(px.w, Math.ceil(x1 * px.w));
  const Y0 = Math.max(0, Math.floor(y0 * px.h));
  const Y1 = Math.min(px.h, Math.ceil(y1 * px.h));
  let n = 0,
    r = 0,
    g = 0,
    b = 0,
    l = 0,
    l2 = 0,
    clipped = 0;
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const i = (y * px.w + x) * 4;
      const L = luma(px.data[i], px.data[i + 1], px.data[i + 2]);
      r += px.data[i];
      g += px.data[i + 1];
      b += px.data[i + 2];
      l += L;
      l2 += L * L;
      if (L > 250) clipped++;
      n++;
    }
  }
  if (!n) return null;
  const mean = l / n;
  return {
    n,
    r: r / n,
    g: g / n,
    b: b / n,
    l: mean,
    std: Math.sqrt(Math.max(0, l2 / n - mean * mean)),
    clipped: clipped / n,
  };
}

function mergeStats(list: NonNullable<ReturnType<typeof regionStats>>[]) {
  const n = list.reduce((s, a) => s + a.n, 0);
  const avg = (k: "r" | "g" | "b" | "l") => list.reduce((s, a) => s + a[k] * a.n, 0) / n;
  const l = avg("l");
  // variance combinée
  const v = list.reduce((s, a) => s + a.n * (a.std * a.std + (a.l - l) ** 2), 0) / n;
  return { r: avg("r"), g: avg("g"), b: avg("b"), l, std: Math.sqrt(v) };
}

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
}

/** Variance du laplacien (mesure de netteté) sur une zone. */
function laplacianVariance(px: Px, x0: number, y0: number, x1: number, y1: number) {
  const X0 = Math.max(1, Math.floor(x0 * px.w));
  const X1 = Math.min(px.w - 1, Math.ceil(x1 * px.w));
  const Y0 = Math.max(1, Math.floor(y0 * px.h));
  const Y1 = Math.min(px.h - 1, Math.ceil(y1 * px.h));
  const g = (x: number, y: number) => {
    const i = (y * px.w + x) * 4;
    return luma(px.data[i], px.data[i + 1], px.data[i + 2]);
  };
  let n = 0,
    s = 0,
    s2 = 0;
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const v = g(x - 1, y) + g(x + 1, y) + g(x, y - 1) + g(x, y + 1) - 4 * g(x, y);
      s += v;
      s2 += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const m = s / n;
  return s2 / n - m * m;
}

/** Sommet du crâne : première ligne (en partant du haut) où la silhouette se détache du fond. */
function findCrown(px: Px, bg: { r: number; g: number; b: number }, cx: number, band = 0.22) {
  const X0 = Math.max(0, Math.floor((cx - band) * px.w));
  const X1 = Math.min(px.w, Math.ceil((cx + band) * px.w));
  const width = X1 - X0;
  for (let y = 0; y < px.h * 0.6; y++) {
    let hits = 0;
    for (let x = X0; x < X1; x++) {
      const i = (y * px.w + x) * 4;
      const d =
        Math.abs(px.data[i] - bg.r) + Math.abs(px.data[i + 1] - bg.g) + Math.abs(px.data[i + 2] - bg.b);
      if (d > 60) hits++;
    }
    if (hits > width * 0.18) return y / px.h;
  }
  return null;
}

/** Centre horizontal de la silhouette (heuristique sans IA). */
function silhouetteCenter(px: Px, bg: { r: number; g: number; b: number }, y0: number, y1: number) {
  let sx = 0,
    n = 0;
  const Y0 = Math.floor(y0 * px.h),
    Y1 = Math.floor(y1 * px.h);
  for (let y = Y0; y < Y1; y += 2) {
    for (let x = 0; x < px.w; x += 2) {
      const i = (y * px.w + x) * 4;
      const d =
        Math.abs(px.data[i] - bg.r) + Math.abs(px.data[i + 1] - bg.g) + Math.abs(px.data[i + 2] - bg.b);
      if (d > 60) {
        sx += x;
        n++;
      }
    }
  }
  return n ? sx / n / px.w : null;
}

function worst(...s: Status[]): Status {
  if (s.includes("fail")) return "fail";
  if (s.includes("warn")) return "warn";
  if (s.includes("manual")) return "manual";
  return "ok";
}

// ------------------------------------------------------------------
// Analyse principale
// ------------------------------------------------------------------

export interface AnalyzeInput {
  /** Photo recadrée (idéalement à la taille finale 600 DPI) */
  photo: HTMLCanvasElement;
  format: PhotoFormat;
  /** Largeur du recadrage dans l'image source, en pixels (pour juger la résolution réelle) */
  sourceCropWidth: number;
}

export async function analyzePhoto({ photo, format, sourceCropWidth }: AnalyzeInput): Promise<ComplianceReport> {
  // Réduction pour l'analyse
  const AW = 420;
  const AH = Math.round((AW * photo.height) / photo.width);
  const c = document.createElement("canvas");
  c.width = AW;
  c.height = AH;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(photo, 0, 0, AW, AH);
  const px: Px = { data: ctx.getImageData(0, 0, AW, AH).data, w: AW, h: AH };

  const landmarker = await getLandmarker();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = null;
  if (landmarker) {
    try {
      result = landmarker.detect(c);
    } catch (e) {
      console.warn("[PhotANTS] Échec de détection", e);
    }
  }
  const engine: ComplianceReport["engine"] = result ? "ia" : "heuristique";
  const faces: { x: number; y: number }[][] = result?.faceLandmarks ?? [];
  const lm = faces[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapes: Record<string, number> = {};
  (result?.faceBlendshapes?.[0]?.categories ?? []).forEach((cat: { categoryName: string; score: number }) => {
    shapes[cat.categoryName] = cat.score;
  });

  const markers: Markers = {};

  // ---------- Fond ----------
  const faceMinX = lm ? Math.min(...lm.map((p) => p.x)) : 0.25;
  const faceMaxX = lm ? Math.max(...lm.map((p) => p.x)) : 0.75;
  const leftRegions = [
    regionStats(px, 0.02, 0.02, 0.14, 0.18),
    faceMinX > 0.14 ? regionStats(px, 0.02, 0.2, Math.min(0.12, faceMinX - 0.06), 0.38) : null,
  ].filter(Boolean) as NonNullable<ReturnType<typeof regionStats>>[];
  const rightRegions = [
    regionStats(px, 0.86, 0.02, 0.98, 0.18),
    faceMaxX < 0.86 ? regionStats(px, Math.max(0.88, faceMaxX + 0.06), 0.2, 0.98, 0.38) : null,
  ].filter(Boolean) as NonNullable<ReturnType<typeof regionStats>>[];
  const bgAll = mergeStats([...leftRegions, ...rightRegions]);
  const bgL = mergeStats(leftRegions);
  const bgR = mergeStats(rightRegions);
  const bgHsv = hsv(bgAll.r, bgAll.g, bgAll.b);

  const lightMsgs: string[] = [];
  const lightStatus: Status[] = [];
  const bluish = bgHsv.h >= 180 && bgHsv.h <= 250;
  if (bgAll.l > 236 && bgHsv.s < 0.08) {
    lightStatus.push("fail");
    lightMsgs.push("Fond blanc interdit : utilisez un fond gris clair ou bleu clair");
  } else if (bgHsv.s > 0.12 && !bluish) {
    lightStatus.push("fail");
    lightMsgs.push("Fond coloré : seuls le gris clair et le bleu clair sont acceptés");
  } else if (bgAll.l < 125) {
    lightStatus.push("fail");
    lightMsgs.push("Fond trop sombre");
  } else if (bgHsv.s > 0.4) {
    lightStatus.push("warn");
    lightMsgs.push("Fond bleu trop soutenu : préférez un bleu très clair");
  }
  if (bgAll.std > 22) {
    lightStatus.push("fail");
    lightMsgs.push("Fond non uni (motif, objet ou relief visible)");
  } else if (bgAll.std > 14) {
    lightStatus.push("warn");
    lightMsgs.push("Fond légèrement irrégulier");
  }
  if (Math.abs(bgL.l - bgR.l) > 28) {
    lightStatus.push("fail");
    lightMsgs.push("Ombre portée ou dégradé marqué sur le fond");
  } else if (Math.abs(bgL.l - bgR.l) > 16) {
    lightStatus.push("warn");
    lightMsgs.push("Éclairage du fond inégal (ombre possible derrière la tête)");
  }

  // Éclairage du visage
  const face = lm
    ? regionStats(px, faceMinX, Math.min(...lm.map((p) => p.y)), faceMaxX, Math.max(...lm.map((p) => p.y)))
    : regionStats(px, 0.38, 0.3, 0.62, 0.6);
  if (face) {
    if (face.l < 75) {
      lightStatus.push("fail");
      lightMsgs.push("Visage sous-exposé (trop sombre)");
    } else if (face.l > 215 || face.clipped > 0.08) {
      lightStatus.push("warn");
      lightMsgs.push("Visage surexposé ou reflets de flash");
    }
  }
  let cheekL = null,
    cheekR = null;
  if (lm) {
    const r = 0.035;
    cheekL = regionStats(px, lm[50].x - r, lm[50].y - r, lm[50].x + r, lm[50].y + r);
    cheekR = regionStats(px, lm[280].x - r, lm[280].y - r, lm[280].x + r, lm[280].y + r);
  } else if (face) {
    cheekL = regionStats(px, 0.33, 0.4, 0.45, 0.6);
    cheekR = regionStats(px, 0.55, 0.4, 0.67, 0.6);
  }
  if (cheekL && cheekR) {
    const asym = Math.abs(cheekL.l - cheekR.l) / Math.max(cheekL.l, cheekR.l, 1);
    if (asym > 0.3) {
      lightStatus.push("fail");
      lightMsgs.push("Ombre marquée sur une moitié du visage");
    } else if (asym > 0.17) {
      lightStatus.push("warn");
      lightMsgs.push("Éclairage du visage légèrement inégal");
    }
  }
  if (!lightMsgs.length) lightMsgs.push("Fond uni et neutre, éclairage homogène");

  // ---------- Qualité ----------
  const qStatus: Status[] = [];
  const qMsgs: string[] = [];
  const needed = format.photoPx.w;
  const resRatio = sourceCropWidth / needed;
  if (resRatio < 0.5) {
    qStatus.push("fail");
    qMsgs.push(`Résolution insuffisante (${Math.round(sourceCropWidth)} px utiles pour ${needed} px requis) : dézoomez ou reprenez la photo`);
  } else if (resRatio < 0.85) {
    qStatus.push("warn");
    qMsgs.push(`Résolution limite (${Math.round(sourceCropWidth)} px utiles / ${needed} px pour 600 DPI)`);
  }
  const sharpZone = lm
    ? [faceMinX, Math.min(...lm.map((p) => p.y)), faceMaxX, Math.max(...lm.map((p) => p.y))]
    : [0.35, 0.25, 0.65, 0.65];
  // Normalisation : on mesure la netteté sur le visage ramené à ~420 px de large de photo.
  const lapVar = laplacianVariance(px, sharpZone[0], sharpZone[1], sharpZone[2], sharpZone[3]);
  if (lapVar < 18) {
    qStatus.push("fail");
    qMsgs.push("Image floue (bougé ou mise au point)");
  } else if (lapVar < 40) {
    qStatus.push("warn");
    qMsgs.push("Netteté moyenne : vérifiez les yeux à l'aperçu");
  }
  if (!qMsgs.length) qMsgs.push("Image nette, résolution suffisante pour 600 DPI");

  // ---------- Géométrie ----------
  const gStatus: Status[] = [];
  const gMsgs: string[] = [];
  let expression: Check;

  if (lm) {
    if (faces.length > 1) {
      gStatus.push("fail");
      gMsgs.push("Plusieurs visages détectés");
    }
    const hasIris = lm.length >= 478;
    const eyeR = hasIris ? lm[468] : lm[33]; // œil droit du sujet (à gauche de l'image)
    const eyeL = hasIris ? lm[473] : lm[263];
    markers.eyeL = { x: eyeL.x, y: eyeL.y };
    markers.eyeR = { x: eyeR.x, y: eyeR.y };

    const chin = lm[152].y;
    const forehead = lm[10].y;
    const cx = (lm[33].x + lm[263].x) / 2;
    const silCrown = findCrown(px, bgAll, cx);
    const estCrown = forehead - 0.33 * (chin - forehead);
    const crown = silCrown !== null && silCrown < forehead && silCrown > estCrown - 0.12 ? silCrown : estCrown;
    markers.crown = crown;
    markers.chin = chin;

    const head = chin - crown;
    const { min, max } = format.headRatio;
    const mmHead = (head * format.photoMm.h).toFixed(1);
    if (crown <= 0.005) {
      gStatus.push("fail");
      gMsgs.push("Sommet du crâne coupé : dézoomez");
    }
    if (chin >= 0.985) {
      gStatus.push("fail");
      gMsgs.push("Menton coupé : dézoomez ou remontez l'image");
    }
    if (head < min - 0.03) {
      gStatus.push("fail");
      gMsgs.push(`Visage trop petit (${mmHead} mm) : zoomez`);
    } else if (head < min) {
      gStatus.push("warn");
      gMsgs.push(`Visage un peu petit (${mmHead} mm) : zoomez légèrement`);
    } else if (head > max + 0.03) {
      gStatus.push("fail");
      gMsgs.push(`Visage trop grand (${mmHead} mm) : dézoomez`);
    } else if (head > max) {
      gStatus.push("warn");
      gMsgs.push(`Visage un peu grand (${mmHead} mm) : dézoomez légèrement`);
    }

    const midX = (eyeL.x + eyeR.x) / 2;
    const off = Math.abs(midX - 0.5);
    if (off > 0.06) {
      gStatus.push("fail");
      gMsgs.push("Visage mal centré horizontalement");
    } else if (off > 0.03) {
      gStatus.push("warn");
      gMsgs.push("Visage légèrement décentré");
    }
    const tilt = Math.abs((Math.atan2(lm[263].y - lm[33].y, lm[263].x - lm[33].x) * 180) / Math.PI);
    if (tilt > 5) {
      gStatus.push("fail");
      gMsgs.push(`Tête inclinée (${tilt.toFixed(1)}°) : corrigez avec la rotation`);
    } else if (tilt > 2) {
      gStatus.push("warn");
      gMsgs.push(`Yeux pas tout à fait horizontaux (${tilt.toFixed(1)}°)`);
    }
    const yaw = (lm[1].x - lm[234].x) / Math.max(1e-6, lm[454].x - lm[234].x);
    if (yaw < 0.35 || yaw > 0.65) {
      gStatus.push("fail");
      gMsgs.push("Visage tourné : le client doit regarder droit devant");
    } else if (yaw < 0.42 || yaw > 0.58) {
      gStatus.push("warn");
      gMsgs.push("Visage légèrement de trois-quarts");
    }
    if (!gMsgs.length)
      gMsgs.push(`Tête ${mmHead} mm, yeux centrés et horizontaux`);

    // ---------- Expression ----------
    const eStatus: Status[] = [];
    const eMsgs: string[] = [];
    const blink = Math.max(shapes.eyeBlinkLeft ?? 0, shapes.eyeBlinkRight ?? 0);
    const smile = ((shapes.mouthSmileLeft ?? 0) + (shapes.mouthSmileRight ?? 0)) / 2;
    const jaw = shapes.jawOpen ?? 0;
    const gaze = Math.max(
      shapes.eyeLookOutLeft ?? 0,
      shapes.eyeLookOutRight ?? 0,
      shapes.eyeLookInLeft ?? 0,
      shapes.eyeLookInRight ?? 0,
      shapes.eyeLookUpLeft ?? 0,
      shapes.eyeLookUpRight ?? 0,
      shapes.eyeLookDownLeft ?? 0,
      shapes.eyeLookDownRight ?? 0
    );
    if (blink > 0.55) {
      eStatus.push("fail");
      eMsgs.push("Yeux fermés");
    } else if (blink > 0.4) {
      eStatus.push("warn");
      eMsgs.push("Yeux mi-clos");
    }
    if (smile > 0.35) {
      eStatus.push("fail");
      eMsgs.push("Sourire détecté : expression neutre obligatoire");
    } else if (smile > 0.18) {
      eStatus.push("warn");
      eMsgs.push("Léger sourire détecté");
    }
    if (jaw > 0.2) {
      eStatus.push("fail");
      eMsgs.push("Bouche ouverte");
    } else if (jaw > 0.1) {
      eStatus.push("warn");
      eMsgs.push("Bouche entrouverte");
    }
    if (gaze > 0.55) {
      eStatus.push("warn");
      eMsgs.push("Regard non dirigé vers l'objectif");
    }
    if (!eMsgs.length) eMsgs.push("Yeux ouverts, bouche fermée, sans sourire");
    expression = {
      id: "expression",
      title: PILLAR_TITLES.expression,
      status: worst("ok", ...eStatus),
      messages: eMsgs,
      auto: true,
    };
  } else {
    // Pas de visage détecté (ou IA indisponible) : heuristiques
    if (result) {
      gStatus.push("fail");
      gMsgs.push("Aucun visage détecté : recadrez ou reprenez la photo");
    } else {
      const crown = findCrown(px, bgAll, 0.5, 0.3);
      if (crown !== null) markers.crown = crown;
      if (crown === null || crown <= 0.005) {
        gStatus.push("warn");
        gMsgs.push("Sommet du crâne non repéré : vérifiez qu'il n'est pas coupé");
      } else if (crown > 0.16) {
        gStatus.push("warn");
        gMsgs.push("Tête probablement trop petite : zoomez");
      }
      const center = silhouetteCenter(px, bgAll, crown ?? 0.1, 0.6);
      if (center !== null && Math.abs(center - 0.5) > 0.06) {
        gStatus.push("warn");
        gMsgs.push("Silhouette décentrée");
      }
      gStatus.push("manual");
      gMsgs.push("Détection IA indisponible : alignez le visage sur les repères de l'atelier");
    }
    expression = {
      id: "expression",
      title: PILLAR_TITLES.expression,
      status: "manual",
      messages: ["À vérifier visuellement"],
      auto: false,
    };
  }

  const checks: Check[] = [
    {
      id: "geometry",
      title: PILLAR_TITLES.geometry,
      // Sans IA, la géométrie n'est qu'indicative : validation visuelle via les repères.
      status: lm || result ? worst("ok", ...gStatus) : "manual",
      messages: gMsgs,
      auto: !!lm || !!result,
    },
    expression,
    {
      id: "lighting",
      title: PILLAR_TITLES.lighting,
      status: worst("ok", ...lightStatus),
      messages: lightMsgs,
      auto: true,
    },
    {
      id: "obstacles",
      title: PILLAR_TITLES.obstacles,
      status: "manual",
      messages: ["Contrôle visuel requis"],
      auto: false,
    },
    {
      id: "quality",
      title: PILLAR_TITLES.quality,
      status: worst("ok", ...qStatus),
      messages: qMsgs,
      auto: true,
    },
  ];

  return { checks, engine, markers };
}

/** Indice de conformité (0..100) : ok = 1, avertissement = 0,5, échec / non vérifié = 0. */
export function complianceScore(statuses: Status[]) {
  const pts = statuses.reduce((s, st) => s + (st === "ok" ? 1 : st === "warn" ? 0.5 : 0), 0);
  return Math.round((pts / statuses.length) * 100);
}
