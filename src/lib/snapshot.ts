import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "./types";

type Row = Record<string, unknown>;

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Quita la columna embebida usada solo para filtrar por torneo (join `!inner`). */
const strip = <T>(list: (T & Record<string, unknown>)[], key: string): T[] => list.map(({ [key]: _omit, ...rest }) => rest as T);

/**
 * Carga todo lo que necesitan las pantallas de un torneo. Funciona con cliente RLS o con service role validado.
 * Todas las consultas salen en paralelo (una sola ronda de red): resultados y reacciones se filtran por torneo con joins.
 */
export async function loadSnapshot(sb: SupabaseClient, tournamentId: string): Promise<Snapshot> {
  const [tournamentRows, matches, participants, teams, assignments, rawResults, standings, stats, achievements, predictions, posts, rawReactions, brackets] = await Promise.all([
    rows<Snapshot["tournament"]>(sb.from("tournaments").select("*").eq("id", tournamentId).limit(1)),
    rows<Snapshot["matches"][number]>(sb.from("matches").select("*").eq("tournament_id", tournamentId).order("round").order("position")),
    rows<Snapshot["participants"][number]>(sb.from("tournament_participants").select("id,tournament_id,user_id,display_name,nickname,avatar_url,avatar_color,platform,gamer_id,role,group_name").eq("tournament_id", tournamentId).order("joined_at")),
    rows<Snapshot["teams"][number]>(sb.from("fifa_teams").select("*").or(`tournament_id.is.null,tournament_id.eq.${tournamentId}`).order("rating", { ascending: false })),
    rows<Snapshot["assignments"][number]>(sb.from("team_assignments").select("id,participant_id,team_id,confirmed").eq("tournament_id", tournamentId)),
    rows<Snapshot["results"][number] & Record<string, unknown>>(sb.from("match_results").select("*, matches!inner(tournament_id)").eq("matches.tournament_id", tournamentId)),
    rows<Snapshot["standings"][number]>(sb.from("standings").select("*").eq("tournament_id", tournamentId).order("group_name").order("position")),
    rows<Snapshot["stats"][number]>(sb.from("player_stats").select("*").eq("tournament_id", tournamentId)),
    rows<Snapshot["achievements"][number]>(sb.from("achievements").select("id,participant_id,code").eq("tournament_id", tournamentId)),
    rows<Snapshot["predictions"][number]>(sb.from("predictions").select("*").eq("tournament_id", tournamentId)),
    rows<Snapshot["posts"][number]>(sb.from("tournament_posts").select("id,author_participant_id,body,image_url,created_at").eq("tournament_id", tournamentId).order("created_at", { ascending: false }).limit(100)),
    rows<Snapshot["reactions"][number] & Record<string, unknown>>(sb.from("post_reactions").select("post_id,participant_id,reaction, tournament_posts!inner(tournament_id)").eq("tournament_posts.tournament_id", tournamentId)),
    rows<Snapshot["brackets"][number]>(sb.from("brackets").select("kind,rounds,has_third_place").eq("tournament_id", tournamentId)),
  ]);
  const tournament = tournamentRows[0];
  if (!tournament) throw new Error("Torneo no encontrado o sin acceso");

  const results = strip<Snapshot["results"][number]>(rawResults, "matches");
  const postIds = new Set(posts.map((p) => p.id));
  const reactions = strip<Snapshot["reactions"][number]>(rawReactions, "tournament_posts").filter((r) => postIds.has(r.post_id));

  return { tournament, participants, teams, assignments, matches, results, standings, stats, achievements, predictions, posts, reactions, brackets } satisfies Snapshot;
}

export type { Row };
