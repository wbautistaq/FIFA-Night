"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check } from "@phosphor-icons/react";
import { TeamCrest } from "@/components/TeamCrest";
import { Stars } from "@/components/ui/primitives";
import { teamStars } from "@/lib/teams";
import type { Team } from "@/lib/types";

export interface StarGroup {
  stars: number;
  /** Equipos que se muestran (los forzados siempre entran). */
  shown: Team[];
  total: number;
}

/**
 * Agrupa por estrellas (5★ primero) y recorta cada grupo a `limit`, incluyendo siempre los `force`.
 * Dentro del grupo se ordena por nombre para no delatar qué equipos están forzados.
 */
export function groupByStars(teams: readonly Team[], limit: number, force?: ReadonlySet<string>, expanded?: ReadonlySet<number>): StarGroup[] {
  const map = new Map<number, Team[]>();
  for (const t of teams) {
    const s = teamStars(t);
    map.set(s, [...(map.get(s) ?? []), t]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([stars, list]) => {
    const byName = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (expanded?.has(stars) || byName.length <= limit) return { stars, shown: byName, total: list.length };
    const forced = byName.filter((t) => force?.has(t.id));
    const rest = byName.filter((t) => !force?.has(t.id)).slice(0, Math.max(0, limit - forced.length));
    return { stars, shown: [...forced, ...rest].sort((a, b) => a.name.localeCompare(b.name)), total: list.length };
  });
}

/** Vista previa de los equipos que entran en el sorteo, por nivel de estrellas. */
export function TeamPoolPreview({ teams, limit = 8, compact = false, force, highlight, taken }: {
  teams: readonly Team[];
  limit?: number;
  /** Solo escudos (columna estrecha del sorteo) en lugar de escudo + nombre. */
  compact?: boolean;
  force?: ReadonlySet<string>;
  highlight?: string | null;
  taken?: ReadonlySet<string>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const groups = useMemo(() => groupByStars(teams, limit, force, expanded), [teams, limit, force, expanded]);

  if (teams.length === 0) return <p className="help text-center">Ningún equipo cumple estos filtros.</p>;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.stars}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><Stars value={g.stars} size={compact ? 10 : 12} /><span className="font-display text-xs text-white/80">{g.stars}</span></span>
            <span className="text-[11px] text-white/55">{g.total} {compact ? "" : g.total === 1 ? "equipo" : "equipos"}</span>
          </div>
          <ul className={clsx("grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6")}>
            {g.shown.map((t) => {
              const lit = highlight === t.id;
              const gone = taken?.has(t.id);
              return (
                <li key={t.id} title={t.name} className={clsx("relative flex flex-col items-center gap-1 rounded-xl p-1 transition duration-100", lit ? "scale-110 bg-neon/20 ring-2 ring-neon shadow-glow-neon" : "bg-white/[.03]", gone && !lit && "opacity-30")}>
                  <TeamCrest team={t} size={compact ? 28 : 36} stars={false} />
                  {!compact && <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-white/75">{t.name}</span>}
                  {gone && !lit ? <Check size={14} weight="bold" className="absolute right-0.5 top-0.5 text-neon" aria-label="Asignado" /> : null}
                </li>
              );
            })}
          </ul>
          {g.total > limit && (
            <button type="button" className="mt-1 min-h-8 text-xs font-semibold text-volt-light hover:text-white" onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(g.stars)) n.delete(g.stars); else n.add(g.stars); return n; })}>
              {expanded.has(g.stars) ? "Ver menos" : `Ver ${g.total - g.shown.length} más`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
