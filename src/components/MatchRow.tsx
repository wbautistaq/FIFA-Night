"use client";

import Link from "next/link";
import clsx from "clsx";
import { Hourglass, Warning } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/primitives";
import { TeamCrest } from "@/components/TeamCrest";
import { useT } from "@/components/TournamentShell";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { Match } from "@/lib/types";

/**
 * Jugador con su equipo. `lead="team"` (partidos, tablas): escudo con estrellas y avatar pequeño junto al nombre.
 * `lead="player"` (listas de jugadores): avatar grande y escudo con estrellas a la derecha.
 */
export function PlayerChip({ participantId, align = "left", lead = "team" }: { participantId: string | null; align?: "left" | "right"; lead?: "team" | "player" }) {
  const { derived } = useT();
  const p = participantId ? derived.participants.get(participantId) : undefined;
  const team = derived.teamOf(participantId);
  if (!p) return <div className={clsx("min-w-0 flex-1 text-sm text-white/40", align === "right" && "text-right")}>Por definir</div>;
  const name = p.nickname || p.display_name;
  if (lead === "player") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{name}</p>
          {team ? <p className="truncate text-[11px] uppercase tracking-wide text-white/60">{team.name}</p> : <p className="text-[11px] uppercase tracking-wide text-white/40">Sin equipo aún</p>}
        </div>
        {team ? <TeamCrest team={team} size={34} /> : null}
      </div>
    );
  }
  return (
    <div className={clsx("flex min-w-0 flex-1 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      {team ? <TeamCrest team={team} size={34} /> : <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={34} />}
      <div className="min-w-0">
        <p className={clsx("flex items-center gap-1.5 text-sm font-bold", align === "right" && "flex-row-reverse")}>
          {team ? <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={18} /> : null}
          <span className="truncate">{name}</span>
        </p>
        {team ? <p className="truncate text-[11px] uppercase tracking-wide text-white/60">{team.name}</p> : null}
      </div>
    </div>
  );
}

export function scoreText(r: { home_score: number; away_score: number; home_pens: number | null; away_pens: number | null } | undefined) {
  if (!r) return null;
  return { main: `${r.home_score} - ${r.away_score}`, pens: r.home_pens !== null ? `(${r.home_pens}-${r.away_pens} pen.)` : null };
}

export function MatchRow({ match, linkTo = true }: { match: Match; linkTo?: boolean }) {
  const { derived, id } = useT();
  const result = derived.resultOf.get(match.id);
  const confirmed = result?.status === "confirmed" ? result : undefined;
  const sc = scoreText(confirmed);
  const linked = linkTo && match.home_id && match.away_id;
  const content = (
    <div className={clsx("card flex items-center gap-2 !p-3", linked && "card-interactive", match.status === "live" && "border-blaze/60 shadow-[0_0_24px_-6px_rgb(var(--live)/.6)]", match.status === "cancelled" && "opacity-50")}>
      <PlayerChip participantId={match.home_id} />
      <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center">
        {sc ? (
          <>
            <p className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-display text-xl tabular-nums tracking-wider">{sc.main.replace(" - ", "–")}</p>
            {sc.pens ? <p className="mt-0.5 text-[11px] text-white/65">{sc.pens}</p> : null}
          </>
        ) : result?.status === "reported" ? (
          <p className="flex flex-col items-center text-[11px] font-semibold uppercase leading-tight text-amber-300"><Hourglass size={16} weight="duotone" aria-hidden />Por confirmar<span className="font-display text-sm normal-case tabular-nums">{result.home_score}-{result.away_score}</span></p>
        ) : result?.status === "disputed" ? (
          <p className="flex flex-col items-center text-[11px] font-semibold uppercase text-rose-300"><Warning size={16} weight="fill" aria-hidden />Disputado</p>
        ) : match.status === "live" ? (
          <span className="chip-live whitespace-nowrap !px-2 !text-[10px]"><span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-blaze" aria-hidden />En juego</span>
        ) : (
          <p className="font-display text-sm uppercase text-white/45">{match.is_bye ? "Descansa" : match.status === "pending" ? "VS" : MATCH_STATUS_LABEL[match.status]}</p>
        )}
      </div>
      <PlayerChip participantId={match.away_id} align="right" />
    </div>
  );
  return linked ? <Link href={`/t/${id}/partido/${match.id}`} className="block rounded-2xl" aria-label="Abrir partido">{content}</Link> : content;
}
