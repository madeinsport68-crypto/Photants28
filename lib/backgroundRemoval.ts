// Détourage automatique et application de fond clair avec MediaPipe Selfie Segmentation

let segmenterInstance: any = null;

/**
 * Charge le modèle MediaPipe Selfie Segmentation (téléchargé une seule fois).
 * Fonctionne également en mode dégradé si indisponible.
 */
async function getSegmenter() {
  if (segmenterInstance) return segmenterInstance;

  try {
    const vision = await import("@mediapipe/tasks-vision");
    const { FilesetResolver, ImageSegmenter } = vision as any;

    const wasmLoaderPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
    const filesetResolver = await FilesetResolver.forVisionTasks(wasmLoaderPath);

    segmenterInstance = await ImageSegmenter.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });

    console.log("✅ MediaPipe ImageSegmenter chargé");
    return segmenterInstance;
  } catch (err) {
    console.warn("⚠️ Segmenter indisponible, mode dégradé activé", err);
    return null;
  }
}

/**
 * Remplace le fond par une couleur claire, sans toucher au sujet.
 * Le masque est appliqué correctement: les pixels du fond deviennent gris clair,
 * et les pixels du sujet restent inchangés.
 */
export async function removeBackgroundAndApplyLight(
  canvasInput: HTMLCanvasElement | HTMLImageElement,
  backgroundColor = "#F5F5F5"
): Promise<HTMLCanvasElement> {
  const segmenter = await getSegmenter();

  if (!segmenter) {
    console.log("Retour au mode normal (pas de segmentation)");
    if (canvasInput instanceof HTMLCanvasElement) return canvasInput;
    const canvas = document.createElement("canvas");
    canvas.width = canvasInput.width;
    canvas.height = canvasInput.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(canvasInput, 0, 0);
    return canvas;
  }

  try {
    const sourceImage = canvasInput as HTMLCanvasElement | HTMLImageElement;
    const segmentationResult =
      typeof segmenter.segmentForVideo === "function"
        ? segmenter.segmentForVideo(sourceImage, performance.now())
        : await segmenter.segment(sourceImage);

    const categoryMask = segmentationResult?.categoryMask;
    if (!categoryMask || typeof categoryMask.getAsUint8Array !== "function") {
      throw new Error("Masque de segmentation introuvable");
    }

    const width = sourceImage.width || (sourceImage as HTMLCanvasElement).width;
    const height = sourceImage.height || (sourceImage as HTMLCanvasElement).height;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true })!;
    sourceCtx.drawImage(sourceImage, 0, 0, width, height);

    const sourceData = sourceCtx.getImageData(0, 0, width, height);
    const mask = categoryMask.getAsUint8Array();
    const output = new ImageData(width, height);

    // Convert backgroundColor hex -> RGB
    const bg = hexToRgb(backgroundColor);

    for (let i = 0; i < mask.length; i++) {
      const offset = i * 4;
      const isForeground = mask[i] > 0;

      if (isForeground) {
        output.data[offset] = sourceData.data[offset];
        output.data[offset + 1] = sourceData.data[offset + 1];
        output.data[offset + 2] = sourceData.data[offset + 2];
        output.data[offset + 3] = 255;
      } else {
        output.data[offset] = bg.r;
        output.data[offset + 1] = bg.g;
        output.data[offset + 2] = bg.b;
        output.data[offset + 3] = 255;
      }
    }

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext("2d")!;
    ctx.putImageData(output, 0, 0);
    return outputCanvas;
  } catch (err) {
    console.error("Erreur lors du détourage:", err);
    if (canvasInput instanceof HTMLCanvasElement) return canvasInput;
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = canvasInput.width;
    fallbackCanvas.height = canvasInput.height;
    fallbackCanvas.getContext("2d")!.drawImage(canvasInput, 0, 0);
    return fallbackCanvas;
  }
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "");
  const full = sanitized.length === 3 ? sanitized.split("").map((c) => c + c).join("") : sanitized;
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Précharge le modèle Selfie Segmenter au lancement de l'app.
 * Réduit le délai lors de la première utilisation.
 */
export async function preloadSegmenter() {
  try {
    await getSegmenter();
  } catch (err) {
    console.warn("Préchargement du segmenter échoué", err);
  }
}
