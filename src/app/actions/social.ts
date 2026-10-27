"use server";

import { z } from "zod";
import { errorMessage, fail, ok, requireActor, requireUser, type ActionResult } from "@/lib/actor";
import { postInputSchema, profileInputSchema, reactionSchema } from "@/lib/schemas";
import { safeImageUrl, sanitizeText } from "@/lib/sanitize";
import { publicEnv } from "@/lib/env";
import { isValidEmojiAvatar } from "@/lib/avatars";

const uuid = z.string().uuid();

export async function createPost(tournamentId: string, input: unknown, imageUrl?: string | null): Promise<ActionResult> {
  try {
    const parsed = postInputSchema.parse(input);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.participantId) return fail("Solo los participantes pueden publicar");
    const { data: t } = await actor.client.from("tournaments").select("settings").eq("id", tournamentId).single();
    if ((t?.settings as { wall?: boolean } | undefined)?.wall === false) return fail("El muro está desactivado en este torneo");
    const body = sanitizeText(parsed.body);
    if (!body) return fail("Escribe algo");
    const { error } = await actor.client.from("tournament_posts").insert({
      tournament_id: tournamentId,
      author_participant_id: actor.participantId,
      body,
      image_url: safeImageUrl(imageUrl, publicEnv().NEXT_PUBLIC_SUPABASE_URL),
    });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function deletePost(tournamentId: string, postId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    const { data: post } = await actor.client.from("tournament_posts").select("author_participant_id").eq("id", uuid.parse(postId)).eq("tournament_id", tournamentId).maybeSingle();
    if (!post) return fail("Publicación no encontrada");
    if (!actor.isOrganizer && post.author_participant_id !== actor.participantId) return fail("No puedes borrar esta publicación");
    const { error } = await actor.client.from("tournament_posts").delete().eq("id", postId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function toggleReaction(tournamentId: string, postId: string, reaction: string): Promise<ActionResult> {
  try {
    const r = reactionSchema.parse(reaction);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.participantId) return fail("Solo los participantes pueden reaccionar");
    const key = { post_id: uuid.parse(postId), participant_id: actor.participantId, reaction: r };
    const { data: ex } = await actor.client.from("post_reactions").select("post_id").match(key).maybeSingle();
    const { error } = ex ? await actor.client.from("post_reactions").delete().match(key) : await actor.client.from("post_reactions").insert(key);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const predictionSchema = z.object({
  match_id: uuid,
  predicted_winner_id: uuid.nullable(),
  home_score: z.number().int().min(0).max(99).nullable(),
  away_score: z.number().int().min(0).max(99).nullable(),
});

export async function savePrediction(tournamentId: string, input: unknown): Promise<ActionResult> {
  try {
    const p = predictionSchema.parse(input);
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.participantId) return fail("Solo los participantes pueden predecir");
    const { data: t } = await actor.client.from("tournaments").select("settings").eq("id", tournamentId).single();
    if (!(t?.settings as { predictions?: boolean } | undefined)?.predictions) return fail("Las predicciones están desactivadas");
    const { data: m } = await actor.client.from("matches").select("home_id,away_id,status,tournament_id").eq("id", p.match_id).single();
    if (!m || m.tournament_id !== tournamentId || m.status !== "pending" || !m.home_id || !m.away_id) return fail("Este partido ya no admite predicciones");
    if ([m.home_id, m.away_id].includes(actor.participantId)) return fail("No puedes predecir tus propios partidos");
    if (p.predicted_winner_id && ![m.home_id, m.away_id].includes(p.predicted_winner_id)) return fail("Ganador inválido");
    const row = { tournament_id: tournamentId, participant_id: actor.participantId, ...p };
    const { error } = await actor.client.from("predictions").upsert(row, { onConflict: "match_id,participant_id" });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  try {
    const p = profileInputSchema.parse(input);
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("profiles").update({ display_name: p.display_name, nickname: p.nickname || null, platform: p.platform, gamer_id: p.gamer_id || null }).eq("id", user.id);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

export async function markNotificationsRead(tournamentId: string, ids?: string[]): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    let q = actor.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("tournament_id", tournamentId).is("read_at", null);
    // Usuarios: sus notificaciones (RLS); invitados: las de su participante (cliente de servicio ya validado por token)
    if (actor.kind === "user" && actor.userId) q = q.eq("user_id", actor.userId);
    else if (actor.participantId) q = q.eq("participant_id", actor.participantId);
    else return ok();
    if (ids?.length) q = q.in("id", z.array(uuid).parse(ids));
    const { error } = await q;
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Valida un avatar: emoticono de la lista o foto propia en Storage (solo usuarios con cuenta, en su carpeta). */
function cleanAvatar(value: string | null, userId: string | null): string | null | undefined {
  if (value === null) return null;
  if (isValidEmojiAvatar(value)) return value;
  if (!userId) return undefined;
  const safe = safeImageUrl(value, publicEnv().NEXT_PUBLIC_SUPABASE_URL);
  return safe && safe.includes(`/${userId}/`) ? safe : undefined;
}

/** Cambia el avatar del perfil y lo copia a los torneos donde participa el usuario. */
export async function updateAvatar(value: string | null): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const avatar = cleanAvatar(value, user.id);
    if (avatar === undefined) return fail("Imagen inválida");
    const { error } = await supabase.from("profiles").update({ avatar_url: avatar }).eq("id", user.id);
    if (error) throw error;
    await supabase.from("tournament_participants").update({ avatar_url: avatar }).eq("user_id", user.id);
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Avatar del participante actual en un torneo (también para invitados sin cuenta, solo emoticonos). */
export async function setParticipantAvatar(tournamentId: string, value: string | null): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.participantId) return fail("No participas en este torneo");
    const avatar = cleanAvatar(value, actor.kind === "user" ? actor.userId : null);
    if (avatar === undefined) return fail(actor.kind === "guest" ? "Elige uno de los emoticonos" : "Imagen inválida");
    const { error } = await actor.client.from("tournament_participants").update({ avatar_url: avatar }).eq("id", actor.participantId);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
