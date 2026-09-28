"use client";

import { useEffect, useState } from "react";
import { Moon, RotateCcw, Sun } from "lucide-react";

interface Props {
  onHome: () => void;
  showReset: boolean;
}

export default function Header({ onHome, showReset }: Props) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("photants-theme", next ? "dark" : "light");
    } catch {
      /* stockage indisponible */
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <button onClick={onHome} className="flex items-center gap-3" aria-label="Accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="PhotANTS" className="h-11 w-11 rounded-lg object-cover shadow-sm" />
          <div className="text-left leading-tight">
            <div className="text-xl font-black tracking-tight">
              <span className="text-brand-blue">PHOT</span>
              <span className="text-brand-red">ANTS</span>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Photos d&apos;identité · Point de vente
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {showReset && (
            <button
              onClick={onHome}
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau client</span>
            </button>
          )}
          <button
            onClick={toggle}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label={dark ? "Mode clair" : "Mode sombre"}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
