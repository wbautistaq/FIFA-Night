"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Stars } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { teamStars } from "@/lib/teams";
import type { Participant, Team } from "@/lib/types";

/**
 * Animación de sorteo estilo bolsa de la Champions: cada jugador "gira" entre escudos
 * y se revela el equipo asignado, uno por uno.
 */
export function DrawStage({ participants, teams, assignments, onDone, speed = 1 }: {
  participants: Participant[];
  teams: Team[];
  assignments: { participantId: string; teamId: string }[];
  onDone: () => void;
  speed?: number;
}) {
  const [revealed, setRevealed] = useState(0);
  const [spin, setSpin] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) {
      setRevealed(assignments.length);
      doneRef.current();
      return;
    }
    if (revealed >= assignments.length) {
      doneRef.current();
      return;
    }
    const tick = setInterval(() => setSpin((s) => s + 1), 70);
    const reveal = setTimeout(() => setRevealed((r) => r + 1), 1100 / speed);
    return () => {
      clearInterval(tick);
      clearTimeout(reveal);
    };
  }, [revealed, assignments.length, reduced, speed]);

  const pool = teams.length ? teams : [];
  return (
    <ol className="space-y-2" aria-live="polite" aria-label="Resultado del sorteo">
      {assignments.map((a, i) => {
        const p = participants.find((x) => x.id === a.participantId);
        const team = teamById.get(a.teamId);
        if (!p || !team) return null;
        const isRevealed = i < revealed;
        const spinning = i === revealed && pool.length > 0;
        const shown = spinning ? (pool[(spin * 7 + i * 13) % pool.length] as Team) : team;
        return (
          <li key={a.participantId} className={`card flex items-center gap-3 !p-3 ${isRevealed ? "animate-pop border-neon/40 shadow-glow-neon" : ""} ${spinning ? "border-volt-light/60 shadow-glow" : ""} ${i > revealed ? "opacity-30" : ""}`}>
            <span className="w-6 text-center font-display text-sm text-white/50">{i + 1}</span>
            <Avatar name={p.display_name} color={p.avatar_color} size={38} />
            <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname || p.display_name}</span>
            {i <= revealed ? (
              <span className={`flex items-center gap-2 ${spinning ? "blur-[1px]" : ""}`}>
                <span className="text-right"><span className="block text-sm font-bold">{isRevealed ? team.name : "…"}</span>{isRevealed ? <span className="flex justify-end"><Stars value={teamStars(team)} /></span> : null}</span>
                <TeamCrest team={shown} size={44} stars={false} />
              </span>
            ) : <span className="text-white/30">?</span>}
          </li>
        );
      })}
    </ol>
  );
}
