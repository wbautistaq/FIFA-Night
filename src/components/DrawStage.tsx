"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Lightning, Trophy } from "@phosphor-icons/react";
import { Avatar, Stars } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { TeamPoolPreview, groupByStars } from "@/components/TeamPoolPreview";
import { teamStars } from "@/lib/teams";
import type { Participant, Team } from "@/lib/types";

type Assignment = { participantId: string; teamId: string };

const SPIN_MS = 1150;
const LAND_MS = 650;
const POOL_LIMIT = 8;

/**
 * Escenario del sorteo: jugadores a la izquierda, equipos disponibles a la derecha.
 * Sin asignaciones es una vista previa; con ellas, cada jugador "gira" entre los escudos
 * hasta hacer match con su equipo, que pasa a su fila y queda marcado en el banco.
 */
export function DrawStage({ participants, pool, teams, assignments, onDone, instant = false }: {
  participants: Participant[];
  /** Equipos que entran en el sorteo con los filtros actuales. */
  pool: Team[];
  /** Banco completo, para encontrar equipos asignados aunque ya no pasen los filtros. */
  teams: Team[];
  assignments: Assignment[] | null;
  onDone?: () => void;
  /** Muestra el resultado final sin animación. */
  instant?: boolean;
}) {
  // Con "reducir movimiento" no hay giro rápido de escudos, pero sí se revela uno por uno
  const [reduced] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const skip = instant || !assignments;
  const [revealed, setRevealed] = useState(skip ? (assignments?.length ?? 0) : 0);
  const [landed, setLanded] = useState(false);
  const [spinId, setSpinId] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // El padre puede volver a renderizar (tiempo real, sondeo) con una lista nueva pero igual:
  // se compara por contenido para que eso no reinicie la animación a mitad de camino
  const assignmentsKey = assignments ? assignments.map((a) => `${a.participantId}:${a.teamId}`).join("|") : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- assignmentsKey resume el contenido de assignments
  const stableAssignments = useMemo(() => assignments, [assignmentsKey]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const forced = useMemo(() => new Set((stableAssignments ?? []).map((a) => a.teamId)), [stableAssignments]);
  const display = useMemo(() => {
    const ids = new Set(pool.map((t) => t.id));
    return [...pool, ...[...forced].filter((id) => !ids.has(id)).map((id) => teamById.get(id)).filter((t): t is Team => Boolean(t))];
  }, [pool, forced, teamById]);
  // Solo se iluminan escudos que están a la vista en la columna de equipos
  const spinIds = useMemo(() => groupByStars(display, POOL_LIMIT, forced).flatMap((g) => g.shown.map((t) => t.id)), [display, forced]);
  const participantsKey = participants.map((p) => p.id).join("|");
  const order = useMemo(
    () => (stableAssignments ? participants.map((p) => stableAssignments.find((a) => a.participantId === p.id)).filter((a): a is Assignment => Boolean(a)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- participantsKey resume el orden de participants
    [stableAssignments, participantsKey],
  );
  const total = order.length;
  const finished = assignments !== null && revealed >= total;
  const spinKey = spinIds.join("|");

  useEffect(() => {
    if (!stableAssignments) return;
    if (revealed >= total) {
      setSpinId(null);
      doneRef.current?.();
      return;
    }
    const target = order[revealed]!.teamId;
    const ids = spinKey ? spinKey.split("|") : [];
    let i = Math.floor(Math.random() * Math.max(1, ids.length));
    const tick = reduced ? undefined : setInterval(() => { i = (i + 1 + Math.floor(Math.random() * 3)) % Math.max(1, ids.length); setSpinId(ids[i] ?? null); }, 85);
    const land = setTimeout(() => { clearInterval(tick); setSpinId(target); setLanded(true); }, reduced ? 500 : SPIN_MS);
    const next = setTimeout(() => { setLanded(false); setRevealed((r) => r + 1); }, (reduced ? 500 : SPIN_MS) + LAND_MS);
    return () => { clearInterval(tick); clearTimeout(land); clearTimeout(next); };
  }, [stableAssignments, revealed, total, order, spinKey, reduced]);

  const taken = useMemo(() => new Set(order.slice(0, revealed).map((a) => a.teamId)), [order, revealed]);
  const teamOf = new Map(order.map((a) => [a.participantId, a.teamId]));
  const currentAssignment = !finished && assignments ? order[revealed] : undefined;
  const currentPlayer = currentAssignment ? participants.find((p) => p.id === currentAssignment.participantId) : undefined;
  const bannerTeam = landed && currentAssignment ? teamById.get(currentAssignment.teamId) : spinId ? teamById.get(spinId) : undefined;

  return (
    <div className="space-y-3">
      {assignments && !skip ? (
        <div className={clsx("card-glow flex items-center justify-between gap-2 !py-3", landed && "border-neon/60 shadow-glow-neon")} aria-live="polite">
          {finished ? (
            <p className="flex w-full items-center justify-center gap-2 font-display text-lg uppercase text-neon"><Trophy size={22} weight="fill" aria-hidden />Sorteo completo</p>
          ) : currentPlayer ? (
            <>
              <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <Avatar name={currentPlayer.display_name} color={currentPlayer.avatar_color} url={currentPlayer.avatar_url} size={52} />
                <span className="w-full truncate text-sm font-bold">{currentPlayer.nickname || currentPlayer.display_name}</span>
              </span>
              <span className={clsx("flex flex-col items-center font-display text-sm text-white/60", landed && "animate-pop text-neon")}>
                <Lightning size={26} weight="fill" className={landed ? "text-neon" : "text-volt-light animate-pulseGlow"} aria-hidden />
                {landed ? "MATCH" : "VS"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span key={landed ? "landed" : "spin"} className={clsx(landed ? "animate-pop" : "blur-[0.5px]")}>
                  {bannerTeam ? <TeamCrest team={bannerTeam} size={52} stars={false} /> : <span className="block h-[52px] w-[52px]" />}
                </span>
                <span className="w-full truncate text-sm font-bold">{landed && bannerTeam ? bannerTeam.name : "…"}</span>
                {landed && bannerTeam ? <Stars value={teamStars(bannerTeam)} size={10} /> : null}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <section className="card space-y-1.5 !p-2.5" aria-labelledby="stage-players">
          <h4 id="stage-players" className="flex items-baseline justify-between text-xs uppercase tracking-wide text-white/70">Jugadores <span className="font-display text-neon">{participants.length}</span></h4>
          <ol className="space-y-1.5">
            {participants.map((p) => {
              const tid = teamOf.get(p.id);
              const idx = order.findIndex((a) => a.participantId === p.id);
              const done = tid !== undefined && idx < revealed;
              const team = done ? teamById.get(tid!) : undefined;
              const active = currentAssignment?.participantId === p.id;
              return (
                <li key={p.id} className={clsx("flex items-center gap-1.5 rounded-lg p-1 transition", active && "bg-volt/25 ring-1 ring-volt-light", done && !skip && "animate-pop")}>
                  <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{p.nickname || p.display_name}</span>
                    {team ? <span className="block truncate text-[10px] uppercase tracking-wide text-white/60">{team.name}</span> : null}
                  </span>
                  {team ? <TeamCrest team={team} size={26} stars={false} /> : <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-[10px] text-white/40">?</span>}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="card space-y-1.5 !p-2.5" aria-labelledby="stage-teams">
          <h4 id="stage-teams" className="flex items-baseline justify-between text-xs uppercase tracking-wide text-white/70">Equipos <span className="font-display text-neon">{pool.length}</span></h4>
          <TeamPoolPreview teams={display} limit={POOL_LIMIT} compact force={forced} highlight={finished ? null : spinId} taken={taken} />
        </section>
      </div>
    </div>
  );
}
