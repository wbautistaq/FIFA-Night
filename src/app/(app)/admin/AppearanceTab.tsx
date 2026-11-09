"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/primitives";
import { THEMES, type ThemeId } from "@/lib/themes";

interface Props {
  appearance: { theme: ThemeId } | null;
  onChange: (theme: ThemeId) => Promise<void>;
}

/** Paleta de todo el sitio. */
export function AppearanceTab({ appearance, onChange }: Props) {
  const [busy, setBusy] = useState<ThemeId | null>(null);

  if (!appearance) {
    return <EmptyState title="Falta un paso en la base de datos"><p className="text-sm text-white/70">Aplica la migración 21 (site_settings) en Supabase para poder cambiar la apariencia.</p></EmptyState>;
  }

  async function pick(theme: ThemeId) {
    setBusy(theme);
    await onChange(theme);
    setBusy(null);
  }

  return (
    <section className="space-y-2">
      <h2 className="section-title">Paleta del sitio</h2>
      <p className="help !mt-0">El cambio se aplica a todas las personas, incluidos los invitados.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const active = appearance.theme === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={active}
                disabled={active || busy !== null}
                onClick={() => pick(t.id)}
                className={clsx("card flex w-full items-center gap-3 text-left transition disabled:cursor-default", active ? "!border-neon" : "card-interactive")}
              >
                <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20" aria-hidden>
                  {t.swatch.map((c) => <span key={c} className="h-12 w-5" style={{ background: c }} />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}{t.id === "pizarra" ? <span className="chip ml-2 !px-2 !py-0 text-[10px]">Predeterminada</span> : null}</span>
                  <span className="block text-sm text-white/65">{busy === t.id ? "Aplicando…" : t.description}</span>
                </span>
                {active ? <CheckCircle size={26} weight="fill" className="shrink-0 text-neon" aria-label="En uso" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
