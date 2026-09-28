"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Crop,
  Eye,
  Glasses,
  Ruler,
  Sparkles,
  SunMedium,
  XCircle,
  CircleDashed,
} from "lucide-react";
import {
  EXPRESSION_ITEMS,
  GEOMETRY_ITEMS,
  OBSTACLE_ITEMS,
  complianceScore,
  type Check,
  type ComplianceReport,
  type PillarId,
  type Status,
} from "@/lib/compliance";
import type { PhotoFormat } from "@/lib/formats";

const ICONS: Record<PillarId, typeof Ruler> = {
  geometry: Ruler,
  expression: Eye,
  lighting: SunMedium,
  obstacles: Glasses,
  quality: Sparkles,
};

export interface ManualState {
  obstacles: boolean[];
  expression: boolean[];
  geometry: boolean[];
}

/** Statuts finaux après prise en compte des validations visuelles du commerçant. */
export function resolveChecks(report: ComplianceReport, manual: ManualState): Check[] {
  return report.checks.map((c) => {
    if (c.id === "obstacles") {
      const ok = manual.obstacles.every(Boolean);
      return { ...c, status: ok ? "ok" : "manual", messages: [ok ? "Validé visuellement" : "Contrôle visuel requis"] };
    }
    if (c.id === "expression" && !c.auto) {
      const ok = manual.expression.every(Boolean);
      return { ...c, status: ok ? "ok" : "manual", messages: [ok ? "Validé visuellement" : "À vérifier visuellement"] };
    }
    if (c.id === "geometry" && !c.auto) {
      const ok = manual.geometry.every(Boolean);
      return { ...c, status: ok ? "ok" : "manual", messages: ok ? ["Validé visuellement"] : c.messages };
    }
    return c;
  });
}

function StatusIcon({ s }: { s: Status }) {
  if (s === "ok") return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
  if (s === "warn") return <AlertTriangle className="h-6 w-6 text-amber-500" />;
  if (s === "fail") return <XCircle className="h-6 w-6 text-red-500" />;
  return <CircleDashed className="h-6 w-6 text-slate-400" />;
}

const tone: Record<Status, string> = {
  ok: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  warn: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  fail: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
  manual: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
};

interface Props {
  report: ComplianceReport;
  manual: ManualState;
  onManual: (m: ManualState) => void;
  onRecrop: () => void;
  format: PhotoFormat;
  photoUrl: string;
}

export default function CompliancePanel({ report, manual, onManual, onRecrop, format, photoUrl }: Props) {
  const checks = resolveChecks(report, manual);
  const statuses = checks.map((c) => c.status);
  const score = complianceScore(statuses);
  const allOk = statuses.every((s) => s === "ok");
  const hasFail = statuses.includes("fail");
  const m = report.markers;

  const toggle = (key: keyof ManualState, i: number) => {
    const arr = [...manual[key]];
    arr[i] = !arr[i];
    onManual({ ...manual, [key]: arr });
  };

  const bandTop = 0.04,
    bandChinA = 0.08 + format.headRatio.min,
    bandChinB = 0.08 + format.headRatio.max;

  return (
    <aside className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Conformité OACI / ANTS</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {report.engine === "ia" ? "Détection IA" : "Mode heuristique"}
        </span>
      </div>

      {/* Badge global */}
      {allOk ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/25">
          <BadgeCheck className="h-10 w-10 shrink-0" />
          <div>
            <div className="text-xl font-black leading-tight">Conforme ANTS à 95%+</div>
            <div className="text-xs opacity-90">Tous les critères sont validés</div>
          </div>
        </div>
      ) : (
        <div
          className={`flex items-center gap-3 rounded-2xl p-4 ${
            hasFail ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
          }`}
        >
          <AlertTriangle className="h-9 w-9 shrink-0" />
          <div>
            <div className="text-lg font-black leading-tight">
              {hasFail ? "Non conforme" : "À vérifier"} · indice {score} %
            </div>
            <div className="text-xs opacity-90">
              {hasFail ? "Corrigez le point en rouge (recadrage ou nouvelle photo)" : "Complétez les contrôles visuels ci-dessous"}
            </div>
          </div>
        </div>
      )}

      {/* Photo inspectée avec repères */}
      <div className="flex gap-4">
        <div className="relative w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-300 dark:ring-slate-700" style={{ aspectRatio: `${format.photoMm.w} / ${format.photoMm.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Photo recadrée" className="h-full w-full object-cover" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="0" y={bandTop * 100} width="100" height={8} fill="rgb(16 185 129 / 0.25)" />
            <rect x="0" y={bandChinA * 100} width="100" height={(bandChinB - bandChinA) * 100} fill="rgb(16 185 129 / 0.25)" />
            {m.crown !== undefined && <line x1="0" x2="100" y1={m.crown * 100} y2={m.crown * 100} stroke="#e3131b" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
            {m.chin !== undefined && <line x1="0" x2="100" y1={m.chin * 100} y2={m.chin * 100} stroke="#e3131b" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
            {m.eyeL && m.eyeR && (
              <line
                x1={m.eyeR.x * 100}
                y1={m.eyeR.y * 100}
                x2={m.eyeL.x * 100}
                y2={m.eyeL.y * 100}
                stroke="#1766e8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
        <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <p>
            <span className="font-bold text-emerald-600">Vert</span> : zones attendues du sommet du crâne et du menton.
          </p>
          <p>
            <span className="font-bold text-brand-red">Rouge</span> : position détectée.
          </p>
          {m.eyeL && (
            <p>
              <span className="font-bold text-brand-blue">Bleu</span> : ligne des yeux.
            </p>
          )}
        </div>
      </div>

      {/* Checklist des 5 piliers */}
      <ul className="flex flex-col gap-2.5">
        {checks.map((c) => {
          const Icon = ICONS[c.id];
          const manualKey: keyof ManualState | null =
            c.id === "obstacles"
              ? "obstacles"
              : c.id === "expression" && !c.auto
              ? "expression"
              : c.id === "geometry" && !c.auto
              ? "geometry"
              : null;
          const items =
            manualKey === "obstacles"
              ? OBSTACLE_ITEMS
              : manualKey === "expression"
              ? EXPRESSION_ITEMS
              : manualKey === "geometry"
              ? GEOMETRY_ITEMS
              : null;
          return (
            <li key={c.id} className={`rounded-2xl border p-3 ${tone[c.status]}`}>
              <div className="flex items-start gap-3">
                <StatusIcon s={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Icon className="h-4 w-4 text-slate-500" /> {c.title}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {c.messages.map((msg) => (
                      <li
                        key={msg}
                        className={
                          c.status === "fail"
                            ? "font-semibold text-red-700 dark:text-red-300"
                            : c.status === "warn"
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-slate-600 dark:text-slate-300"
                        }
                      >
                        {msg}
                      </li>
                    ))}
                  </ul>
                  {manualKey && items && (
                    <div className="mt-2 space-y-1.5">
                      {items.map((label, i) => (
                        <label key={label} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
                            checked={manual[manualKey][i] ?? false}
                            onChange={() => toggle(manualKey, i)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onRecrop}
        className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-black transition active:scale-[0.99] ${
          hasFail
            ? "bg-brand-blue text-white hover:bg-brand-blueDark"
            : "border-2 border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        }`}
      >
        <Crop className="h-5 w-5" /> Recadrer / reprendre la photo
      </button>

      <p className="text-[11px] leading-snug text-slate-400">
        Contrôle automatique indicatif : il aide à repérer les défauts courants mais ne remplace pas la vérification
        visuelle du commerçant.
      </p>
    </aside>
  );
}
