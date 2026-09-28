import type { PhotoFormat } from "@/lib/formats";

/** Contenu imprimé : invisible à l'écran, seul élément visible lors de window.print(). */
export default function PrintSheet({ format, sheetUrl }: { format: PhotoFormat; sheetUrl: string | null }) {
  if (!sheetUrl) return null;
  const w = format.sheetMm.w / 10;
  const h = format.sheetMm.h / 10;
  return (
    <>
      <style>{`@media print { @page { size: ${w}cm ${h}cm; margin: 0; } }`}</style>
      <div className="print-area" style={{ width: `${w}cm`, height: `${h}cm` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sheetUrl} alt="" />
      </div>
    </>
  );
}
