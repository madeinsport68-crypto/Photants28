"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Camera,
  FolderOpen,
  Loader2,
  RotateCcw,
  RotateCw,
  ScanFace,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Hand,
  Wand2,
} from "lucide-react";
import type { PhotoFormat } from "@/lib/formats";
import { aspectOf } from "@/lib/formats";
import { fileToImageUrl } from "@/lib/image";
import { preloadDetector } from "@/lib/compliance";
import { removeBackgroundAndApplyLight, preloadSegmenter } from "@/lib/backgroundRemoval";
import CameraCapture from "./CameraCapture";
import BackgroundRemovalPreview from "./BackgroundRemovalPreview";

export interface CropState {
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  pixels: Area | null;
}

interface Props {
  format: PhotoFormat;
  imageSrc: string | null;
  onImage: (src: string) => void;
  cropState: CropState;
  onCropState: (s: CropState) => void;
  onValidate: () => void;
  onBack: () => void;
  busy: boolean;
}

export default function Workbench({ format, imageSrc, onImage, cropState, onCropState, onValidate, onBack, busy }: Props) {
  const [camera, setCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showBackgroundRemoval, setShowBackgroundRemoval] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aspect = aspectOf(format);

  useEffect(() => {
    preloadDetector();
    preloadSegmenter();
  }, []);

  const set = (patch: Partial<CropState>) => onCropState({ ...cropState, ...patch });

  const onFile = async (file?: File) => {
    if (!file) return;
    setErr(null);
    setLoading(true);
    try {
      const url = await fileToImageUrl(file);
      await processImageWithBackground(url);
    } catch {
      setErr("Ce fichier n'a pas pu être lu. Formats acceptés : JPG, PNG, HEIC.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const processImageWithBackground = async (imageUrl: string) => {
    setIsProcessingBackground(true);
    try {
      // Charge l'image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          // Crée un canvas temporaire avec l'image
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
          const ctx = tempCanvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);

          // Applique le détourage et le fond clair
          const resultCanvas = await removeBackgroundAndApplyLight(tempCanvas, "#F5F5F5");

          // Convertit en URL
          const processedUrl = resultCanvas.toDataURL("image/png");
          onImage(processedUrl);
        } catch (e) {
          console.error("Erreur lors du détourage:", e);
          // En cas d'erreur, utilise l'image originale
          onImage(imageUrl);
        } finally {
          setIsProcessingBackground(false);
        }
      };
      img.onerror = () => {
        console.error("Impossible de charger l'image");
        onImage(imageUrl);
        setIsProcessingBackground(false);
      };
      img.src = imageUrl;
    } catch (e) {
      console.error(e);
      onImage(imageUrl);
      setIsProcessingBackground(false);
    }
  };

  // Repères ANTS dans la zone de recadrage : sommet du crâne, menton, axe vertical.
  const crownA = 4,
    crownB = 12;
  const chinA = Math.round((0.08 + format.headRatio.min) * 100);
  const chinB = Math.round((0.08 + format.headRatio.max) * 100);
  const guideStyle: React.CSSProperties = {
    border: "3px solid rgba(255,255,255,0.95)",
    backgroundImage: [
      `linear-gradient(to bottom, transparent ${crownA}%, rgba(16,185,129,0.28) ${crownA}%, rgba(16,185,129,0.28) ${crownB}%, transparent ${crownB}%, transparent ${chinA}%, rgba(16,185,129,0.28) ${chinB}%, transparent ${chinB}%)`,
      "linear-gradient(to right, transparent calc(50% - 1px), rgba(255,255,255,0.7) calc(50% - 1px), rgba(255,255,255,0.7) calc(50% + 1px), transparent calc(50% + 1px))",
    ].join(","),
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="flex h-11 items-center gap-2 rounded-xl px-3 font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" /> Formats
        </button>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm dark:bg-slate-900">
          {format.label} · {format.photoMm.w / 10} × {format.photoMm.h / 10} cm
        </div>
      </div>

      {/* Sources */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => setCamera(true)}
          className="flex h-20 items-center justify-center gap-3 rounded-2xl bg-brand-blue text-xl font-black text-white shadow-lg shadow-brand-blue/25 transition hover:bg-brand-blueDark active:scale-[0.99] disabled:opacity-50"
          disabled={isProcessingBackground}
        >
          <Camera className="h-7 w-7" /> APPAREIL PHOTO
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-20 items-center justify-center gap-3 rounded-2xl border-2 border-slate-300 bg-white text-xl font-black shadow-sm transition hover:border-brand-blue active:scale-[0.99] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-brand-blue"
          disabled={loading || isProcessingBackground}
        >
          {loading || isProcessingBackground ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <FolderOpen className="h-7 w-7" />
          )}
          {isProcessingBackground ? "TRAITEMENT..." : "TÉLÉVERSER"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={isProcessingBackground}
        />
      </div>
      {err && <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">{err}</p>}

      {/* Atelier de recadrage */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-3xl bg-slate-800 shadow-inner">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={cropState.crop}
              zoom={cropState.zoom}
              rotation={cropState.rotation}
              aspect={aspect}
              minZoom={1}
              maxZoom={5}
              zoomSpeed={0.15}
              showGrid={false}
              onCropChange={(crop) => set({ crop })}
              onZoomChange={(zoom) => set({ zoom })}
              onRotationChange={(rotation) => set({ rotation })}
              onCropComplete={(_a, pixels) => onCropState({ ...cropState, pixels })}
              style={{ cropAreaStyle: guideStyle }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
              <ScanFace className="h-16 w-16 opacity-60" />
              <p className="text-lg font-semibold">Prenez une photo ou téléversez un fichier</p>
              <p className="text-sm opacity-70">JPG, PNG ou HEIC (iPhone)</p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
          <div>
            <h3 className="text-lg font-black">Ajustement</h3>
            <p className="mt-1 flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Hand className="mt-0.5 h-4 w-4 shrink-0" />
              Un doigt pour déplacer, deux doigts pour zoomer.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-sm font-semibold">
              Zoom <span className="tabular-nums text-slate-500">{Math.round(cropState.zoom * 100)} %</span>
            </span>
            <div className="flex items-center gap-3">
              <ZoomOut className="h-5 w-5 text-slate-500" />
              <input
                type="range"
                className="touch-range w-full"
                min={1}
                max={5}
                step={0.01}
                value={cropState.zoom}
                disabled={!imageSrc}
                onChange={(e) => set({ zoom: Number(e.target.value) })}
              />
              <ZoomIn className="h-5 w-5 text-slate-500" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-sm font-semibold">
              Redresser la tête <span className="tabular-nums text-slate-500">{cropState.rotation.toFixed(1)}°</span>
            </span>
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-slate-500" />
              <input
                type="range"
                className="touch-range w-full"
                min={-15}
                max={15}
                step={0.5}
                value={cropState.rotation}
                disabled={!imageSrc}
                onChange={(e) => set({ rotation: Number(e.target.value) })}
              />
              <RotateCw className="h-5 w-5 text-slate-500" />
            </div>
          </label>

          <button
            onClick={() => onCropState({ crop: { x: 0, y: 0 }, zoom: 1, rotation: 0, pixels: cropState.pixels })}
            disabled={!imageSrc}
            className="h-11 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Réinitialiser le cadrage
          </button>

          <div className="rounded-2xl bg-violet-50 p-4 text-sm dark:bg-violet-900/30">
            <p className="mb-2 flex items-center gap-2 font-bold text-violet-900 dark:text-violet-300">
              <Wand2 className="h-4 w-4" /> Détourage appliqué
            </p>
            <p className="text-violet-800 dark:text-violet-200">
              Le fond a été automatiquement supprimé et remplacé par un gris clair (#F5F5F5) conforme ANTS/OACI.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-800">
            <p className="mb-2 font-bold">Repères de cadrage</p>
            <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-emerald-500/60" />
                Bande haute : sommet du crâne
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-emerald-500/60" />
                Bande basse : menton
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-3 w-0.5 shrink-0 bg-slate-400" />
                Axe central : milieu du nez
              </li>
            </ul>
          </div>

          <button
            onClick={onValidate}
            disabled={!imageSrc || !cropState.pixels || busy}
            className="mt-auto flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ScanFace className="h-6 w-6" />}
            VALIDER &amp; ANALYSER
          </button>
        </aside>
      </div>

      {camera && (
        <CameraCapture
          aspect={aspect}
          onClose={() => setCamera(false)}
          onCapture={async (url) => {
            setCamera(false);
            await processImageWithBackground(url);
          }}
        />
      )}
    </section>
  );
}
