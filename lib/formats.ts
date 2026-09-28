// Définition des deux formats de planche.
// Toutes les dimensions de sortie sont exprimées à 600 DPI (1 cm = 236,22 px).

export type FormatId = "ants8" | "custom4";

export interface PhotoFormat {
  id: FormatId;
  label: string;
  shortLabel: string;
  description: string;
  /** Taille d'une photo en mm */
  photoMm: { w: number; h: number };
  /** Taille d'une photo en px @600 DPI */
  photoPx: { w: number; h: number };
  /** Nombre de colonnes / lignes sur la planche */
  cols: number;
  rows: number;
  /**
   * Orientation de la planche 10x15.
   * 8 photos de 3,5x4,5 ne tiennent sur 10x15 qu'en paysage (4 x 3,5 = 14 cm ; 2 x 4,5 = 9 cm).
   * 4 photos de 4x6 tiennent en portrait (2 x 4 = 8 cm ; 2 x 6 = 12 cm).
   */
  orientation: "portrait" | "landscape";
  /** Taille de la planche en mm et en px @600 DPI */
  sheetMm: { w: number; h: number };
  sheetPx: { w: number; h: number };
  /** Ratio de la hauteur de tête (menton → sommet du crâne) attendu, en fraction de la hauteur photo */
  headRatio: { min: number; max: number };
  official: boolean;
}

export const DPI = 600;
export const MM_TO_PX = DPI / 25.4;

export const FORMATS: Record<FormatId, PhotoFormat> = {
  ants8: {
    id: "ants8",
    label: "Format Officiel ANTS",
    shortLabel: "ANTS 3,5 × 4,5",
    description: "Planche de 8 photos 3,5 × 4,5 cm sur papier 10 × 15 cm",
    photoMm: { w: 35, h: 45 },
    photoPx: { w: 826, h: 1062 },
    cols: 4,
    rows: 2,
    orientation: "landscape",
    sheetMm: { w: 150, h: 100 },
    sheetPx: { w: 3543, h: 2362 },
    // 32 mm à 36 mm sur 45 mm
    headRatio: { min: 32 / 45, max: 36 / 45 },
    official: true,
  },
  custom4: {
    id: "custom4",
    label: "Format Personnalisé",
    shortLabel: "4 × 6 cm",
    description: "Planche de 4 photos 4,0 × 6,0 cm sur papier 10 × 15 cm",
    photoMm: { w: 40, h: 60 },
    photoPx: { w: 944, h: 1417 },
    cols: 2,
    rows: 2,
    orientation: "portrait",
    sheetMm: { w: 100, h: 150 },
    sheetPx: { w: 2362, h: 3543 },
    headRatio: { min: 0.7, max: 0.8 },
    official: false,
  },
};

export function aspectOf(f: PhotoFormat) {
  return f.photoMm.w / f.photoMm.h;
}
