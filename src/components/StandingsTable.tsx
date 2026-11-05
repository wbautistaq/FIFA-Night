"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Avatar } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { useT } from "@/components/TournamentShell";
import type { StandingRow } from "@/lib/types";

const COLS = ["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"];
// E, P, GF y GC se ocultan en móvil para que los puntos se vean sin desplazar la tabla (G y DG ya resumen lo esencial)
const OPTIONAL = new Set([2, 3, 4, 5]);
// Si aun así no cabe (pantallas muy angostas), la columna de puntos queda fija a la derecha
const PTS_STICKY = "sticky right-0 bg-pitch-950/95";

export function StandingsTable({ rows, qualifiers = 0, large = false }: { rows: StandingRow[]; qualifiers?: number; large?: boolean }) {
  const { derived } = useT();
  const prev = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Set<string>>(new Set());

  useEffect(() => {
    const changed = new Set<string>();
    for (const r of rows) {
      const before = prev.current.get(r.participant_id);
      if (before !== undefined && before !== r.points + r.position * 1000) changed.add(r.participant_id);
    }
    prev.current = new Map(rows.map((r) => [r.participant_id, r.points + r.position * 1000]));
    if (changed.size) {
      setFlash(changed);
      const t = setTimeout(() => setFlash(new Set()), 1300);
      return () => clearTimeout(t);
    }
  }, [rows]);

  const cell = large ? "px-3 py-3 text-xl" : "px-2 py-2.5 text-sm";
  // Podio: oro, plata y bronce marcados con color y número (no solo color)
  const medal = (pos: number) => (pos === 1 ? "bg-amber-300 text-pitch-950 shadow-[0_0_12px_rgba(251,191,36,.6)]" : pos === 2 ? "bg-slate-300 text-pitch-950" : pos === 3 ? "bg-orange-400 text-pitch-950" : "bg-white/10 text-white/80");
  return (
    <div className="card overflow-x-auto !p-0">
      <table className={clsx("w-full border-collapse", large && "min-w-[460px]")}>
        <caption className="sr-only">Tabla de posiciones</caption>
        <thead className="bg-black/30 font-display text-[11px] uppercase tracking-wider text-white/60">
          <tr><th scope="col" className={clsx(cell, "text-left")}>#</th><th scope="col" className={clsx(cell, "text-left")}>Jugador</th>
            {COLS.map((h, i) => <th key={h} scope="col" className={clsx(cell, "text-center", h === "Pts" && `text-neon ${PTS_STICKY}`, !large && OPTIONAL.has(i) && "hidden sm:table-cell")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = derived.participants.get(r.participant_id);
            const team = derived.teamOf(r.participant_id);
            const qualified = r.position <= qualifiers;
            return (
              <tr key={r.participant_id} className={clsx("border-t border-white/5 transition", flash.has(r.participant_id) && "animate-flash", qualified && "bg-neon/[.06] shadow-[inset_3px_0_0_#2ee6ff]")}>
                <td className={cell}><span className={clsx("grid h-7 w-7 place-items-center rounded-lg font-display text-sm tabular-nums", medal(r.position))}>{r.position}</span></td>
                <td className={cell}>
                  <div className="flex items-center gap-2">
                    {team ? <TeamCrest team={team} size={large ? 40 : 28} /> : <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color} size={large ? 40 : 28} />}
                    <span className="max-w-[6.5rem] truncate font-bold sm:max-w-[9rem]">{p?.nickname || p?.display_name}</span>
                  </div>
                </td>
                {[r.played, r.won, r.drawn, r.lost, r.goals_for, r.goals_against, r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference].map((v, i) => <td key={i} className={clsx(cell, "text-center tabular-nums text-white/80", !large && OPTIONAL.has(i) && "hidden sm:table-cell")}>{v}</td>)}
                <td className={clsx(cell, PTS_STICKY, "text-center font-display tabular-nums text-neon")}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
