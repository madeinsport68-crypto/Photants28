"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Timer, X } from "lucide-react";

interface Props {
  aspect: number; // largeur / hauteur de la photo finale
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ aspect, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [useTimer, setUseTimer] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non disponible sur cet appareil ou connexion non sécurisée (HTTPS requis).");
        return;
      }
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur."
            : "Impossible d'ouvrir la caméra."
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing]);

  const snap = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stop();
    onCapture(c.toDataURL("image/jpeg", 0.95));
  }, [onCapture]);

  const trigger = () => {
    if (!useTimer) return snap();
    let n = 3;
    setCount(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setCount(null);
        snap();
      } else setCount(n);
    }, 1000);
  };

  const mirrored = facing === "user";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <span className="text-lg font-bold">Prise de vue</span>
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Fermer"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <p className="max-w-md px-6 text-center text-lg">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              className="h-full w-full object-contain"
              style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
            />
            {/* Guide : cadre au format + ovale du visage */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[82%]" style={{ aspectRatio: String(aspect) }}>
                <div className="absolute inset-0 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border-4 border-dashed border-emerald-400"
                  style={{ top: "8%", height: "68%", width: "62%" }}
                />
                <div className="absolute left-0 right-0 top-[38%] border-t border-dashed border-white/50" />
                <p className="absolute -bottom-9 left-1/2 w-max -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm">
                  Visage dans l&apos;ovale · regard droit · bouche fermée
                </p>
              </div>
            </div>
            {count !== null && (
              <div className="absolute inset-0 flex items-center justify-center text-[10rem] font-black drop-shadow-lg">
                {count}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 p-6">
        <button
          onClick={() => setUseTimer((t) => !t)}
          className={`flex h-14 items-center gap-2 rounded-full px-5 font-semibold ${
            useTimer ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <Timer className="h-5 w-5" /> 3 s
        </button>
        <button
          onClick={trigger}
          disabled={!ready || !!error || count !== null}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-brand-red transition active:scale-95 disabled:opacity-40"
          aria-label="Prendre la photo"
        >
          <Camera className="h-9 w-9" />
        </button>
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="flex h-14 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold hover:bg-white/20"
        >
          <RefreshCw className="h-5 w-5" /> Caméra
        </button>
      </div>
    </div>
  );
}
