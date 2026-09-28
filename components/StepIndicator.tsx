import { Check } from "lucide-react";

const STEPS = ["Format", "Prise de vue & recadrage", "Contrôle & impression"];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-4 sm:gap-4">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-brand-blue text-white"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`hidden text-sm font-semibold md:inline ${
                  active ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-slate-300 dark:bg-slate-700 sm:w-12" />}
          </li>
        );
      })}
    </ol>
  );
}
