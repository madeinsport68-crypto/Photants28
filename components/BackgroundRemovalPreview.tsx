"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wand2, X } from "lucide-react";
import { removeBackgroundAndApplyLight } from "@/lib/backgroundRemoval";

interface Props {
  imageSrc: string;
  onApply: (processedImageUrl: string) => void;
  onCancel: () => void;
}

export default function BackgroundRemovalPreview({ imageSrc, onApply, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  useEffect(() => {
    processImage();
  }, [imageSrc]);

  const processImage = async () => {
    setProcessing(true);
    setError(null);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        // Crée un canvas temporaire avec l'image
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const ctx = tempCanvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        // Applique le détourage
        const resultCanvas = await removeBackgroundAndApplyLight(tempCanvas, "#F5F5F5");

        if (canvasRef.current) {
          const destCtx = canvasRef.current.getContext("2d")!;
          canvasRef.current.width = resultCanvas.width;
          canvasRef.current.height = resultCanvas.height;
          destCtx.drawImage(resultCanvas, 0, 0);
        }

        // Convertit en URL pour aperçu
        const url = resultCanvas.toDataURL("image/png");
        setProcessedUrl(url);
      };
      img.onerror = () => {
        setError("Impossible de charger l'image");
        setProcessing(false);
      };
      img.src = imageSrc;
    } catch (err) {
      setError("Erreur lors du traitement : " + (err instanceof Error ? err.message : "inconnu"));
      setProcessing(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = () => {
    if (processedUrl) {
      onApply(processedUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-black">Détourage & Fond clair</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Aperçu du résultat avec fond gris clair (#F5F5F5)
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={processing}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {processing ? (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                Traitement en cours...
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Téléchargement du modèle IA la première fois
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-red-100 p-6 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <p className="font-semibold">Erreur lors du détourage</p>
              <p className="mt-2 text-sm">{error}</p>
              <button
                onClick={processImage}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div ref={previewRef} className="space-y-4">
              <div className="relative rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <canvas
                  ref={canvasRef}
                  className="mx-auto h-auto max-h-96 w-auto rounded-xl shadow-md"
                />
              </div>

              <div className="rounded-2xl bg-blue-50 p-4 text-sm dark:bg-blue-900/30">
                <p className="font-semibold text-blue-900 dark:text-blue-300">
                  ✅ Détourage appliqué
                </p>
                <p className="mt-2 text-blue-800 dark:text-blue-200">
                  La photo a été détourée automatiquement. Le sujet est conservé et le fond remplacé par un gris très clair (#F5F5F5) conforme aux normes ANTS/OACI.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-200 p-6 dark:border-slate-700">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            onClick={handleApply}
            disabled={processing || !processedUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Wand2 className="h-5 w-5" />
            Appliquer le détourage
          </button>
        </div>
      </div>
    </div>
  );
}
