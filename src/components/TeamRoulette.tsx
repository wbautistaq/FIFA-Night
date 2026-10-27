"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowsClockwise, CheckCircle, SpinnerGap } from "@phosphor-icons/react";
import { TeamCrest } from "@/components/TeamCrest";
import { Avatar, Stars } from "@/components/ui/primitives";
import { secureRng, shuffle } from "@/lib/engine/rng";
import { teamStars } from "@/lib/teams";
import type { Participant, Team } from "@/lib/types";

type Pick = { participantId: string; teamId: string };

/**
 * Ruleta de equipos: por turnos, cada jugador gira y elige entre 3 equipos del banco filtrado.
 * Cada uno tiene un comodín para volver a girar. Al terminar devuelve la asignación completa.
 */
export function TeamRoulette({ participants, pool, onComplete, onCancel }: {
  participants: Participant[];
  pool: Team[];
  onComplete: (picks: Pick[]) => void;
  onCancel: () => void;
}) {
  const order = useMemo(() => shuffle(participants, secureRng), [participants]);
  const [turn, setTurn] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [options, setOptions] = useState<Team[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState<Team[]>([]);
  const [rerolled, setRerolled] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const current = order[turn];
  const taken = new Set(picks.map((p) => p.teamId));
  const available = pool.filter((t) => !taken.has(t.id));
  const enough = available.length >= 1;

  useEffect(() => () => timers.current.forEach(clearInterval), []);

  function spin() {
    if (!enough) return;
    const choice = shuffle(available, secureRng).slice(0, Math.min(3, available.length));
    if (reduced) return setOptions(choice);
    setSpinning(true);
    setOptions([]);
    // Las tres ranuras giran entre escudos y se detienen una tras otra
    const tick = setInterval(() => setFlash(shuffle(available, secureRng).slice(0, 3)), 90);
    timers.current.push(tick);
    setTimeout(() => {
      clearInterval(tick);
      setSpinning(false);
      setOptions(choice);
    }, 1400);
  }

  function choose(team: Team) {
    if (!current) return;
    const next = [...picks, { participantId: current.id, teamId: team.id }];
    setPicks(next);
    setOptions([]);
    if (next.length === order.length) onComplete(next);
    else setTurn(turn + 1);
  }

  function reroll() {
    if (!current) return;
    setRerolled(new Set(rerolled).add(current.id));
    spin();
  }

  if (!current) return null;
  const shown = spinning ? flash : options;
  return (
    <section className="card-glow space-y-4" aria-labelledby="roulette-h" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h3 id="roulette-h" className="text-lg uppercase">Ruleta de equipos</h3>
        <span className="chip">{picks.length + 1} / {order.length}</span>
      </div>
      <div className="flex items-center gap-3">
        <Avatar name={current.display_name} color={current.avatar_color} url={current.avatar_url} size={52} />
        <div>
          <p className="eyebrow">Te toca</p>
          <p className="font-display text-2xl uppercase">{current.nickname || current.display_name}</p>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {shown.map((t, i) => (
            <button key={`${t.id}-${i}`} type="button" disabled={spinning} onClick={() => choose(t)}
              className={clsx("flex min-h-36 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition", spinning ? "border-white/10 bg-white/[.04] blur-[1px]" : "animate-pop border-volt-light/50 bg-gradient-to-b from-volt/20 to-transparent hover:border-neon hover:shadow-glow-neon active:scale-95")}>
              <TeamCrest team={t} size={48} stars={false} />
              <span className="line-clamp-2 text-xs font-bold leading-tight">{t.name}</span>
              <Stars value={teamStars(t)} size={10} />
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn-primary w-full !min-h-16 text-lg" onClick={spin} disabled={!enough}>
          {spinning ? <SpinnerGap size={22} className="animate-spin" aria-hidden /> : <ArrowsClockwise size={22} weight="bold" aria-hidden />}Girar la ruleta
        </button>
      )}
      {!enough ? <p className="error-text">No quedan equipos con estos filtros. Amplía los filtros del sorteo.</p> : null}

      {options.length > 0 && !spinning ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="help !mt-0">Toca el equipo que elige {current.nickname || current.display_name}.</p>
          <button type="button" className="btn-ghost !min-h-10 text-sm" disabled={rerolled.has(current.id)} onClick={reroll}>
            <ArrowsClockwise size={16} aria-hidden />{rerolled.has(current.id) ? "Comodín usado" : "Comodín: girar otra vez"}
          </button>
        </div>
      ) : null}

      {picks.length > 0 ? (
        <ul className="space-y-1.5 border-t border-white/10 pt-3" aria-label="Equipos elegidos">
          {picks.map((p) => {
            const who = participants.find((x) => x.id === p.participantId);
            const team = pool.find((t) => t.id === p.teamId);
            return (
              <li key={p.participantId} className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} weight="fill" className="text-neon" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-semibold">{who?.nickname || who?.display_name}</span>
                {team ? <><TeamCrest team={team} size={22} stars={false} /><span className="max-w-[45%] truncate text-white/75">{team.name}</span></> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <button type="button" className="btn-ghost w-full !min-h-10 text-sm" onClick={onCancel}>Cancelar ruleta</button>
    </section>
  );
}
