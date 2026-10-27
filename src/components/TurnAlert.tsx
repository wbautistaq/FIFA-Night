"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GameController } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import type { Match, Participant, Team } from "@/lib/types";

const FRESH_MS = 20 * 60000;
const ackKey = (matchId: string) => `fn_turn_ack_${matchId}`;
const acked = (matchId: string) => { try { return localStorage.getItem(ackKey(matchId)) === "1"; } catch { return false; } };

function Side({ p, label, team }: { p: Participant | undefined; label: string; team: Team | undefined }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {p ? <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={56} /> : <span className="block h-14 w-14 rounded-full bg-white/10" />}
        {team ? <span className="absolute -bottom-2 -right-2"><TeamCrest team={team} size={28} stars={false} /></span> : null}
      </div>
      <span className="mt-1 max-w-24 truncate text-sm font-bold">{label}</span>
    </div>
  );
}

/**
 * Aviso a pantalla completa cuando el organizador llama al jugador a una consola.
 * Aparece en cualquier pantalla del torneo hasta que el jugador toca "¡Voy!".
 */
export function TurnAlert({ tournamentId, participantId, matches, participants, teamOf }: {
  tournamentId: string;
  participantId: string | null;
  matches: Match[];
  participants: Map<string, Participant>;
  teamOf: (id: string | null) => Team | undefined;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const call = participantId
    ? matches.find((m) => m.status === "pending" && m.station && m.called_at && Date.now() - Date.parse(m.called_at) < FRESH_MS && (m.home_id === participantId || m.away_id === participantId))
    : undefined;
  const show = call && call.id !== dismissed && !acked(call.id);

  useEffect(() => {
    if (show) navigator.vibrate?.([300, 120, 300, 120, 600]);
  }, [show]);

  if (!show || !call) return null;
  const rivalId = call.home_id === participantId ? call.away_id : call.home_id;
  const rival = rivalId ? participants.get(rivalId) : undefined;
  const me = participantId ? participants.get(participantId) : undefined;
  const ack = () => { try { localStorage.setItem(ackKey(call.id), "1"); } catch { /* sin almacenamiento: solo se cierra */ } setDismissed(call.id); };

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="turn-h" className="fixed inset-0 z-[60] grid place-items-center bg-pitch-900/90 p-6 backdrop-blur-md">
      <div className="card-glow w-full max-w-sm animate-pop space-y-5 text-center">
        <GameController size={48} weight="duotone" className="mx-auto animate-pulseGlow text-neon" aria-hidden />
        <div>
          <h2 id="turn-h" className="font-display text-4xl uppercase text-white">¡Te toca!</h2>
          <p className="mt-1 font-display text-2xl uppercase text-neon">Consola {call.station}</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <Side p={me} label="Tú" team={teamOf(participantId)} />
          <span className="font-display text-lg text-white/50">VS</span>
          <Side p={rival} label={rival ? rival.nickname || rival.display_name : "Rival"} team={teamOf(rivalId)} />
        </div>
        <div className="grid gap-2">
          <button className="btn-primary w-full !min-h-14 text-lg" onClick={ack} autoFocus>¡Voy!</button>
          <Link href={`/t/${tournamentId}/en-vivo`} className="btn-ghost w-full" onClick={ack}>Ver la noche en vivo</Link>
        </div>
      </div>
    </div>
  );
}
