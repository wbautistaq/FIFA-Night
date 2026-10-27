"use server";

import { z } from "zod";
import { errorMessage, fail, ok, requireActor, type ActionResult } from "@/lib/actor";
import { pushToParticipants } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

async function matchInfo(matchId: string) {
  const { data } = await createAdminClient().from("matches").select("id,tournament_id,home_id,away_id").eq("id", matchId).maybeSingle();
  if (!data) throw new Error("Partido no encontrado");
  return data as { id: string; tournament_id: string; home_id: string | null; away_id: string | null };
}

/** Organizador: cuántas consolas/TVs hay esta noche (1–8). */
export async function setStations(tournamentId: string, count: number): Promise<ActionResult> {
  try {
    const id = uuid.parse(tournamentId);
    const n = z.number().int().min(1).max(8).parse(count);
    const actor = await requireActor(id);
    if (!actor.isOrganizer) return fail("Solo el organizador configura las consolas");
    const { error } = await actor.client.from("tournaments").update({ stations: n }).eq("id", id);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Organizador: llama un partido a una consola y avisa a los dos jugadores (en la app y en el celular). */
export async function callMatch(matchId: string, station: number): Promise<ActionResult> {
  try {
    const m = await matchInfo(uuid.parse(matchId));
    const s = z.number().int().min(1).max(8).parse(station);
    const actor = await requireActor(m.tournament_id);
    if (!actor.isOrganizer) return fail("Solo el organizador llama a jugar");
    const { error } = await actor.client.rpc("call_match", { p_match: m.id, p_station: s });
    if (error) throw error;
    const ids = [m.home_id, m.away_id].filter((x): x is string => Boolean(x));
    await pushToParticipants(ids, { title: "¡Te toca jugar!", body: `Ve a la consola ${s}`, url: `/t/${m.tournament_id}/en-vivo`, tag: `turn-${m.id}` });
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Organizador: devuelve a la cola un partido llamado que aún no empezó. */
export async function uncallMatch(matchId: string): Promise<ActionResult> {
  try {
    const m = await matchInfo(uuid.parse(matchId));
    const actor = await requireActor(m.tournament_id);
    if (!actor.isOrganizer) return fail("Solo el organizador gestiona las consolas");
    const { error } = await actor.client.rpc("uncall_match", { p_match: m.id });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Guarda la suscripción push de este celular, ligada a la cuenta o al acceso de invitado. */
export async function savePushSubscription(tournamentId: string, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    const sub = subscriptionSchema.parse(raw);
    if (!actor.userId && !actor.participantId) return fail("Únete al torneo para recibir avisos");
    const row = actor.kind === "user" && actor.userId
      ? { user_id: actor.userId, participant_id: null }
      : { user_id: null, participant_id: actor.participantId };
    const { error } = await createAdminClient().from("push_subscriptions")
      .upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, ...row }, { onConflict: "endpoint" });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? "Suscripción inválida" : errorMessage(e));
  }
}

/** Prueba de aviso para el propio usuario (confirma que el celular lo recibe). */
export async function testPush(tournamentId: string): Promise<ActionResult<{ sent: number }>> {
  try {
    const id = uuid.parse(tournamentId);
    const actor = await requireActor(id);
    let pid = actor.participantId;
    if (!pid && actor.userId) {
      const { data } = await createAdminClient().from("tournament_participants").select("id").eq("tournament_id", id).eq("user_id", actor.userId).maybeSingle();
      pid = (data?.id as string | undefined) ?? null;
    }
    if (!pid) return fail("No juegas en este torneo");
    const sent = await pushToParticipants([pid], { title: "Avisos activados", body: "Así te avisaremos cuando te toque jugar", url: `/t/${id}/en-vivo`, tag: "test" });
    return ok({ sent });
  } catch (e) {
    return fail(errorMessage(e));
  }
}
