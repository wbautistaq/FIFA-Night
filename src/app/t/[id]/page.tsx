"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/TournamentShell";
import { MatchRow, PlayerChip } from "@/components/MatchRow";
import { ChampionCard, ShareButton } from "@/components/ShareCard";
import { ActionButton, EmptyState, useToast } from "@/components/ui/primitives";
import { startTournament, cancelTournament, finishTournament } from "@/app/actions/tournaments";
import { nextSwissRound } from "@/app/actions/match-extras";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/labels";
import { format as fmt } from "date-fns";
import { es } from "date-fns/locale";
import type { ReactNode } from "react";
import { CalendarBlank, CaretRight, CheckCircle, GameController, Television, Trophy, UsersThree, WarningCircle, type Icon } from "@phosphor-icons/react";

function Stat({ Icon: StatIcon, label, value }: { Icon: Icon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-xl bg-black/20 px-1 py-3">
      <StatIcon size={22} weight="duotone" className="text-neon" aria-hidden />
      <span className="line-clamp-2 w-full font-display text-[13px] uppercase leading-tight">{value}</span>
      <span className="w-full truncate text-[11px] uppercase tracking-wide text-white/60">{label}</span>
    </div>
  );
}

function Step({ n, done, label, children }: { n: number; done: boolean; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-2 pl-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display ${done ? "bg-neon text-pitch-950" : "bg-white/10 text-white/80"}`}>
          {done ? <CheckCircle size={18} weight="fill" aria-label="Hecho" /> : n}
        </span>
        <span className="min-w-0">{label}</span>
      </span>
      {children}
    </li>
  );
}

export default function Overview() {
  const { snapshot, viewer, id, derived, refresh } = useT();
  const { tournament: t, participants, matches } = snapshot;
  const router = useRouter();
  const toast = useToast();
  const base = `/t/${id}`;

  const playable = matches.filter((m) => m.status !== "cancelled" && m.home_id && m.away_id);
  const live = playable.filter((m) => m.status === "live");
  const upcoming = playable.filter((m) => m.status === "pending").slice(0, 3);
  const mine = playable.filter((m) => viewer.participantId && [m.home_id, m.away_id].includes(viewer.participantId) && m.status !== "finished");
  const toConfirm = playable.filter((m) => {
    const r = derived.resultOf.get(m.id);
    return r?.status === "reported" && r.reported_by !== viewer.participantId && viewer.participantId && [m.home_id, m.away_id].includes(viewer.participantId);
  });
  const champion = t.champion_participant_id ? participants.find((p) => p.id === t.champion_participant_id) : undefined;
  const allAssigned = participants.length > 0 && participants.every((p) => snapshot.assignments.some((a) => a.participant_id === p.id));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const r = await fn();
    if (!r.ok) toast.show("error", r.error ?? "Error");
    else {
      toast.show("success", success);
      await refresh();
    }
  }

  return (
    <div className="space-y-6">
      {champion && (
        <section className="card-glow relative animate-pop overflow-hidden text-center" aria-label="Campeón">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.35),transparent_60%)]" aria-hidden />
          <Trophy size={56} weight="duotone" className="mx-auto text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,.6)]" aria-hidden />
          <p className="eyebrow mt-1 !text-amber-200">Campeón</p>
          <div className="mt-2 flex justify-center"><div className="w-56"><PlayerChip participantId={champion.id} /></div></div>
          <div className="relative mt-4 flex justify-center">
            <ShareButton className="btn-primary" label="Compartir campeón" fileName="campeon-fifa-night" text={`🏆 ${champion.display_name} es el campeón de ${t.name}`} card={<ChampionCard participantId={champion.id} />} />
          </div>
        </section>
      )}

      <section className="card grid grid-cols-3 gap-2 text-center">
        <Stat Icon={GameController} label={PLATFORM_LABEL[t.platform]} value={FORMAT_LABEL[t.format]} />
        <Stat Icon={CalendarBlank} label={fmt(new Date(t.starts_at), "EEE d MMM", { locale: es })} value={fmt(new Date(t.starts_at), "HH:mm")} />
        <Stat Icon={UsersThree} label="Jugadores" value={`${participants.length}/${t.max_players}`} />
        {t.rules ? <p className="col-span-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 text-left text-sm text-white/80">{t.rules}</p> : null}
      </section>

      {viewer.isOrganizer && ["registration", "draw"].includes(t.status) && (
        <section className="card space-y-3" aria-labelledby="org-steps">
          <h2 id="org-steps" className="section-title">Prepara tu torneo</h2>
          <ol className="space-y-2 text-sm">
            <Step n={1} done={participants.length >= 4} label={`Invita a tus amigos (${participants.length}/${t.max_players})`}><Link className="btn-secondary !min-h-10" href={`${base}/invitar`}>Invitar</Link></Step>
            <Step n={2} done={t.draw_confirmed} label={`Sortea los equipos${allAssigned && !t.draw_confirmed ? " (sin confirmar)" : ""}`}><Link className="btn-secondary !min-h-10" href={`${base}/sorteo`}>Sorteo</Link></Step>
            <Step n={3} done={false} label="Genera el calendario">
              <ActionButton className="btn-primary !min-h-10" disabled={!t.draw_confirmed || participants.length < 4} confirm="¿Iniciar el torneo? Ya no podrás cambiar jugadores ni formato." onAction={() => run(() => startTournament(id), "¡Torneo iniciado!")}>Iniciar</ActionButton>
            </Step>
          </ol>
          {participants.length < 4 && <p className="help">Necesitas al menos 4 jugadores.</p>}
        </section>
      )}

      {t.status === "in_progress" && (
        <Link href={`${base}/en-vivo`} className="card-glow card-interactive flex items-center gap-3 !py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-volt/50 to-blaze/30 text-neon ring-1 ring-white/10" aria-hidden><GameController size={28} weight="duotone" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg uppercase">Noche en vivo</span>
            <span className="block text-sm text-white/65">{viewer.isOrganizer ? "Reparte los partidos entre consolas y llama a jugar" : "Qué se juega en cada consola y cuándo te toca"}</span>
          </span>
        </Link>
      )}

      {t.status === "in_progress" && viewer.isOrganizer && (
        <section className="card flex flex-wrap gap-2">
          <Link href={`${base}/tv`} className="btn-primary flex-1"><Television size={20} weight="bold" aria-hidden />Modo TV</Link>
          {t.format === "friendlies" && <ActionButton className="btn-secondary" confirm="¿Cerrar el torneo y coronar al líder de la tabla?" onAction={() => run(() => finishTournament(id), "Torneo finalizado")}>Cerrar torneo</ActionButton>}
          <ActionButton className="btn-ghost text-rose-300" confirm="¿Cancelar el torneo? Esta acción no se puede deshacer." onAction={() => run(() => cancelTournament(id), "Torneo cancelado")}>Cancelar torneo</ActionButton>
        </section>
      )}

      {t.format === "swiss" && t.status === "in_progress" && (() => {
        const rounds = t.settings.swiss_rounds ?? 3;
        const current = Math.max(0, ...matches.map((m) => m.round));
        const roundDone = matches.length > 0 && matches.every((m) => ["finished", "cancelled"].includes(m.status));
        return (
          <section className="card space-y-3" aria-labelledby="swiss-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="swiss-h" className="section-title">Sistema suizo</h2>
              <span className="chip">Ronda {current} de {rounds}</span>
            </div>
            <div className="flex gap-1" aria-hidden>{Array.from({ length: rounds }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < current ? "bg-neon" : "bg-white/15"}`} />)}</div>
            {viewer.isOrganizer && roundDone && current < rounds ? (
              <ActionButton className="btn-primary w-full" onAction={() => run(() => nextSwissRound(id), `¡Ronda ${current + 1} emparejada!`)}>Emparejar ronda {current + 1}</ActionButton>
            ) : (
              <p className="help !mt-0">{roundDone ? "Se jugaron todas las rondas." : "Cuando terminen todos los partidos de esta ronda, se emparejará la siguiente según la tabla, sin repetir rivales."}</p>
            )}
          </section>
        );
      })()}

      {toConfirm.length > 0 && (
        <section aria-labelledby="confirm-h" className="space-y-2">
          <h2 id="confirm-h" className="section-title flex items-center gap-2 text-amber-300"><WarningCircle size={22} weight="fill" aria-hidden />Confirma estos resultados</h2>
          {toConfirm.map((m) => <MatchRow key={m.id} match={m} />)}
        </section>
      )}
      {live.length > 0 && (
        <section aria-labelledby="live-h" className="space-y-2">
          <h2 id="live-h" className="section-title flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulseGlow rounded-full bg-blaze shadow-[0_0_10px_#f43f5e]" aria-hidden />En juego ahora</h2>
          {live.map((m) => <MatchRow key={m.id} match={m} />)}
        </section>
      )}
      {mine.length > 0 && (
        <section aria-labelledby="mine-h" className="space-y-2">
          <p className="eyebrow">Tu agenda</p>
          <h2 id="mine-h" className="section-title -mt-1">Mis próximos partidos</h2>
          {mine.slice(0, 3).map((m) => <MatchRow key={m.id} match={m} />)}
        </section>
      )}
      {t.status === "in_progress" && (
        <section aria-labelledby="next-h" className="space-y-2">
          <div className="flex items-end justify-between"><h2 id="next-h" className="section-title">Próximos partidos</h2><Link href={`${base}/calendario`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-neon">Ver todos<CaretRight size={14} weight="bold" aria-hidden /></Link></div>
          {upcoming.length ? upcoming.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState icon={CheckCircle} title="No quedan partidos pendientes" />}
        </section>
      )}

      <section aria-labelledby="players-h" className="space-y-2">
        <h2 id="players-h" className="section-title">Jugadores</h2>
        {participants.length === 0 ? <EmptyState icon={UsersThree} title="Aún no hay jugadores">Comparte el link de invitación.</EmptyState> : (
          <div className="grid gap-2 sm:grid-cols-2">{participants.map((p) => <Link key={p.id} href={`${base}/jugador/${p.id}`} className="card card-interactive !p-3"><PlayerChip participantId={p.id} lead="player" /></Link>)}</div>
        )}
      </section>
      <button className="sr-only" onClick={() => router.refresh()}>Actualizar</button>
      {toast.node}
    </div>
  );
}
