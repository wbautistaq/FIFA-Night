"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { errorMessage, fail, ok, requireActor, requireUser, type ActionResult } from "@/lib/actor";
import { createAdminClient } from "@/lib/supabase/server";
import { tournamentInputSchema, participantInputSchema, type TournamentInput } from "@/lib/schemas";
import { generateFixtures, FixtureError } from "@/lib/engine/fixtures";
import type { Participant, Tournament } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { DEFAULT_DRAW_OPTIONS, DrawError, drawTeams, type TeamLite } from "@/lib/engine/draw";
import { secureRng } from "@/lib/engine/rng";
import { recommendedSwissRounds } from "@/lib/engine/swiss";
import { GAMER_AVATARS, emojiAvatar } from "@/lib/avatars";
import { confirmDraw, saveDraw } from "@/app/actions/draw";

const uuid = z.string().uuid();

export async function createTournament(input: TournamentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = tournamentInputSchema.parse(input);
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ ...parsed, starts_at: new Date(parsed.starts_at).toISOString(), owner_id: user.id })
      .select("id")
      .single();
    if (error) throw error;
    // El organizador entra como participante por defecto
    const { data: profile } = await supabase.from("profiles").select("display_name,nickname,platform,gamer_id,avatar_url").eq("id", user.id).maybeSingle();
    await supabase.from("tournament_participants").insert({
      tournament_id: data.id,
      user_id: user.id,
      display_name: profile?.display_name ?? "Organizador",
      nickname: profile?.nickname ?? null,
      platform: profile?.platform ?? parsed.platform,
      gamer_id: profile?.gamer_id ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: "coorganizer",
      avatar_color: "#3dff7a",
    });
    await supabase.from("invitations").insert({ tournament_id: data.id, created_by: user.id });
    await supabase.from("tournaments").update({ status: "registration" }).eq("id", data.id);
    revalidatePath("/");
    return ok({ id: data.id });
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function updateTournament(id: string, input: TournamentInput): Promise<ActionResult> {
  try {
    const parsed = tournamentInputSchema.parse(input);
    const actor = await requireActor(uuid.parse(id));
    if (!actor.isOrganizer) return fail("Solo el organizador puede editar el torneo");
    const { error } = await actor.client
      .from("tournaments")
      .update({ ...parsed, starts_at: new Date(parsed.starts_at).toISOString() })
      .eq("id", id);
    if (error) throw error;
    revalidatePath(`/t/${id}`);
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error, count } = await supabase.from("tournaments").delete({ count: "exact" }).eq("id", uuid.parse(id));
    if (error) throw error;
    if (!count) return fail("Solo puedes eliminar torneos en borrador");
    revalidatePath("/");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function cancelTournament(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("tournaments").update({ status: "cancelled" }).eq("id", uuid.parse(id));
    if (error) throw error;
    revalidatePath(`/t/${id}`);
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function duplicateTournament(id: string, name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("duplicate_tournament", { p_tournament: uuid.parse(id), p_name: z.string().trim().min(3).max(80).parse(name) });
    if (error) throw error;
    const newId = data as string;
    const { data: me } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("display_name,nickname,platform,gamer_id,avatar_url").eq("id", me.user?.id ?? "").maybeSingle();
    await supabase.from("tournament_participants").insert({ tournament_id: newId, user_id: me.user?.id, display_name: profile?.display_name ?? "Organizador", avatar_url: profile?.avatar_url ?? null, role: "coorganizer", avatar_color: "#3dff7a" });
    await supabase.from("invitations").insert({ tournament_id: newId, created_by: me.user?.id });
    await supabase.from("tournaments").update({ status: "registration" }).eq("id", newId);
    revalidatePath("/");
    return ok({ id: newId });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const COLORS = ["#7c3aed", "#0ea5e9", "#f97316", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#22c55e", "#6366f1", "#f43f5e"];

export async function addParticipant(tournamentId: string, input: unknown): Promise<ActionResult> {
  try {
    const parsed = participantInputSchema.parse(input);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede agregar participantes");
    const { count } = await actor.client.from("tournament_participants").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId);
    const { error } = await actor.client.from("tournament_participants").insert({
      tournament_id: tournamentId,
      display_name: parsed.display_name,
      nickname: parsed.nickname || null,
      platform: parsed.platform,
      gamer_id: parsed.gamer_id || null,
      avatar_color: COLORS[(count ?? 0) % COLORS.length],
    });
    if (error) throw error;
    revalidatePath(`/t/${tournamentId}`);
    return ok();
  } catch (e) {
    if (e instanceof z.ZodError) return fail(e.issues[0]?.message ?? "Datos inválidos");
    const msg = errorMessage(e);
    return fail(/participants_name_uniq|ya existe/i.test(msg) ? "Ya hay un participante con ese nombre" : msg);
  }
}

export async function removeParticipant(tournamentId: string, participantId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede eliminar participantes");
    const { error, count } = await actor.client.from("tournament_participants").delete({ count: "exact" }).eq("id", uuid.parse(participantId)).eq("tournament_id", tournamentId);
    if (error) throw error;
    if (!count) return fail("No se pudo eliminar (¿el torneo ya inició?)");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Reemplaza a un participante por otra persona conservando equipo asignado. */
export async function replaceParticipant(tournamentId: string, participantId: string, input: unknown): Promise<ActionResult> {
  try {
    const parsed = participantInputSchema.parse(input);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede reemplazar participantes");
    const { data: updated, error } = await actor.client.from("tournament_participants").update({
      display_name: parsed.display_name,
      nickname: parsed.nickname || null,
      platform: parsed.platform,
      gamer_id: parsed.gamer_id || null,
      user_id: null,
    }).eq("id", uuid.parse(participantId)).eq("tournament_id", tournamentId).select("id");
    if (error) throw error;
    if (!updated?.length) return fail("Participante no encontrado en este torneo");
    // Nueva llave de invitado: el link del jugador anterior deja de servir
    const { error: te } = await createAdminClient().from("participant_tokens")
      .update({ token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16) })
      .eq("participant_id", participantId);
    if (te) throw te;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function setCoorganizer(tournamentId: string, participantId: string, on: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: t } = await supabase.from("tournaments").select("owner_id").eq("id", uuid.parse(tournamentId)).maybeSingle();
    if (t?.owner_id !== user.id) return fail("Solo el dueño puede nombrar coorganizadores");
    const { error } = await supabase.from("tournament_participants").update({ role: on ? "coorganizer" : "player" }).eq("id", uuid.parse(participantId));
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function startTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede iniciar el torneo");
    const { data: t, error: te } = await actor.client.from("tournaments").select("*").eq("id", tournamentId).single();
    if (te) throw te;
    const tournament = t as Tournament;
    const { data: ps, error: pe } = await actor.client.from("tournament_participants").select("id,display_name,group_name").eq("tournament_id", tournamentId).order("joined_at");
    if (pe) throw pe;
    const participants = (ps ?? []) as Pick<Participant, "id" | "display_name" | "group_name">[];
    if (!tournament.draw_confirmed) return fail("Primero confirma el sorteo de equipos");
    const plan = generateFixtures(tournament.format, participants, tournament.settings);
    for (const [pid, group] of Object.entries(plan.groups)) {
      const { error } = await actor.client.from("tournament_participants").update({ group_name: group }).eq("id", pid);
      if (error) throw error;
    }
    const { error } = await actor.client.rpc("start_tournament", { p_tournament: tournamentId, p_matches: plan.matches, p_brackets: plan.brackets });
    if (error) throw error;
    revalidatePath(`/t/${tournamentId}`);
    return ok();
  } catch (e) {
    return fail(e instanceof FixtureError ? e.message : errorMessage(e));
  }
}

export async function finishTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    const { error } = await actor.client.rpc("finish_tournament", { p_tournament: tournamentId });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function addFriendly(tournamentId: string, homeId: string, awayId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede crear amistosos");
    if (homeId === awayId) return fail("Elige dos jugadores distintos");
    const { count } = await actor.client.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId);
    const { error } = await actor.client.from("matches").insert({ tournament_id: tournamentId, stage: "friendly", round: 1, position: (count ?? 0) + 1, home_id: uuid.parse(homeId), away_id: uuid.parse(awayId) });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const tvViewSchema = z.enum(["auto", "next", "standings", "bracket", "scorers", "results"]);

/** Control remoto del modo TV desde el celular del organizador. */
export async function setTvView(tournamentId: string, view: string): Promise<ActionResult> {
  try {
    const v = tvViewSchema.parse(view);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador controla la TV");
    const { error } = await actor.client.from("tournaments").update({ tv_state: { view: v } }).eq("id", tournamentId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setTournamentStatus(tournamentId: string, status: "draft" | "registration"): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede cambiar el estado");
    const { error } = await actor.client.from("tournaments").update({ status: z.enum(["draft", "registration"]).parse(status) }).eq("id", tournamentId);
    if (error) throw error;
    revalidatePath(`/t/${tournamentId}`);
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const quickSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  players: z.array(z.string().trim().min(1).max(40)).min(1, "Agrega al menos un jugador").max(31),
  includeMe: z.boolean(),
  format: z.enum(["league", "league_double", "cup", "swiss"]),
  minStars: z.number().min(0).max(5),
  teams: z.enum(["clubs", "national", "all"]),
  balanced: z.boolean(),
});
export type QuickTournamentInput = z.infer<typeof quickSchema>;

/**
 * Torneo relámpago: crea el torneo, agrega a los jugadores (invitados con avatar gamer al azar),
 * sortea equipos del banco FC 26, confirma el sorteo, genera el calendario y lo inicia.
 */
export async function quickTournament(input: QuickTournamentInput): Promise<ActionResult<{ id: string }>> {
  let createdId: string | null = null;
  try {
    const q = quickSchema.parse(input);
    const names = [...new Map(q.players.map((n) => [n.toLowerCase(), n])).values()];
    const total = names.length + (q.includeMe ? 1 : 0);
    if (total < 4) return fail("Se necesitan al menos 4 jugadores (contándote a ti si juegas)");
    if (total > 32) return fail("Máximo 32 jugadores");
    const { supabase, user } = await requireUser();

    const created = await createTournament({
      name: q.name || `Noche FIFA ${new Date().toLocaleDateString("es", { day: "numeric", month: "short" })}`,
      starts_at: new Date().toISOString(),
      platform: "presencial",
      format: q.format,
      max_players: Math.max(4, total),
      rules: "",
      settings: q.format === "swiss" ? { ...DEFAULT_SETTINGS, swiss_rounds: recommendedSwissRounds(total) } : DEFAULT_SETTINGS,
    });
    if (!created.ok || !created.data) return fail(created.ok ? "No se pudo crear el torneo" : created.error);
    const id = created.data.id;
    createdId = id;

    if (!q.includeMe) {
      const { error } = await supabase.from("tournament_participants").delete().eq("tournament_id", id).eq("user_id", user.id);
      if (error) throw error;
    }
    const { error: pe } = await supabase.from("tournament_participants").insert(
      names.map((display_name, i) => ({
        tournament_id: id,
        display_name,
        avatar_color: COLORS[(i + 1) % COLORS.length],
        avatar_url: emojiAvatar(GAMER_AVATARS[Math.floor(secureRng() * GAMER_AVATARS.length)]!.emoji),
      })),
    );
    if (pe) throw pe;

    const [{ data: teams, error: te }, { data: ps, error: pse }] = await Promise.all([
      supabase.from("fifa_teams").select("id,name,league,country,rating,kind,banned,favorite").is("tournament_id", null),
      supabase.from("tournament_participants").select("id").eq("tournament_id", id),
    ]);
    if (te) throw te;
    if (pse) throw pse;
    const plan = drawTeams((ps ?? []).map((p) => p.id as string), (teams ?? []) as TeamLite[], {
      ...DEFAULT_DRAW_OPTIONS,
      allowClubs: q.teams !== "national",
      allowNational: q.teams !== "clubs",
      minRating: q.minStars > 0 ? Math.round(66 + q.minStars * 4) : undefined,
      balanced: q.balanced,
    }, secureRng);

    for (const step of [() => saveDraw(id, plan), () => confirmDraw(id), () => startTournament(id)]) {
      const r = await step();
      if (!r.ok) return fail(`El torneo se creó pero no se pudo completar: ${r.error}`);
    }
    revalidatePath("/");
    return ok({ id });
  } catch (e) {
    if (e instanceof z.ZodError) return fail(e.issues[0]?.message ?? "Datos inválidos");
    const msg = e instanceof DrawError ? e.message : errorMessage(e);
    return fail(createdId ? `El torneo se creó pero no se pudo completar: ${msg}` : msg);
  }
}
