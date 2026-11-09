"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useT } from "@/components/TournamentShell";
import { BracketView } from "@/components/BracketView";
import { StandingsTable } from "@/components/StandingsTable";
import { PlayerChip } from "@/components/MatchRow";
import { stageLabel } from "@/lib/labels";
import { ArrowsOut, SignOut, Trophy } from "@phosphor-icons/react";
import { formatTime } from "@/lib/datetime";

const ORDER = ["next", "standings", "bracket", "scorers", "results"] as const;
type View = (typeof ORDER)[number];
const TITLE: Record<View, string> = { next: "Próximo partido", standings: "Tabla de posiciones", bracket: "Bracket", scorers: "Goleadores", results: "Últimos resultados" };

export default function TvMode() {
  const { snapshot, id, derived } = useT();
  const { tournament: t, matches, standings, stats } = snapshot;
  const remote = t.tv_state?.view ?? "auto";
  const hasBracket = matches.some((m) => ["knockout", "winners", "losers"].includes(m.stage));
  const hasTable = standings.length > 0 && !["cup", "double_elimination"].includes(t.format);
  const available = useMemo(() => ORDER.filter((v) => (v === "bracket" ? hasBracket : v === "standings" ? hasTable : true)), [hasBracket, hasTable]);
  const [idx, setIdx] = useState(0);
  const [clock, setClock] = useState("");

  useEffect(() => {
    if (remote !== "auto") return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % available.length), 12000);
    return () => clearInterval(timer);
  }, [remote, available.length]);
  useEffect(() => {
    const tick = () => setClock(formatTime(new Date()));
    tick();
    const timer = setInterval(tick, 20000);
    return () => clearInterval(timer);
  }, []);

  const view: View = remote !== "auto" && (available as readonly string[]).includes(remote) ? (remote as View) : (available[idx % available.length] ?? "next");
  const nextMatches = matches.filter((m) => ["pending", "live"].includes(m.status) && m.home_id && m.away_id);
  const finished = matches.filter((m) => m.status === "finished" && !m.is_bye).sort((a, b) => (derived.resultOf.get(b.id)?.played_at ?? "").localeCompare(derived.resultOf.get(a.id)?.played_at ?? "")).slice(0, 6);
  const scorers = [...stats].filter((s) => s.goals_for > 0).sort((a, b) => b.goals_for - a.goals_for).slice(0, 8);
  const champion = t.champion_participant_id;
  const qualifiers = t.format === "groups_playoffs" ? t.settings.qualifiers_per_group : 0;
  const total = snapshot.brackets.find((b) => ["knockout", "playoffs"].includes(b.kind))?.rounds;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-pitch-950 bg-[radial-gradient(1200px_600px_at_15%_-10%,rgb(var(--accent2)/.35),transparent_60%),radial-gradient(900px_500px_at_100%_110%,rgb(var(--live)/.22),transparent_60%)] p-4 text-white sm:p-6 lg:p-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="eyebrow !text-sm">Copa Parche</p><h1 className="truncate text-2xl uppercase sm:text-3xl lg:text-5xl">{t.name}</h1></div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="rounded-xl border border-white/10 bg-black/40 px-3 py-1 font-display text-2xl tabular-nums sm:px-4 sm:text-3xl lg:text-5xl">{clock}</span>
          <Link href={`/t/${id}`} className="btn-secondary !min-h-11 !px-3 text-sm sm:!px-5" aria-label="Salir del modo TV"><SignOut size={18} aria-hidden /><span className="hidden sm:inline">Salir</span></Link>
          <button className="btn-secondary !min-h-11 !px-3 text-sm sm:!px-5" aria-label="Pantalla completa" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}><ArrowsOut size={18} aria-hidden /><span className="hidden sm:inline">Pantalla completa</span></button>
        </div>
      </header>
      <div className="mb-4 flex gap-2" aria-hidden>{available.map((v) => <span key={v} className={clsx("h-1.5 flex-1 rounded-full transition-colors", v === view ? "bg-neon shadow-[0_0_12px_rgb(var(--accent))]" : "bg-white/15")} />)}</div>
      <h2 className="mb-4 flex items-center gap-3 text-2xl uppercase text-white/85 lg:text-4xl" aria-live="polite">{champion ? <><Trophy size={40} weight="fill" className="text-amber-300" aria-hidden />Campeón</> : TITLE[view]}</h2>

      <main className="min-h-0 flex-1 overflow-auto" key={view}>
        <div className="animate-slideUp">
          {champion ? (
            <div className="flex h-full flex-col items-center justify-center gap-8 pt-6 text-center">
              <Trophy size={180} weight="duotone" className="text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,.6)]" aria-hidden />
              <div className="scale-[2]"><PlayerChip participantId={champion} /></div>
            </div>
          ) : view === "next" ? (
            nextMatches.length === 0 ? <p className="text-3xl text-white/60">No hay partidos pendientes</p> : (
              <div className="space-y-6">
                {nextMatches.slice(0, 1).map((m) => (
                  <div key={m.id} className="relative overflow-hidden rounded-3xl border border-volt/50 bg-gradient-to-br from-pitch-700/90 to-pitch-900/90 p-8 shadow-glow">
                    <p className="mb-6 text-center font-display text-xl uppercase tracking-widest text-neon">{m.status === "live" ? <span className="inline-flex items-center gap-2 text-blaze-light"><span className="h-3 w-3 animate-pulseGlow rounded-full bg-blaze" />En juego</span> : stageLabel(m.stage, m.round, total, m.group_name)}</p>
                    <div className="flex items-center justify-around gap-6 text-3xl lg:text-5xl"><div className="origin-left scale-150 lg:scale-[1.8]"><PlayerChip participantId={m.home_id} /></div><span className="bg-gradient-to-b from-white to-white/30 bg-clip-text font-display text-6xl text-transparent">VS</span><div className="origin-right scale-150 lg:scale-[1.8]"><PlayerChip participantId={m.away_id} align="right" /></div></div>
                  </div>
                ))}
                <div className="grid gap-3 lg:grid-cols-2">{nextMatches.slice(1, 5).map((m) => <div key={m.id} className="card flex items-center gap-3 text-lg"><PlayerChip participantId={m.home_id} /><span className="text-white/40">vs</span><PlayerChip participantId={m.away_id} align="right" /></div>)}</div>
              </div>
            )
          ) : view === "standings" ? (
            <div className="grid gap-6 lg:grid-cols-2">{[...new Set(standings.map((s) => s.group_name))].sort().map((g) => <div key={g || "all"}>{g ? <h3 className="mb-2 text-2xl font-bold">Grupo {g}</h3> : null}<StandingsTable large rows={standings.filter((s) => s.group_name === g)} qualifiers={qualifiers} /></div>)}</div>
          ) : view === "bracket" ? (
            <BracketView large />
          ) : view === "scorers" ? (
            scorers.length === 0 ? <p className="text-3xl text-white/60">Aún no hay goles registrados</p> : <ol className="grid gap-3 lg:grid-cols-2">{scorers.map((s, i) => <li key={s.participant_id} className="card flex items-center gap-4 text-2xl"><span className="w-10 text-center font-display text-neon">{i + 1}</span><div className="flex-1"><PlayerChip participantId={s.participant_id} /></div><span className="font-display text-4xl tabular-nums">{s.goals_for}</span></li>)}</ol>
          ) : (
            finished.length === 0 ? <p className="text-3xl text-white/60">Aún no hay resultados</p> : <ul className="grid gap-3 lg:grid-cols-2">{finished.map((m) => { const r = derived.resultOf.get(m.id); return <li key={m.id} className="card flex items-center gap-3 text-xl"><PlayerChip participantId={m.home_id} /><span className="rounded-lg bg-black/40 px-3 font-display text-3xl tabular-nums">{r?.home_score}-{r?.away_score}</span><PlayerChip participantId={m.away_id} align="right" /></li>; })}</ul>
          )}
        </div>
      </main>
    </div>
  );
}
