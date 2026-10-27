"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowsClockwise, FilmSlate, Heart, Target, LockSimple, MagnifyingGlass, Prohibit, Shuffle, Trash, UsersThree } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";
import { DrawStage } from "@/components/DrawStage";
import { ActionButton, Avatar, EmptyState, Field, Stars, Toggle, useToast } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { TeamRoulette } from "@/components/TeamRoulette";
import { DEFAULT_DRAW_OPTIONS, DrawError, drawTeams, filterPool, ratingSpread, type DrawOptions } from "@/lib/engine/draw";
import { secureRng } from "@/lib/engine/rng";
import { teamStars } from "@/lib/teams";
import { addTeam, confirmDraw, removeTeam, saveDraw, setTeamFlag } from "@/app/actions/draw";

const STAR_STEPS = [5, 4.5, 4, 3.5, 3, 2.5, 2];
// Misma escala que el banco FC 26 (scripts/build-teams.mjs): 5★ = 86, cada media estrella = 2 puntos
const ratingForStars = (s: number) => Math.round(66 + s * 4);
const NATIONAL = "Selecciones";

export default function Draw() {
  const { id, snapshot, viewer, derived, refresh } = useT();
  const { tournament: t, participants, assignments } = snapshot;
  const toast = useToast();
  const [opts, setOpts] = useState<DrawOptions>(DEFAULT_DRAW_OPTIONS);
  const [proposal, setProposal] = useState<{ participantId: string; teamId: string }[] | null>(null);
  const [animating, setAnimating] = useState(false);
  // Cada sorteo nuevo vuelve a montar el escenario para que la animación arranque desde cero
  const [drawKey, setDrawKey] = useState(0);
  // ?reveal=1 (al venir del torneo relámpago) reproduce la animación del sorteo ya guardado
  const revealParam = useSearchParams().get("reveal") === "1";
  const [replay, setReplay] = useState(revealParam);
  // Ruleta: cada jugador elige entre 3 equipos; su resultado se muestra sin la animación del sorteo
  const [roulette, setRoulette] = useState(false);
  const [fromRoulette, setFromRoulette] = useState(false);
  const [search, setSearch] = useState("");
  const [bankLeague, setBankLeague] = useState<string | null>(null);
  const [bankMinStars, setBankMinStars] = useState(0);
  const [newTeam, setNewTeam] = useState({ name: "", short_name: "", league: "", country: "", rating: ratingForStars(4), kind: "club" as "club" | "national" });
  const teams = derived.teams;
  const canManage = viewer.isOrganizer && !(t.draw_confirmed || !["registration", "draw", "draft"].includes(t.status));
  const leagues = useMemo(() => [...new Set(teams.filter((x) => x.kind === "club").map((x) => x.league))].sort(), [teams]);
  const pool = useMemo(() => filterPool(teams, opts), [teams, opts]);
  const poolTeams = useMemo(() => { const ids = new Set(pool.map((p) => p.id)); return teams.filter((tm) => ids.has(tm.id)); }, [teams, pool]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((x) =>
      (!q || x.name.toLowerCase().includes(q) || x.short_name.toLowerCase().includes(q)) &&
      (!bankLeague || x.league === bankLeague) &&
      teamStars(x) >= bankMinStars);
  }, [teams, search, bankLeague, bankMinStars]);

  function run() {
    try {
      const res = drawTeams(participants.map((p) => p.id), teams, opts, secureRng);
      setProposal(res);
      setFromRoulette(false);
      setDrawKey((k) => k + 1);
      setAnimating(true);
      requestAnimationFrame(() => document.getElementById("res-h")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      toast.show("error", e instanceof DrawError ? e.message : "No se pudo sortear");
    }
  }

  async function confirm() {
    const list = proposal ?? assignments.map((a) => ({ participantId: a.participant_id, teamId: a.team_id }));
    const saved = await saveDraw(id, list);
    if (!saved.ok) return toast.show("error", saved.error);
    const done = await confirmDraw(id);
    if (!done.ok) return toast.show("error", done.error);
    toast.show("success", "Sorteo confirmado y bloqueado");
    setProposal(null);
    await refresh();
  }

  const starsSelect = (k: "minRating" | "maxRating") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setOpts({ ...opts, [k]: e.target.value === "" ? undefined : ratingForStars(Number(e.target.value)) });
  const starsOf = (rating?: number) => (rating === undefined ? "" : String((rating - 66) / 4));
  const toggleLeague = (l: string) => {
    const set = new Set(opts.leagues ?? []);
    if (set.has(l)) set.delete(l); else set.add(l);
    setOpts({ ...opts, leagues: [...set] });
  };
  const saved = useMemo(() => (assignments.length ? assignments.map((a) => ({ participantId: a.participant_id, teamId: a.team_id })) : null), [assignments]);
  const current = proposal ?? saved;
  const flag = async (teamId: string, key: "favorite" | "banned", value: boolean) => {
    const r = await setTeamFlag(id, teamId, key, value);
    if (!r.ok) toast.show("error", r.error); else await refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">EA SPORTS FC 27</p>
        <h2 className="section-title">Sorteo de equipos</h2>
      </div>

      {participants.length < 2 ? <EmptyState icon={UsersThree} title="Necesitas jugadores para sortear">Invita a tus amigos primero.</EmptyState> : null}

      {canManage && participants.length >= 2 && roulette && (
        <TeamRoulette participants={participants} pool={poolTeams}
          onCancel={() => setRoulette(false)}
          onComplete={(picks) => { setProposal(picks); setFromRoulette(true); setAnimating(false); setRoulette(false); requestAnimationFrame(() => document.getElementById("res-h")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
      )}

      {canManage && participants.length >= 2 && !roulette && (
        <section className="card space-y-4" aria-labelledby="opt-h">
          <h3 id="opt-h" className="text-lg uppercase">Opciones</h3>
          <Toggle id="o-rep" label="Evitar equipos repetidos" checked={opts.avoidRepeats} onChange={(v) => setOpts({ ...opts, avoidRepeats: v })} />
          <Toggle id="o-bal" label="Sorteo equilibrado" checked={opts.balanced} onChange={(v) => setOpts({ ...opts, balanced: v })} help="Busca equipos con estrellas parecidas" />
          <Toggle id="o-club" label="Incluir clubes" checked={opts.allowClubs} onChange={(v) => setOpts({ ...opts, allowClubs: v })} />
          <Toggle id="o-nat" label="Incluir selecciones" checked={opts.allowNational} onChange={(v) => setOpts({ ...opts, allowNational: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mínimo de estrellas" htmlFor="rmin">
              <select id="rmin" className="input" value={starsOf(opts.minRating)} onChange={starsSelect("minRating")}><option value="">Sin mínimo</option>{STAR_STEPS.map((s) => <option key={s} value={s}>{s} ★</option>)}</select>
            </Field>
            <Field label="Máximo de estrellas" htmlFor="rmax">
              <select id="rmax" className="input" value={starsOf(opts.maxRating)} onChange={starsSelect("maxRating")}><option value="">Sin máximo</option>{STAR_STEPS.map((s) => <option key={s} value={s}>{s} ★</option>)}</select>
            </Field>
          </div>
          <fieldset>
            <legend className="label">Ligas de clubes <span className="font-normal text-white/60">(ninguna marcada = todas)</span></legend>
            <div className="flex flex-wrap gap-2">
              {leagues.map((l) => {
                const on = (opts.leagues ?? []).includes(l);
                return <button key={l} type="button" aria-pressed={on} onClick={() => toggleLeague(l)} className={clsx("min-h-10 rounded-full border px-3 text-sm font-semibold transition", on ? "border-neon bg-neon/15 text-neon shadow-glow-neon" : "border-white/15 bg-white/[.04] text-white/80 hover:border-white/30")}>{l}</button>;
              })}
            </div>
          </fieldset>
          <p className="help"><span className="font-display text-neon">{pool.length}</span> equipos disponibles para {participants.length} jugadores.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-primary" onClick={run} disabled={animating}>{proposal ? <><ArrowsClockwise size={20} weight="bold" aria-hidden />Repetir sorteo</> : <><Shuffle size={20} weight="bold" aria-hidden />Sortear</>}</button>
            <button className="btn-secondary" onClick={() => setRoulette(true)} disabled={animating || pool.length === 0}><Target size={20} weight="bold" aria-hidden />Ruleta: elegir entre 3</button>
          </div>
        </section>
      )}

      {!current && participants.length >= 2 && !roulette && (
        <section className="space-y-3" aria-labelledby="prev-h">
          <h3 id="prev-h" className="text-lg uppercase">Así llegan al sorteo</h3>
          <DrawStage participants={participants} pool={poolTeams} teams={teams} assignments={null} />
        </section>
      )}

      {current && (
        <section className="space-y-3" aria-labelledby="res-h">
          <h3 id="res-h" className="flex items-center gap-2 text-lg uppercase">{proposal ? "Resultado del sorteo" : "Equipos asignados"}{t.draw_confirmed ? <LockSimple size={18} weight="fill" className="text-neon" aria-label="Bloqueado" /> : null}</h3>
          {proposal && fromRoulette ? (
            <ul className="grid gap-2 sm:grid-cols-2">{proposal.map((a) => { const p = participants.find((x) => x.id === a.participantId); const tm = teams.find((x) => x.id === a.teamId); return (
              <li key={a.participantId} className="card flex items-center gap-3 !p-3">{p ? <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={40} /> : null}<span className="min-w-0 flex-1"><span className="block truncate font-bold">{p?.nickname || p?.display_name}</span><span className="block truncate text-[11px] uppercase tracking-wide text-white/60">{tm?.name}</span></span>{tm ? <TeamCrest team={tm} size={34} /> : null}</li>
            ); })}</ul>
          ) : proposal ? <DrawStage key={`draw-${drawKey}`} participants={participants} pool={poolTeams} teams={teams} assignments={proposal} onDone={() => setAnimating(false)} />
            : (
              <>
                <DrawStage key={`saved-${drawKey}-${replay}`} participants={participants} pool={poolTeams} teams={teams} assignments={current} instant={!replay} onDone={() => setReplay(false)} />
                {!replay && <button type="button" className="btn-ghost w-full !min-h-10 text-sm" onClick={() => { setDrawKey((k) => k + 1); setReplay(true); }}><FilmSlate size={18} aria-hidden />Ver la animación del sorteo</button>}
              </>
            )}
          {proposal && !animating && <p className="help">Diferencia entre el mejor y el peor equipo: {(ratingSpread(proposal, teams) / 4).toFixed(1)} ★</p>}
          {viewer.isOrganizer && !t.draw_confirmed && !animating && (
            <div className="flex gap-2">
              {proposal && <button className="btn-secondary flex-1" onClick={run}>Repetir</button>}
              <ActionButton className="btn-primary flex-1" confirm="Al confirmar, el sorteo queda bloqueado. ¿Continuar?" onAction={confirm}>Confirmar sorteo</ActionButton>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="bank-h">
        <div className="flex items-end justify-between gap-2">
          <h3 id="bank-h" className="text-lg uppercase">Equipos disponibles</h3>
          <span className="text-xs text-white/60">{shown.length} de {teams.length}</span>
        </div>
        <label className="relative block">
          <span className="sr-only">Buscar equipo</span>
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" aria-hidden />
          <input className="input pl-10" placeholder="Buscar equipo o sigla…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por liga">
          {[null, ...leagues, NATIONAL].map((l) => (
            <button key={l ?? "all"} type="button" aria-pressed={bankLeague === l} onClick={() => setBankLeague(l)} className={clsx("min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold transition", bankLeague === l ? "border-volt-light bg-volt/30 text-white" : "border-white/15 bg-white/[.04] text-white/75 hover:border-white/30")}>{l ?? "Todas"}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="bstars" className="text-white/70">Mínimo</label>
          <select id="bstars" className="input !min-h-10 !w-auto py-1" value={bankMinStars} onChange={(e) => setBankMinStars(Number(e.target.value))}><option value={0}>Todas las estrellas</option>{STAR_STEPS.slice(0, 5).map((s) => <option key={s} value={s}>{s} ★ o más</option>)}</select>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {shown.map((tm) => (
            <li key={tm.id} className={clsx("card flex items-center gap-3 !p-2.5", tm.banned && "opacity-45", tm.favorite && "border-amber-300/40")}>
              <TeamCrest team={tm} size={38} stars={false} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{tm.name}</span>
                <span className="flex items-center gap-2"><Stars value={teamStars(tm)} /><span className="truncate text-[11px] uppercase tracking-wide text-white/55">{tm.league}</span></span>
              </span>
              {canManage && (
                <span className="flex shrink-0">
                  <button className="btn-ghost !min-h-11 !w-11 !px-0" aria-pressed={tm.favorite} aria-label={`${tm.favorite ? "Quitar de" : "Marcar como"} favorito ${tm.name}`} onClick={() => flag(tm.id, "favorite", !tm.favorite)}><Heart size={20} weight={tm.favorite ? "fill" : "regular"} className={tm.favorite ? "text-amber-300" : undefined} aria-hidden /></button>
                  <button className="btn-ghost !min-h-11 !w-11 !px-0" aria-pressed={tm.banned} aria-label={`${tm.banned ? "Permitir" : "Prohibir"} ${tm.name}`} onClick={() => flag(tm.id, "banned", !tm.banned)}><Prohibit size={20} weight={tm.banned ? "fill" : "regular"} className={tm.banned ? "text-blaze" : undefined} aria-hidden /></button>
                  {tm.tournament_id === id && <button className="btn-ghost !min-h-11 !w-11 !px-0" aria-label={`Eliminar ${tm.name}`} onClick={async () => { const r = await removeTeam(id, tm.id); if (!r.ok) toast.show("error", r.error); else await refresh(); }}><Trash size={20} aria-hidden /></button>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 ? <p className="help text-center">Ningún equipo coincide con los filtros.</p> : null}

        {canManage && (
          <form className="card grid grid-cols-2 gap-3" onSubmit={async (e) => { e.preventDefault(); const r = await addTeam(id, newTeam); if (!r.ok) return toast.show("error", r.error); toast.show("success", "Equipo agregado"); setNewTeam({ ...newTeam, name: "", short_name: "" }); await refresh(); }}>
            <h4 className="col-span-2 uppercase">Agregar equipo propio</h4>
            <Field label="Nombre" htmlFor="tn"><input id="tn" className="input" value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} required /></Field>
            <Field label="Sigla (2-4)" htmlFor="ts"><input id="ts" className="input uppercase" maxLength={4} value={newTeam.short_name} onChange={(e) => setNewTeam({ ...newTeam, short_name: e.target.value })} required /></Field>
            <Field label="Liga" htmlFor="tl"><input id="tl" className="input" value={newTeam.league} onChange={(e) => setNewTeam({ ...newTeam, league: e.target.value })} required /></Field>
            <Field label="País" htmlFor="tc"><input id="tc" className="input" value={newTeam.country} onChange={(e) => setNewTeam({ ...newTeam, country: e.target.value })} required /></Field>
            <Field label="Estrellas" htmlFor="tr"><select id="tr" className="input" value={(newTeam.rating - 66) / 4} onChange={(e) => setNewTeam({ ...newTeam, rating: ratingForStars(Number(e.target.value)) })}>{STAR_STEPS.map((s) => <option key={s} value={s}>{s} ★</option>)}</select></Field>
            <Field label="Tipo" htmlFor="tk"><select id="tk" className="input" value={newTeam.kind} onChange={(e) => setNewTeam({ ...newTeam, kind: e.target.value as "club" | "national" })}><option value="club">Club</option><option value="national">Selección</option></select></Field>
            <button className="btn-secondary col-span-2">Agregar al banco</button>
          </form>
        )}
      </section>
      {toast.node}
    </div>
  );
}
