"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle, Crown, Lock } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/primitives";
import { effectiveTheme, THEMES, type ThemeId } from "@/lib/themes";

interface Props {
  appearance: { premium: boolean; theme: ThemeId } | null;
  onChange: (input: { premium?: boolean; theme?: ThemeId }) => Promise<void>;
}

/** Plan premium y paleta de todo el sitio. Sin premium solo está disponible Pizarra táctica. */
export function AppearanceTab({ appearance, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!appearance) {
    return <EmptyState title="Falta un paso en la base de datos"><p className="text-sm text-white/70">Aplica la migración 21 (site_settings) en Supabase para poder cambiar la apariencia.</p></EmptyState>;
  }

  const shown = effectiveTheme(appearance.premium, appearance.theme);

  async function run(key: string, input: { premium?: boolean; theme?: ThemeId }) {
    setBusy(key);
    await onChange(input);
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Crown size={28} weight="duotone" className={appearance.premium ? "text-amber-300" : "text-white/40"} aria-hidden />
          <div>
            <h2 className="text-lg uppercase">Plan premium</h2>
            <p className="text-sm text-white/70">{appearance.premium ? "Activo: todas las paletas están disponibles." : "Inactivo: el sitio usa Pizarra táctica."}</p>
          </div>
        </div>
        <button className={appearance.premium ? "btn-secondary" : "btn-primary"} disabled={busy !== null} onClick={() => run("premium", { premium: !appearance.premium })}>
          {busy === "premium" ? "Guardando…" : appearance.premium ? "Desactivar premium" : "Activar premium"}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Paleta del sitio</h2>
        <p className="help !mt-0">El cambio se aplica a todas las personas, incluidos los invitados.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const locked = t.premium && !appearance.premium;
            const active = shown === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={locked || active || busy !== null}
                  onClick={() => run(t.id, { theme: t.id })}
                  className={clsx("card flex w-full items-center gap-3 text-left transition disabled:cursor-default", active ? "!border-neon" : !locked && "card-interactive", locked && "opacity-55")}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20" aria-hidden>
                    {t.swatch.map((c) => <span key={c} className="h-12 w-5" style={{ background: c }} />)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      {t.name}
                      {t.premium ? <span className="chip !px-2 !py-0 text-[10px]">Premium</span> : <span className="chip !px-2 !py-0 text-[10px]">Gratis</span>}
                    </span>
                    <span className="block text-sm text-white/65">{busy === t.id ? "Aplicando…" : t.description}</span>
                  </span>
                  {active ? <CheckCircle size={26} weight="fill" className="shrink-0 text-neon" aria-label="En uso" /> : locked ? <Lock size={22} className="shrink-0 text-white/50" aria-label="Requiere premium" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
