"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CheckCircle, Clock, Lightbulb, Sparkle, SoccerBall } from "@phosphor-icons/react";
import { formatAdvice, type FormatOption } from "@/lib/engine/advice";
import type { TournamentFormat } from "@/lib/engine/types";

const duration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/**
 * Opciones para armar los cruces según cuántos juegan: qué implica cada formato con ese número
 * (descansos, pases libres, partidos por persona, duración) y cuál conviene.
 */
export function FormatAdvicePanel({ players, selected, stations = 1, formats, onPick, busy = false }: {
  players: number;
  /** Id de la opción elegida (league, groups, cup…). */
  selected: string | null;
  stations?: number;
  formats?: readonly TournamentFormat[];
  onPick: (option: FormatOption) => void;
  busy?: boolean;
}) {
  const advice = useMemo(() => formatAdvice(players, { stations, formats }), [players, stations, formats]);
  const [all, setAll] = useState(false);

  if (advice.options.length === 0) {
    return <p className="help">Con al menos 4 jugadores te mostramos las formas de armar los cruces.</p>;
  }
  const featured = advice.options.filter((o) => o.recommended || o.id === selected);
  const shown = all ? advice.options : featured;
  const hidden = advice.options.length - featured.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{players} jugadores</span>
        {advice.odd ? <span className="chip border-amber-300/50 bg-amber-300/10 text-amber-200">Número impar</span> : null}
        <span className="chip">{stations === 1 ? "1 consola" : `${stations} consolas`}</span>
      </div>
      {advice.tip ? <p className="flex gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75"><Lightbulb size={18} weight="duotone" className="mt-0.5 shrink-0 text-amber-300" aria-hidden />{advice.tip}</p> : null}

      <ul className="space-y-2" role="radiogroup" aria-label="Formato del torneo">
        {shown.map((o) => {
          const on = o.id === selected;
          return (
            <li key={o.id}>
              <button type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => onPick(o)}
                className={clsx("w-full rounded-2xl border p-3 text-left transition active:scale-[.99] disabled:opacity-60", on ? "border-neon bg-neon/10 shadow-glow-neon" : "border-white/15 bg-white/[.04] hover:border-white/30")}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-base uppercase leading-tight">{o.title}</span>
                  {on ? <CheckCircle size={22} weight="fill" className="shrink-0 text-neon" aria-hidden />
                    : o.recommended ? <span className="chip shrink-0 border-neon/50 text-neon"><Sparkle size={12} weight="fill" aria-hidden />Recomendado</span> : null}
                </span>
                <span className="mt-1 block text-sm text-white/85">{o.summary}</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                  <span className="inline-flex items-center gap-1"><SoccerBall size={14} aria-hidden />{o.matches} partidos</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden />~{duration(o.minutes)}</span>
                </span>
                <ul className="mt-2 space-y-0.5 text-xs text-white/70">
                  {o.points.map((p) => <li key={p}>· {p}</li>)}
                </ul>
                {on && o.recommended ? <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-neon"><Sparkle size={12} weight="fill" aria-hidden />Recomendado para esta noche</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" className="btn-ghost w-full !min-h-10 text-sm" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Ver menos opciones" : `Ver ${hidden} ${hidden === 1 ? "opción más" : "opciones más"}`}
        </button>
      )}
    </div>
  );
}
