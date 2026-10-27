"use server";

import { z } from "zod";
import { errorMessage, fail, ok, requireActor, type ActionResult } from "@/lib/actor";

const uuid = z.string().uuid();
const assignmentsSchema = z.array(z.object({ participantId: uuid, teamId: uuid })).min(1);

export async function saveDraw(tournamentId: string, assignments: unknown): Promise<ActionResult> {
  try {
    const list = assignmentsSchema.parse(assignments);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede sortear");
    const { data: t } = await actor.client.from("tournaments").select("draw_confirmed,status").eq("id", tournamentId).single();
    if (t?.draw_confirmed) return fail("El sorteo ya fue confirmado y está bloqueado");
    await actor.client.from("team_assignments").delete().eq("tournament_id", tournamentId);
    const { error } = await actor.client.from("team_assignments").insert(list.map((a) => ({ tournament_id: tournamentId, participant_id: a.participantId, team_id: a.teamId })));
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? "Sorteo inválido" : errorMessage(e));
  }
}

export async function confirmDraw(tournamentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    const { error } = await actor.client.rpc("confirm_draw", { p_tournament: tournamentId });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const teamSchema = z.object({
  name: z.string().trim().min(2).max(60),
  short_name: z.string().trim().min(2).max(4),
  league: z.string().trim().min(1).max(40),
  country: z.string().trim().min(1).max(40),
  rating: z.number().int().min(40).max(99),
  kind: z.enum(["club", "national"]),
});

export async function addTeam(tournamentId: string, input: unknown): Promise<ActionResult> {
  try {
    const t = teamSchema.parse(input);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador edita el banco de equipos");
    const { error } = await actor.client.from("fifa_teams").insert({ ...t, tournament_id: tournamentId, short_name: t.short_name.toUpperCase() });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

/** Banco editable por torneo: los equipos globales se copian al banco del torneo al editarlos. */
export async function setTeamFlag(tournamentId: string, teamId: string, flag: "banned" | "favorite", value: boolean): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador edita el banco de equipos");
    const { data: team } = await actor.client.from("fifa_teams").select("*").eq("id", uuid.parse(teamId)).single();
    if (!team) return fail("Equipo no encontrado");
    if (team.tournament_id === tournamentId) {
      const { error } = await actor.client.from("fifa_teams").update({ [flag]: value }).eq("id", teamId);
      if (error) throw error;
    } else {
      const rest: Record<string, unknown> = { ...team };
      delete rest.id;
      delete rest.created_at;
      const { data: own } = await actor.client.from("fifa_teams").select("id").eq("tournament_id", tournamentId).ilike("name", String(rest.name)).maybeSingle();
      const { error } = own
        ? await actor.client.from("fifa_teams").update({ [flag]: value }).eq("id", own.id)
        : await actor.client.from("fifa_teams").insert({ ...rest, tournament_id: tournamentId, [flag]: value });
      if (error) throw error;
    }
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function removeTeam(tournamentId: string, teamId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador edita el banco de equipos");
    const { error } = await actor.client.from("fifa_teams").delete().eq("id", uuid.parse(teamId)).eq("tournament_id", tournamentId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
