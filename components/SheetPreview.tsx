"use client";

import { Download, Printer, Info } from "lucide-react";
import type { PhotoFormat } from "@/lib/formats";

interface Props {
  format: PhotoFormat;
  sheetUrl: string;
  onDownload: () => void;
  onPrint: () => void;
  warn: boolean;
}

export default function SheetPreview({ format, sheetUrl, onDownload, onPrint, warn }: Props) {
  const landscape = format.orientation === "landscape";
  const cmW = format.sheetMm.w / 10;
  const cmH = format.sheetMm.h / 10;

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-black">Aperçu de la planche</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {cmW} × {cmH} cm · {format.sheetPx.w} × {format.sheetPx.h} px · 600 DPI
        </span>
      </div>

      {/* Feuille avec règles */}
      <div className="flex justify-center rounded-2xl bg-[repeating-linear-gradient(45deg,theme(colors.slate.200),theme(colors.slate.200)_10px,theme(colors.slate.100)_10px,theme(colors.slate.100)_20px)] p-6 dark:bg-[repeating-linear-gradient(45deg,theme(colors.slate.800),theme(colors.slate.800)_10px,theme(colors.slate.900)_10px,theme(colors.slate.900)_20px)] sm:p-10">
        <div className={`relative w-full ${landscape ? "max-w-[640px]" : "max-w-[380px]"}`}>
          <div className="absolute -top-5 left-0 right-0 flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <span className="h-px flex-1 bg-slate-400" />
            {cmW} cm
            <span className="h-px flex-1 bg-slate-400" />
          </div>
          <div className="absolute -left-5 bottom-0 top-0 flex flex-col items-center gap-1 text-[11px] font-bold text-slate-500">
            <span className="w-px flex-1 bg-slate-400" />
            <span className="-rotate-90 whitespace-nowrap">{cmH} cm</span>
            <span className="w-px flex-1 bg-slate-400" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sheetUrl}
            alt={`Planche ${format.cols * format.rows} photos`}
            className="w-full rounded-sm bg-white shadow-2xl ring-1 ring-black/10"
            style={{ aspectRatio: `${format.sheetPx.w} / ${format.sheetPx.h}` }}
          />
        </div>
      </div>

      {warn && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-100 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          La photo présente des points non conformes. Vous pouvez imprimer, mais elle risque d&apos;être refusée.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={onDownload}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue text-base font-black text-brand-blue transition hover:bg-brand-blue hover:text-white active:scale-[0.99]"
        >
          <Download className="h-6 w-6" /> TÉLÉCHARGER PNG (600 DPI)
        </button>
        <button
          onClick={onPrint}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-brand-red text-base font-black text-white shadow-lg shadow-brand-red/25 transition hover:bg-brand-redDark active:scale-[0.99]"
        >
          <Printer className="h-6 w-6" /> IMPRIMER LA PLANCHE
        </button>
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        À l&apos;impression : papier {cmW} × {cmH} cm{landscape ? " (paysage)" : ""}, échelle 100 % / « Taille réelle », sans marges.
      </p>
    </div>
  );
}
