"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { playerName } from "@/lib/names";
import { effectiveTeams } from "@/lib/teams";
import type { AppNotification, Snapshot, Viewer } from "@/lib/types";

interface Payload {
  snapshot: Snapshot;
  viewer: Viewer;
  notifications: AppNotification[];
}

export function useTournament(id: string) {
  const qc = useQueryClient();
  const query = useQuery<Payload>({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const res = await fetch(`/api/t/${id}/snapshot`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "No se pudo cargar el torneo");
      return body as Payload;
    },
    // Los invitados no tienen sesión Supabase: reciben actualizaciones por sondeo.
    refetchInterval: (q) => (q.state.data?.viewer.kind === "guest" ? 5000 : 30000),
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const kind = query.data?.viewer.kind;
  useEffect(() => {
    if (kind !== "user") return;
    const sb = createClient();
    // Un solo resultado dispara decenas de cambios (tabla, estadísticas, notificaciones…): se agrupan en una recarga.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: ["tournament", id] }), 400);
    };
    const channel = sb.channel(`tournament-${id}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, refresh);
    for (const table of ["matches", "standings", "tournament_posts", "tournament_participants", "team_assignments", "player_stats", "predictions", "notifications", "match_proofs", "mvp_votes"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `tournament_id=eq.${id}` }, refresh);
    }
    // Sin columna tournament_id: RLS limita los eventos a torneos donde participa el usuario
    for (const table of ["match_results", "post_reactions"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [kind, id, qc]);

  // Dentro del torneo cada jugador se muestra siempre igual: con su apodo si lo tiene
  const data = useMemo(() => {
    const raw = query.data;
    if (!raw) return undefined;
    return { ...raw, snapshot: { ...raw.snapshot, participants: raw.snapshot.participants.map((p) => ({ ...p, display_name: playerName(p) })) } };
  }, [query.data]);
  const derived = useMemo(() => {
    if (!data) return null;
    const { snapshot } = data;
    const participants = new Map(snapshot.participants.map((p) => [p.id, p]));
    const teams = effectiveTeams(snapshot.teams, id);
    const teamById = new Map(snapshot.teams.map((t) => [t.id, t]));
    const teamOf = (participantId: string | null) => {
      const a = snapshot.assignments.find((x) => x.participant_id === participantId);
      return a ? teamById.get(a.team_id) : undefined;
    };
    const resultOf = new Map(snapshot.results.map((r) => [r.match_id, r]));
    return { participants, teams, teamOf, resultOf };
  }, [data, id]);

  return { ...query, snapshot: data?.snapshot, viewer: data?.viewer, notifications: data?.notifications ?? [], derived, refresh: () => qc.invalidateQueries({ queryKey: ["tournament", id] }) };
}
