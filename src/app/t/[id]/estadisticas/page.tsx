"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/components/TournamentShell";
import { PlayerChip } from "@/components/MatchRow";
import { AchievementIcon, EmptyState } from "@/components/ui/primitives";
import { ACHIEVEMENTS } from "@/lib/labels";
import { ChartBar, Medal, Sparkle } from "@phosphor-icons/react";

type Tab = "jugadores" | "goleadores" | "logros" | "predictores";

export default function Stats() {
  const { snapshot, id } = useT();
  const { stats, achievements, predictions, tournament: t, participants } = snapshot;
  const [tab, setTab] = useState<Tab>("jugadores");
  const rows = useMemo(() => [...stats].sort((a, b) => b.fifa_points - a.fifa_points || b.won - a.won || b.goals_for - a.goals_for), [stats]);
  const scorers = useMemo(() => [...stats].filter((s) => s.goals_for > 0).sort((a, b) => b.goals_for - a.goals_for), [stats]);
  const predictors = useMemo(() => {
    const m = new Map<string, { pts: number; hits: number; n: number }>();
    for (const p of predictions.filter((x) => x.settled)) {
      const cur = m.get(p.participant_id) ?? { pts: 0, hits: 0, n: 0 };
      m.set(p.participant_id, { pts: cur.pts + p.points, hits: cur.hits + (p.points > 0 ? 1 : 0), n: cur.n + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].pts - a[1].pts);
  }, [predictions]);

  const tabs: [Tab, string, boolean][] = [["jugadores", "Jugadores", true], ["goleadores", "Goleadores", true], ["logros", "Logros", t.settings.fifa_points], ["predictores", "Predictores", t.settings.predictions]];
  const played = stats.some((s) => s.played > 0);

  return (
    <div className="space-y-5">
      <h2 className="section-title">Estadísticas</h2>
      <div role="tablist" aria-label="Estadísticas" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.filter((x) => x[2]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "btn bg-neon !min-h-10 text-pitch-950" : "btn-secondary !min-h-10"} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {!played && tab !== "predictores" ? <EmptyState icon={ChartBar} title="Aún no hay partidos confirmados">Las estadísticas se llenan con cada resultado confirmado.</EmptyState> : null}

      {played && tab === "jugadores" && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Estadísticas por jugador</caption>
            <thead className="text-xs uppercase text-white/60"><tr><th className="p-2 text-left">Jugador</th>{["PJ", "G", "E", "P", "GF", "GC", "% V", "Racha", "MVP", t.settings.fifa_points ? "FP" : ""].filter(Boolean).map((h) => <th key={h} scope="col" className={h === "FP" ? "sticky right-0 bg-pitch-950/95 p-2 text-center" : "p-2 text-center"}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.participant_id} className="border-t border-white/5">
                  <td className="p-2"><Link href={`/t/${id}/jugador/${s.participant_id}`}><PlayerChip participantId={s.participant_id} /></Link></td>
                  {[s.played, s.won, s.drawn, s.lost, s.goals_for, s.goals_against, s.played ? `${Math.round((s.won / s.played) * 100)}%` : "–", s.current_streak > 0 ? `🔥${s.current_streak}` : s.current_streak < 0 ? `❄️${-s.current_streak}` : "–", s.mvp_count].map((v, i) => <td key={i} className="p-2 text-center tabular-nums">{v}</td>)}
                  {t.settings.fifa_points && <td className="sticky right-0 bg-pitch-950/95 p-2 text-center font-bold tabular-nums text-neon">{s.fifa_points}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {played && tab === "goleadores" && (
        <ol className="space-y-2">{scorers.map((s, i) => <li key={s.participant_id} className="card flex items-center gap-3 !p-3"><span className="w-6 text-center font-black text-neon">{i + 1}</span><div className="min-w-0 flex-1"><PlayerChip participantId={s.participant_id} /></div><span className="text-2xl font-black tabular-nums">{s.goals_for}</span><span className="text-xs text-white/60">{s.goals_for === 1 ? "gol" : "goles"}</span></li>)}</ol>
      )}
      {tab === "logros" && (achievements.length === 0 ? <EmptyState icon={Medal} title="Los logros se reparten al terminar el torneo" /> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {achievements.map((a) => { const meta = ACHIEVEMENTS[a.code]; return meta ? <li key={a.id} className="card flex items-center gap-3 !p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-300/10 ring-1 ring-amber-300/30"><AchievementIcon code={a.code} size={26} /></span><div><p className="font-bold">{meta.title}</p><p className="text-xs text-white/60">{meta.description}</p><p className="text-sm">{participants.find((p) => p.id === a.participant_id)?.display_name}</p></div></li> : null; })}
        </ul>
      ))}
      {tab === "predictores" && (predictors.length === 0 ? <EmptyState icon={Sparkle} title="Aún no hay predicciones resueltas"><Link className="underline" href={`/t/${id}/predicciones`}>Haz tus predicciones</Link></EmptyState> : (
        <ol className="space-y-2">{predictors.map(([pid, v], i) => <li key={pid} className="card flex items-center gap-3 !p-3"><span className="w-6 text-center font-black text-neon">{i + 1}</span><div className="min-w-0 flex-1"><PlayerChip participantId={pid} /></div><div className="text-right"><p className="text-xl font-black tabular-nums">{v.pts}</p><p className="text-xs text-white/60">{v.hits}/{v.n} aciertos</p></div></li>)}</ol>
      ))}
    </div>
  );
}
