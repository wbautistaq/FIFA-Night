"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CaretDown, CaretUp, ChartBar, Fire, Skull, Snowflake, Sword, Target, Trophy } from "@phosphor-icons/react";
import { ELO_START, buildHistory, eloRatings, headToHead, identityKey, rivalries, type HMatch, type HParticipant, type HResult, type HTournament, type Rivalry } from "@/lib/history";
import { Avatar, EmptyState } from "@/components/ui/primitives";

type Tab = "rivales" | "ranking" | "h2h";

const TAG: Record<NonNullable<Rivalry["tag"]>, { label: string; className: string }> = {
  nemesis: { label: "Tu némesis", className: "border-blaze/60 bg-blaze/15 text-blaze-light" },
  victim: { label: "Víctima favorita", className: "border-neon/60 bg-neon/10 text-neon" },
  even: { label: "Rivalidad pareja", className: "border-amber-300/50 bg-amber-300/10 text-amber-200" },
};

export function HistoryView({ me, tournaments, participants, matches, results }: { me: string; tournaments: HTournament[]; participants: HParticipant[]; matches: HMatch[]; results: HResult[] }) {
  const history = useMemo(() => buildHistory(tournaments, participants, matches, results), [tournaments, participants, matches, results]);
  const myKey = `u:${me}`;
  const iPlayed = history.some((h) => h.key === myKey && h.played > 0);
  const [tab, setTab] = useState<Tab>(iPlayed ? "rivales" : "ranking");
  const [a, setA] = useState(history.some((h) => h.key === myKey) ? myKey : (history[0]?.key ?? ""));
  const [b, setB] = useState(history.find((h) => h.key !== a)?.key ?? "");
  const h2h = useMemo(() => (a && b && a !== b ? headToHead(a, b, tournaments, participants, matches, results) : null), [a, b, tournaments, participants, matches, results]);
  const elo = useMemo(() => eloRatings(participants, matches, results), [participants, matches, results]);
  const ranked = useMemo(() => [...history].filter((h) => h.played > 0).sort((x, y) => (elo.get(y.key)?.rating ?? ELO_START) - (elo.get(x.key)?.rating ?? ELO_START) || x.name.localeCompare(y.name)), [history, elo]);
  const mine = useMemo(() => rivalries(myKey, tournaments, participants, matches, results), [myKey, tournaments, participants, matches, results]);
  // Avatar más reciente de cada jugador (sus participaciones pueden tener avatares distintos)
  const face = useMemo(() => {
    const m = new Map<string, HParticipant>();
    for (const p of participants) m.set(identityKey(p), p);
    return m;
  }, [participants]);
  const nameOf = (k: string) => history.find((h) => h.key === k)?.name ?? "?";
  const avatar = (k: string, size: number) => <Avatar name={nameOf(k)} url={face.get(k)?.avatar_url} color={face.get(k)?.avatar_color ?? "#7c3aed"} size={size} />;

  if (history.length === 0 || history.every((h) => h.played === 0)) {
    return <div className="space-y-4"><h1 className="text-3xl uppercase">Historial</h1><EmptyState icon={ChartBar} title="Todavía no hay historia">Cuando se confirmen partidos en tus torneos, aquí verás tus rivalidades, el ranking y los cara a cara.</EmptyState></div>;
  }

  const tabs: { id: Tab; label: string }[] = [{ id: "rivales", label: "Rivalidades" }, { id: "ranking", label: "Ranking" }, { id: "h2h", label: "Cara a cara" }];
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Entre amigos</p>
        <h1 className="text-3xl uppercase">Historial</h1>
      </div>
      <div role="tablist" aria-label="Secciones del historial" className="flex gap-1 rounded-2xl border border-white/10 bg-pitch-900/70 p-1">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx("min-h-11 flex-1 rounded-xl text-sm font-semibold uppercase tracking-wide transition", tab === t.id ? "bg-gradient-to-b from-volt/40 to-volt/10 text-neon" : "text-white/65 hover:text-white")}>{t.label}</button>
        ))}
      </div>

      {tab === "rivales" && (
        mine.length === 0 ? <EmptyState icon={Sword} title="Aún no tienes rivales">Juega partidos con tu cuenta y aquí verás contra quién ganas y quién es tu némesis.</EmptyState> : (
          <ul className="space-y-3">
            {mine.map((r) => {
              const total = r.games || 1;
              return (
                <li key={r.b} className={clsx("card space-y-3", r.tag === "nemesis" && "border-blaze/50", r.tag === "victim" && "border-neon/40")}>
                  <div className="flex items-center gap-3">
                    {avatar(myKey, 40)}
                    <div className="flex-1 text-center">
                      <p className="font-display text-3xl tabular-nums"><span className="text-neon">{r.aWins}</span><span className="mx-2 text-white/40">·</span><span className="text-white/70">{r.draws}</span><span className="mx-2 text-white/40">·</span><span className="text-blaze-light">{r.bWins}</span></p>
                      <p className="text-[11px] uppercase tracking-wider text-white/55">G · E · P en {r.games} {r.games === 1 ? "partido" : "partidos"}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">{avatar(r.b, 40)}<span className="max-w-[5rem] truncate text-xs font-bold">{r.opponentName}</span></div>
                  </div>
                  {/* Barra de dominio: verde victorias, gris empates, rosa derrotas */}
                  <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${r.aWins} victorias, ${r.draws} empates y ${r.bWins} derrotas contra ${r.opponentName}`}>
                    <span className="bg-neon" style={{ width: `${(r.aWins / total) * 100}%` }} />
                    <span className="bg-white/40" style={{ width: `${(r.draws / total) * 100}%` }} />
                    <span className="bg-blaze" style={{ width: `${(r.bWins / total) * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {r.tag ? <span className={clsx("chip", TAG[r.tag].className)}>{r.tag === "nemesis" ? <Skull size={14} weight="fill" aria-hidden /> : r.tag === "victim" ? <Target size={14} weight="fill" aria-hidden /> : <Sword size={14} weight="fill" aria-hidden />}{TAG[r.tag].label}</span> : null}
                    {r.streak.who ? <span className="chip !normal-case">{r.streak.who === "a" ? <Fire size={14} weight="fill" className="text-orange-400" aria-hidden /> : <Snowflake size={14} weight="fill" className="text-sky-300" aria-hidden />}{r.streak.who === "a" ? `Ganas ${r.streak.length} seguidas` : `Pierdes ${r.streak.length} seguidas`}</span> : null}
                    <span className="text-white/60">Goles {r.aGoals}-{r.bGoals}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "ranking" && (
        <div className="space-y-3">
          {/* Podio Elo: los tres mejores del grupo */}
          <ol className="grid grid-cols-3 gap-2" aria-label="Podio del ranking Elo">
            {ranked.slice(0, 3).map((p, i) => (
              <li key={p.key} className={clsx("card flex flex-col items-center gap-1 !p-3 text-center", i === 0 && "border-amber-300/50 shadow-[0_0_24px_-8px_rgba(251,191,36,.6)]")}>
                <span className={clsx("grid h-6 w-6 place-items-center rounded-md font-display text-xs text-pitch-950", i === 0 ? "bg-amber-300" : i === 1 ? "bg-slate-300" : "bg-orange-400")}>{i + 1}</span>
                {avatar(p.key, 44)}
                <span className="w-full truncate text-sm font-bold">{p.name}</span>
                <span className="font-display text-xl text-neon">{elo.get(p.key)?.rating ?? ELO_START}</span>
              </li>
            ))}
          </ol>
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[700px] text-sm">
              <caption className="sr-only">Ranking Elo y estadísticas históricas por jugador</caption>
              <thead className="bg-black/30 font-display text-[11px] uppercase tracking-wider text-white/60">
                <tr><th className="p-2 text-left">Jugador</th><th scope="col" className="p-2 text-center text-neon">Elo</th>{["Máx.", "Torneos", "Títulos", "PJ", "G", "E", "P", "DG", "% V", "Racha", "MVP"].map((x) => <th key={x} scope="col" className="p-2 text-center">{x}</th>)}</tr>
              </thead>
              <tbody>{ranked.map((p, i) => {
                const e = elo.get(p.key);
                return (
                  <tr key={p.key} className={clsx("border-t border-white/5", p.key === myKey && "bg-neon/[.06] shadow-[inset_3px_0_0_#2ee6ff]")}>
                    <th scope="row" className="p-2 text-left font-semibold"><span className="flex items-center gap-2"><span className="w-4 text-center font-display text-white/50">{i + 1}</span>{avatar(p.key, 26)}<span className="truncate">{p.name}</span>{p.titles > 0 ? <Trophy size={14} weight="fill" className="text-amber-300" aria-label="Campeón" /> : null}</span></th>
                    <td className="p-2 text-center"><span className="font-display text-neon tabular-nums">{e?.rating ?? ELO_START}</span>{e?.lastChange ? <span className={clsx("ml-1 inline-flex items-center text-[11px] tabular-nums", e.lastChange > 0 ? "text-emerald-300" : "text-rose-300")}>{e.lastChange > 0 ? <CaretUp size={10} weight="fill" aria-label="subió" /> : <CaretDown size={10} weight="fill" aria-label="bajó" />}{Math.abs(e.lastChange)}</span> : null}</td>
                    {[e?.peak ?? ELO_START, p.tournaments, p.titles, p.played, p.won, p.drawn, p.lost, p.goalDifference, `${p.winRate}%`].map((v, j) => <td key={j} className="p-2 text-center tabular-nums">{v}</td>)}
                    <td className="p-2 text-center tabular-nums">{p.currentStreak > 0 ? <span className="inline-flex items-center gap-0.5 text-orange-300"><Fire size={12} weight="fill" aria-label="racha de victorias" />{p.currentStreak}</span> : p.currentStreak < 0 ? <span className="inline-flex items-center gap-0.5 text-sky-300"><Snowflake size={12} weight="fill" aria-label="racha de derrotas" />{-p.currentStreak}</span> : "–"}</td>
                    <td className="p-2 text-center tabular-nums">{p.mvps}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className="help">Elo: todos empiezan con {ELO_START}. Ganar a alguien con más Elo da más puntos y las goleadas cuentan más.</p>
        </div>
      )}

      {tab === "h2h" && (
        <section className="card space-y-4" aria-labelledby="h2h">
          <h2 id="h2h" className="text-lg uppercase">Cara a cara</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Jugador A<select className="input mt-1" value={a} onChange={(e) => setA(e.target.value)}>{history.map((h) => <option key={h.key} value={h.key}>{h.name}</option>)}</select></label>
            <label className="label">Jugador B<select className="input mt-1" value={b} onChange={(e) => setB(e.target.value)}>{history.filter((h) => h.key !== a).map((h) => <option key={h.key} value={h.key}>{h.name}</option>)}</select></label>
          </div>
          {h2h && (h2h.aWins + h2h.bWins + h2h.draws === 0 ? <p className="text-sm text-white/70">Aún no se han enfrentado.</p> : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-center text-center">
                <div className="flex flex-col items-center gap-1">{avatar(a, 48)}<p className="font-display text-4xl text-neon">{h2h.aWins}</p><p className="text-xs text-white/60">{nameOf(a)}</p></div>
                <div><p className="font-display text-4xl">{h2h.draws}</p><p className="text-xs text-white/60">Empates</p></div>
                <div className="flex flex-col items-center gap-1">{avatar(b, 48)}<p className="font-display text-4xl text-blaze-light">{h2h.bWins}</p><p className="text-xs text-white/60">{nameOf(b)}</p></div>
              </div>
              <p className="text-center text-sm text-white/70">Goles: {h2h.aGoals} - {h2h.bGoals}</p>
              {h2h.biggest && <p className="text-center text-sm">Mayor goleada: <strong>{h2h.biggest.winner === "a" ? nameOf(a) : nameOf(b)}</strong> {h2h.biggest.winner === "a" ? `${h2h.biggest.aScore}-${h2h.biggest.bScore}` : `${h2h.biggest.bScore}-${h2h.biggest.aScore}`}</p>}
              {h2h.streak.who && <p className="text-center text-sm">Racha vigente: {h2h.streak.who === "a" ? nameOf(a) : nameOf(b)} ({h2h.streak.length} seguidas)</p>}
              <ul className="space-y-1" aria-label="Últimos enfrentamientos">{h2h.last.map((g) => <li key={g.matchId} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span className="truncate text-white/70">{g.tournament}</span><span className="font-display tabular-nums">{g.aScore} - {g.bScore}</span></li>)}</ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
