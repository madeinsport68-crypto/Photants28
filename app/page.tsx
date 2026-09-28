"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanFace } from "lucide-react";
import Header from "@/components/Header";
import StepIndicator from "@/components/StepIndicator";
import FormatSelector from "@/components/FormatSelector";
import Workbench, { type CropState } from "@/components/Workbench";
import CompliancePanel, { resolveChecks, type ManualState } from "@/components/CompliancePanel";
import SheetPreview from "@/components/SheetPreview";
import PrintSheet from "@/components/PrintSheet";
import { FORMATS, type FormatId } from "@/lib/formats";
import { renderCrop } from "@/lib/image";
import { analyzePhoto, OBSTACLE_ITEMS, EXPRESSION_ITEMS, GEOMETRY_ITEMS, PILLAR_TITLES, type ComplianceReport } from "@/lib/compliance";
import { canvasToPngBlob, downloadBlob, renderSheet } from "@/lib/sheet";

const initialCrop: CropState = { crop: { x: 0, y: 0 }, zoom: 1, rotation: 0, pixels: null };
const initialManual = (): ManualState => ({
  obstacles: OBSTACLE_ITEMS.map(() => false),
  expression: EXPRESSION_ITEMS.map(() => false),
  geometry: GEOMETRY_ITEMS.map(() => false),
});

export default function Home() {
  const [step, setStep] = useState(0);
  const [formatId, setFormatId] = useState<FormatId>("ants8");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropState, setCropState] = useState<CropState>(initialCrop);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [manual, setManual] = useState<ManualState>(initialManual);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const sheetBlob = useRef<Blob | null>(null);

  const format = FORMATS[formatId];

  // Libère les URL blob remplacées
  useEffect(() => () => void (sheetUrl && URL.revokeObjectURL(sheetUrl)), [sheetUrl]);

  const reset = () => {
    setStep(0);
    setImageSrc(null);
    setCropState(initialCrop);
    setReport(null);
    setManual(initialManual());
    setPhotoUrl(null);
    setSheetUrl(null);
    sheetBlob.current = null;
  };

  const onImage = (src: string) => {
    setImageSrc(src);
    setCropState(initialCrop);
    setManual(initialManual());
    setReport(null);
  };

  const validate = async () => {
    if (!imageSrc || !cropState.pixels) return;
    setBusy(true);
    try {
      const photo = await renderCrop(imageSrc, cropState.pixels, cropState.rotation, format.photoPx.w, format.photoPx.h);
      const [rep] = await Promise.all([
        analyzePhoto({ photo, format, sourceCropWidth: cropState.pixels.width }),
        new Promise((r) => setTimeout(r, 1400)), // laisse le temps de lire l'écran d'analyse
      ]);
      const sheet = renderSheet(photo, format);
      const blob = await canvasToPngBlob(sheet, 600);
      sheetBlob.current = blob;
      setSheetUrl(URL.createObjectURL(blob));
      setPhotoUrl(photo.toDataURL("image/jpeg", 0.9));
      setReport(rep);
      setStep(2);
    } catch (e) {
      console.error(e);
      alert("L'analyse a échoué. Réessayez ou changez de photo.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!sheetBlob.current) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    downloadBlob(sheetBlob.current, `photants_${format.id}_${stamp}.png`);
  };

  const hasIssues = report ? resolveChecks(report, manual).some((c) => c.status === "fail") : false;

  return (
    <>
      <div className="no-print">
        <Header onHome={reset} showReset={step > 0} />
        <StepIndicator current={step} />

        {step === 0 && (
          <FormatSelector
            onSelect={(id) => {
              setFormatId(id);
              setStep(1);
            }}
          />
        )}

        {step === 1 && (
          <Workbench
            format={format}
            imageSrc={imageSrc}
            onImage={onImage}
            cropState={cropState}
            onCropState={setCropState}
            onValidate={validate}
            onBack={() => setStep(0)}
            busy={busy}
          />
        )}

        {step === 2 && report && sheetUrl && photoUrl && (
          <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[1fr_380px]">
            <SheetPreview format={format} sheetUrl={sheetUrl} onDownload={download} onPrint={() => window.print()} warn={hasIssues} />
            <CompliancePanel
              report={report}
              manual={manual}
              onManual={setManual}
              onRecrop={() => setStep(1)}
              format={format}
              photoUrl={photoUrl}
            />
          </section>
        )}

        {busy && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <div className="w-[min(92vw,420px)] rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900">
              <div className="relative mx-auto mb-5 h-20 w-20">
                <ScanFace className="h-20 w-20 text-brand-blue" />
                <span className="absolute inset-x-0 top-0 h-1 animate-[scan_1.4s_ease-in-out_infinite] rounded bg-brand-red" />
              </div>
              <p className="text-xl font-black">Vérification IA en cours...</p>
              <ul className="mt-5 space-y-2 text-left text-sm">
                {Object.values(PILLAR_TITLES).map((t, i) => (
                  <li key={t} className="flex items-center gap-2 text-slate-600 dark:text-slate-300" style={{ animation: `fadein .4s ${i * 0.22}s both` }}>
                    <Loader2 className="h-4 w-4 animate-spin text-brand-blue" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <style>{`
              @keyframes scan { 0%,100% { transform: translateY(0) } 50% { transform: translateY(76px) } }
              @keyframes fadein { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
            `}</style>
          </div>
        )}
      </div>

      <PrintSheet format={format} sheetUrl={step === 2 ? sheetUrl : null} />
    </>
  );
}
