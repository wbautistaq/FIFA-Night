"use client";

import Link from "next/link";
import clsx from "clsx";
import { Avatar } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { useT } from "@/components/TournamentShell";
import { stageLabel } from "@/lib/labels";
import type { Match } from "@/lib/types";

function Side({ participantId, score, pens, winner, nextOpp }: { participantId: string | null; score?: number; pens?: number | null; winner: boolean; nextOpp?: string }) {
  const { derived } = useT();
  const p = participantId ? derived.participants.get(participantId) : undefined;
  const team = derived.teamOf(participantId);
  return (
    <div className={clsx("flex items-center gap-2 px-2 py-1.5", winner && "bg-neon/15")} title={nextOpp}>
      {p ? (team ? <TeamCrest team={team} size={26} /> : <Avatar name={p.display_name} color={p.avatar_color} size={26} />) : <span className="inline-block h-[26px] w-[26px] rounded-lg bg-white/10" />}
      <div className="min-w-0 flex-1 leading-tight">
        <p className={clsx("truncate text-sm", winner ? "font-black" : "font-medium", !p && "text-white/40")}>{p ? p.nickname || p.display_name : "Por definir"}</p>
        {team ? <p className="truncate text-[10px] text-white/50">{team.name}</p> : null}
      </div>
      {score !== undefined ? <span className={clsx("w-5 text-right text-base tabular-nums", winner ? "font-black text-neon" : "text-white/80")}>{score}{pens != null ? <sup className="ml-0.5 text-[9px] text-white/60">({pens})</sup> : null}</span> : null}
    </div>
  );
}

export function BracketColumn({ title, matches, large }: { title: string; matches: Match[]; large?: boolean }) {
  const { derived, id, snapshot } = useT();
  return (
    <section aria-label={title} className="flex w-60 shrink-0 flex-col" style={large ? { width: 300 } : undefined}>
      <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-white/60">{title}</h3>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => {
          const r = derived.resultOf.get(m.id);
          const done = r?.status === "confirmed" ? r : undefined;
          const next = m.next_match_id ? snapshot.matches.find((x) => x.id === m.next_match_id) : undefined;
          const opponentOf = (pid: string | null) => {
            if (!next || !pid) return undefined;
            const other = next.home_id === pid ? next.away_id : next.home_id;
            const o = other ? derived.participants.get(other) : undefined;
            return o ? `Próximo rival: ${o.display_name}` : "Próximo rival por definir";
          };
          const hWin = m.winner_id !== null && m.winner_id === m.home_id;
          const aWin = m.winner_id !== null && m.winner_id === m.away_id;
          const card = (
            <div className={clsx("overflow-hidden rounded-xl border bg-pitch-800/80 transition", m.status === "live" ? "border-neon" : "border-white/10", m.is_bye && "opacity-50", m.winner_id && "animate-pop")}>
              <Side participantId={m.home_id} score={done?.home_score} pens={done?.home_pens} winner={hWin} nextOpp={opponentOf(m.home_id)} />
              <div className="h-px bg-white/10" />
              <Side participantId={m.away_id} score={done?.away_score} pens={done?.away_pens} winner={aWin} nextOpp={opponentOf(m.away_id)} />
              {m.is_bye ? <p className="bg-white/5 px-2 py-0.5 text-center text-[10px] text-white/50">Pase directo</p> : null}
            </div>
          );
          return m.home_id && m.away_id && !m.is_bye ? <Link key={m.id} href={`/t/${id}/partido/${m.id}`} aria-label="Abrir partido">{card}</Link> : <div key={m.id}>{card}</div>;
        })}
      </div>
    </section>
  );
}

export function BracketView({ large = false }: { large?: boolean }) {
  const { snapshot } = useT();
  const { matches, brackets } = snapshot;
  const sections: { title: string; stages: string[]; kind: string[] }[] = [
    { title: "Eliminatorias", stages: ["knockout"], kind: ["knockout", "playoffs"] },
    { title: "Llave de ganadores", stages: ["winners"], kind: ["winners"] },
    { title: "Llave de perdedores", stages: ["losers"], kind: ["losers"] },
  ];
  const blocks = sections.map((s) => {
    const list = matches.filter((m) => s.stages.includes(m.stage));
    const rounds = brackets.find((b) => s.kind.includes(b.kind))?.rounds ?? Math.max(0, ...list.map((m) => m.round));
    const cols = Array.from({ length: rounds }, (_, i) => i + 1).map((r) => ({ round: r, matches: list.filter((m) => m.round === r) })).filter((c) => c.matches.length);
    return { ...s, rounds, cols, extra: matches.filter((m) => (s.stages[0] === "knockout" ? m.stage === "third_place" : s.stages[0] === "winners" ? m.stage === "grand_final" : false)) };
  }).filter((b) => b.cols.length);

  return (
    <div className="space-y-8">
      {blocks.map((b) => (
        <section key={b.title} aria-label={b.title}>
          <h2 className="mb-3 text-lg font-bold">{b.title}</h2>
          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-max gap-6">
              {b.cols.map((c) => <BracketColumn key={c.round} large={large} title={stageLabel(b.stages[0] === "knockout" ? "knockout" : (b.stages[0] as "winners" | "losers"), c.round, b.stages[0] === "losers" || b.stages[0] === "winners" ? undefined : b.rounds)} matches={c.matches} />)}
              {b.extra.length ? <BracketColumn large={large} title={b.extra[0]?.stage === "grand_final" ? "Gran final" : "Tercer puesto"} matches={b.extra} /> : null}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
