"use server";

import { z } from "zod";
import { errorMessage, fail, ok, requireActor, type ActionResult } from "@/lib/actor";
import { resultInputSchema } from "@/lib/schemas";

const uuid = z.string().uuid();
type ResultInput = z.input<typeof resultInputSchema>;

async function loadMatch(client: Awaited<ReturnType<typeof requireActor>>["client"], matchId: string) {
  const { data } = await client.from("matches").select("id,tournament_id,stage,home_id,away_id,status").eq("id", matchId).maybeSingle();
  return data as { id: string; tournament_id: string; stage: string; home_id: string | null; away_id: string | null; status: string } | null;
}

async function tournamentIdOfMatch(matchId: string): Promise<string> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("matches").select("tournament_id").eq("id", matchId).maybeSingle();
  if (!data) throw new Error("Partido no encontrado");
  return data.tournament_id as string;
}

/** Organizador/coorganizador: registra o corrige el resultado oficial (queda confirmado). */
export async function saveOfficialResult(input: ResultInput, confirmCorrection = false): Promise<ActionResult> {
  try {
    const r = resultInputSchema.parse(input);
    const actor = await requireActor(await tournamentIdOfMatch(r.match_id));
    if (!actor.isOrganizer) return fail("Solo el organizador puede registrar resultados oficiales");
    const match = await loadMatch(actor.client, r.match_id);
    if (!match) return fail("Partido no encontrado");
    const { data: existing } = await actor.client.from("match_results").select("id,status").eq("match_id", r.match_id).maybeSingle();
    if (existing?.status === "confirmed" && !confirmCorrection) {
      return fail("Este resultado ya está finalizado. Confirma explícitamente la corrección para modificarlo.");
    }
    if (r.mvp_id !== undefined) {
      const { error } = await actor.client.from("matches").update({ mvp_id: r.mvp_id }).eq("id", r.match_id);
      if (error) throw error;
    }
    const payload = {
      home_score: r.home_score,
      away_score: r.away_score,
      home_pens: r.home_pens,
      away_pens: r.away_pens,
      comeback_by: r.comeback_by ?? null,
      status: "confirmed" as const,
      reported_by_organizer: true,
      played_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await actor.client.from("match_results").update(payload).eq("id", existing.id)
      : await actor.client.from("match_results").insert({ ...payload, match_id: r.match_id });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

/** Jugador: reporta el resultado de su propio partido (si el organizador lo habilitó). */
export async function reportResult(input: ResultInput): Promise<ActionResult> {
  try {
    const r = resultInputSchema.parse(input);
    const actor = await requireActor(await tournamentIdOfMatch(r.match_id));
    const match = await loadMatch(actor.client, r.match_id);
    if (!match) return fail("Partido no encontrado");
    if (!actor.participantId || ![match.home_id, match.away_id].includes(actor.participantId)) return fail("Solo puedes reportar tus propios partidos");
    const { data: t } = await actor.client.from("tournaments").select("settings,status").eq("id", match.tournament_id).single();
    if (!(t?.settings as { player_reporting?: boolean } | undefined)?.player_reporting) return fail("El organizador no habilitó el reporte por jugadores");
    if (t?.status !== "in_progress") return fail("El torneo no está en curso");
    const { data: existing } = await actor.client.from("match_results").select("id,status").eq("match_id", r.match_id).maybeSingle();
    if (existing) return fail(existing.status === "confirmed" ? "El resultado ya está confirmado" : "Ya hay un resultado reportado para este partido");
    const { error } = await actor.client.from("match_results").insert({
      match_id: r.match_id,
      home_score: r.home_score,
      away_score: r.away_score,
      home_pens: r.home_pens,
      away_pens: r.away_pens,
      comeback_by: r.comeback_by ?? null,
      status: "reported",
      reported_by: actor.participantId,
      reported_by_organizer: false,
    });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

/** El rival confirma o disputa lo reportado. */
export async function answerReport(matchId: string, decision: "confirmed" | "disputed"): Promise<ActionResult> {
  try {
    const actor = await requireActor(await tournamentIdOfMatch(uuid.parse(matchId)));
    const match = await loadMatch(actor.client, matchId);
    if (!match) return fail("Partido no encontrado");
    if (!actor.participantId || ![match.home_id, match.away_id].includes(actor.participantId)) return fail("Solo los jugadores del partido pueden responder");
    const { data: res } = await actor.client.from("match_results").select("id,status,reported_by").eq("match_id", matchId).maybeSingle();
    if (!res || res.status !== "reported") return fail("No hay un resultado pendiente de confirmación");
    if (res.reported_by === actor.participantId) return fail("Tu rival debe confirmar el resultado que reportaste");
    const { error } = await actor.client.from("match_results").update({ status: decision, confirmed_by: decision === "confirmed" ? actor.participantId : null }).eq("id", res.id);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Organizador: elimina un resultado (reabre el partido) — p. ej. para resolver disputas. */
export async function clearResult(matchId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(await tournamentIdOfMatch(uuid.parse(matchId)));
    if (!actor.isOrganizer) return fail("Solo el organizador puede anular resultados");
    const { error } = await actor.client.from("match_results").delete().eq("match_id", matchId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function startMatch(matchId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(await tournamentIdOfMatch(uuid.parse(matchId)));
    const { error } = await actor.client.rpc("set_match_live", { p_match: matchId });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function scheduleMatch(matchId: string, iso: string | null): Promise<ActionResult> {
  try {
    const actor = await requireActor(await tournamentIdOfMatch(uuid.parse(matchId)));
    if (!actor.isOrganizer) return fail("Solo el organizador agenda partidos");
    const { error } = await actor.client.from("matches").update({ scheduled_at: iso ? new Date(iso).toISOString() : null }).eq("id", matchId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
