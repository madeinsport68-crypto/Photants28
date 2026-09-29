import type { PhotoFormat } from "@/lib/formats";

/** Contenu imprimé : invisible à l'écran, seul élément visible lors de window.print(). */
export default function PrintSheet({ format, sheetUrl }: { format: PhotoFormat; sheetUrl: string | null }) {
  if (!sheetUrl) return null;

  const w = format.sheetMm.w;
  const h = format.sheetMm.h;
  const orientation = format.orientation === "landscape" ? "landscape" : "portrait";

  return (
    <>
      <style>{`@media print { @page { size: ${w}mm ${h}mm ${orientation}; margin: 0; } }`}</style>
      <div className="print-area" style={{ width: `${w}mm`, height: `${h}mm` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sheetUrl} alt="" />
      </div>
    </>
  );
}
