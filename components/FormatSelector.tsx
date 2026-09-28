"use client";

import { BadgeCheck, ChevronRight, LayoutGrid } from "lucide-react";
import { FORMATS, type FormatId, type PhotoFormat } from "@/lib/formats";
import { computeSlots } from "@/lib/sheet";

function MiniSheet({ f, accent }: { f: PhotoFormat; accent: string }) {
  const slots = computeSlots(f);
  const scale = 150 / Math.max(f.sheetPx.w, f.sheetPx.h);
  const W = f.sheetPx.w * scale;
  const H = f.sheetPx.h * scale;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="drop-shadow-md" aria-hidden>
      <rect width={W} height={H} rx={4} fill="#fff" stroke="#cbd5e1" />
      {slots.map((s, i) => (
        <g key={i}>
          <rect x={s.x * scale} y={s.y * scale} width={s.w * scale} height={s.h * scale} rx={1.5} fill={accent} opacity={0.18} />
          <ellipse
            cx={(s.x + s.w / 2) * scale}
            cy={(s.y + s.h * 0.42) * scale}
            rx={s.w * scale * 0.26}
            ry={s.h * scale * 0.24}
            fill={accent}
            opacity={0.55}
          />
          <path
            d={`M ${(s.x + s.w * 0.12) * scale} ${(s.y + s.h) * scale} Q ${(s.x + s.w / 2) * scale} ${(s.y + s.h * 0.6) * scale} ${
              (s.x + s.w * 0.88) * scale
            } ${(s.y + s.h) * scale} Z`}
            fill={accent}
            opacity={0.55}
          />
        </g>
      ))}
    </svg>
  );
}

export default function FormatSelector({ onSelect }: { onSelect: (id: FormatId) => void }) {
  const cards: { f: PhotoFormat; accent: string; ring: string; badge: string }[] = [
    { f: FORMATS.ants8, accent: "#1766e8", ring: "hover:ring-brand-blue focus-visible:ring-brand-blue", badge: "bg-brand-blue" },
    { f: FORMATS.custom4, accent: "#e3131b", ring: "hover:ring-brand-red focus-visible:ring-brand-red", badge: "bg-brand-red" },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Choisissez le format de la planche</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Impression sur papier photo standard 10 × 15 cm</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map(({ f, accent, ring, badge }, idx) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`group relative flex flex-col items-center overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-8 text-left shadow-sm outline-none ring-4 ring-transparent transition active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 ${ring}`}
          >
            <span className={`absolute left-6 top-6 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ${badge}`}>
              Option {idx + 1}
            </span>
            {f.official && (
              <span className="absolute right-6 top-6 flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" /> Normes ANTS / OACI
              </span>
            )}

            <div className="mb-6 mt-10 flex h-40 items-center justify-center">
              <MiniSheet f={f} accent={accent} />
            </div>

            <h2 className="text-2xl font-black">{f.label}</h2>
            <p className="mt-1 text-lg font-semibold" style={{ color: accent }}>
              Planche de {f.cols * f.rows} photos
            </p>
            <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <div className="font-bold">
                  {f.photoMm.w / 10} × {f.photoMm.h / 10}
                </div>
                <div className="text-xs text-slate-500">cm / photo</div>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <div className="font-bold">{f.cols * f.rows}</div>
                <div className="text-xs text-slate-500">photos</div>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <div className="font-bold">600 DPI</div>
                <div className="text-xs text-slate-500">{f.orientation === "landscape" ? "15 × 10 cm" : "10 × 15 cm"}</div>
              </div>
            </div>

            <span
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-white transition group-hover:brightness-110"
              style={{ background: accent }}
            >
              <LayoutGrid className="h-5 w-5" /> Sélectionner
              <ChevronRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
