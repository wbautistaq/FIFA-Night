"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { errorMessage, fail, ok, requireActor, type ActionResult } from "@/lib/actor";
import { createAdminClient } from "@/lib/supabase/server";
import { pairKey, rankSwiss, swissPairings } from "@/lib/engine/swiss";

const uuid = z.string().uuid();
const MAX_PROOF_BYTES = 2 * 1024 * 1024;
const PROOF_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function matchContext(matchId: string) {
  const { data } = await createAdminClient().from("matches").select("id,tournament_id,home_id,away_id,status").eq("id", uuid.parse(matchId)).maybeSingle();
  if (!data) throw new Error("Partido no encontrado");
  return data as { id: string; tournament_id: string; home_id: string | null; away_id: string | null; status: string };
}

/**
 * Foto del marcador como prueba del resultado. La pueden subir los dos jugadores del partido o la organización,
 * también invitados sin cuenta: por eso la escritura va con el cliente de servicio tras validar al actor.
 */
export async function uploadResultProof(matchId: string, form: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const match = await matchContext(matchId);
    const actor = await requireActor(match.tournament_id);
    const isPlayer = actor.participantId !== null && [match.home_id, match.away_id].includes(actor.participantId);
    if (!actor.isOrganizer && !isPlayer) return fail("Solo los jugadores del partido o la organización pueden subir la foto");

    const file = form.get("file");
    if (!(file instanceof File)) return fail("Elige una foto");
    const ext = PROOF_TYPES[file.type];
    if (!ext) return fail("La foto debe ser JPG, PNG o WebP");
    if (file.size > MAX_PROOF_BYTES) return fail("La foto pesa más de 2 MB");

    const admin = createAdminClient();
    const path = `proofs/${match.tournament_id}/${match.id}-${Date.now()}.${ext}`;
    const up = await admin.storage.from("fifa-night").upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const url = admin.storage.from("fifa-night").getPublicUrl(path).data.publicUrl;
    const { error } = await admin.from("match_proofs").upsert({ match_id: match.id, tournament_id: match.tournament_id, url, uploaded_by: actor.participantId, created_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath(`/t/${match.tournament_id}`);
    return ok({ url });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Voto MVP de un partido terminado: cualquier participante del torneo vota a uno de los dos jugadores (no a sí mismo). */
export async function voteMvp(matchId: string, candidateId: string | null): Promise<ActionResult> {
  try {
    const match = await matchContext(matchId);
    const actor = await requireActor(match.tournament_id);
    if (!actor.participantId) return fail("Solo los participantes del torneo pueden votar");
    if (match.status !== "finished") return fail("Se vota cuando el partido ha terminado");
    const admin = createAdminClient();
    if (candidateId === null) {
      const { error } = await admin.from("mvp_votes").delete().eq("match_id", match.id).eq("voter_participant_id", actor.participantId);
      if (error) throw error;
      return ok();
    }
    const candidate = uuid.parse(candidateId);
    if (![match.home_id, match.away_id].includes(candidate)) return fail("Solo puedes votar a uno de los dos jugadores del partido");
    if (candidate === actor.participantId) return fail("No puedes votarte a ti mismo");
    const { error } = await admin.from("mvp_votes").upsert({ match_id: match.id, tournament_id: match.tournament_id, voter_participant_id: actor.participantId, candidate_participant_id: candidate, created_at: new Date().toISOString() });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Sistema suizo: empareja la siguiente ronda según la clasificación, sin repetir rivales. */
export async function nextSwissRound(tournamentId: string): Promise<ActionResult<{ round: number }>> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo la organización genera las rondas");
    const [{ data: ps, error: pe }, { data: st, error: se }, { data: ms, error: me }] = await Promise.all([
      actor.client.from("tournament_participants").select("id").eq("tournament_id", tournamentId).order("joined_at"),
      actor.client.from("standings").select("participant_id,points,goal_difference,goals_for,position").eq("tournament_id", tournamentId),
      actor.client.from("matches").select("round,home_id,away_id").eq("tournament_id", tournamentId),
    ]);
    if (pe) throw pe;
    if (se) throw se;
    if (me) throw me;
    const stand = new Map((st ?? []).map((s) => [s.participant_id as string, s]));
    const players = rankSwiss((ps ?? []).map((p) => {
      const s = stand.get(p.id as string);
      return { id: p.id as string, points: s?.points ?? 0, goalDifference: s?.goal_difference ?? 0, goalsFor: s?.goals_for ?? 0 };
    }));
    const played = new Set<string>();
    const playedIn = new Map<number, Set<string>>();
    for (const m of ms ?? []) {
      if (!m.home_id || !m.away_id) continue;
      played.add(pairKey(m.home_id, m.away_id));
      const set = playedIn.get(m.round) ?? new Set<string>();
      set.add(m.home_id).add(m.away_id);
      playedIn.set(m.round, set);
    }
    // Quien no jugó en alguna ronda ya tuvo su descanso
    const hadBye = new Set(players.filter((p) => [...playedIn.values()].some((set) => !set.has(p.id))).map((p) => p.id));
    const { pairs } = swissPairings(players, played, hadBye);
    const { data, error } = await actor.client.rpc("add_swiss_round", {
      p_tournament: tournamentId,
      p_matches: pairs.map(([home_id, away_id]) => ({ id: crypto.randomUUID(), home_id, away_id })),
    });
    if (error) throw error;
    revalidatePath(`/t/${tournamentId}`);
    return ok({ round: data as number });
  } catch (e) {
    return fail(errorMessage(e));
  }
}
