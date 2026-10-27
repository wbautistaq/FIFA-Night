"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, fail, guestCookieName, ok, participantForGuestToken, requireActor, requireUser, type ActionResult } from "@/lib/actor";
import { nicknameSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export interface PlayerOption {
  userId: string;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Torneos compartidos (solo en "mis jugadores"). */
  shared?: number;
}

type Row = { user_id: string; nickname: string | null; display_name: string; avatar_url: string | null; shared?: number };
const toOption = (r: Row): PlayerOption => ({ userId: r.user_id, nickname: r.nickname, displayName: r.display_name, avatarUrl: r.avatar_url, shared: r.shared });

/** Personas con cuenta con las que ya jugué. */
export async function myPlayers(): Promise<ActionResult<PlayerOption[]>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("my_players");
    if (error) throw error;
    return ok(((data ?? []) as Row[]).map(toOption));
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Busca por apodo (mínimo 3 letras, máximo 5 resultados). */
export async function findPlayers(query: string): Promise<ActionResult<PlayerOption[]>> {
  try {
    const q = z.string().trim().min(3).max(30).parse(query);
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("find_players", { p_query: q });
    if (error) throw error;
    return ok(((data ?? []) as Row[]).map(toOption));
  } catch (e) {
    return fail(e instanceof z.ZodError ? "Escribe al menos 3 letras del apodo" : errorMessage(e));
  }
}

/** Organizador: agrega jugadores con cuenta al torneo (entran directo y reciben aviso). */
export async function addPlayers(tournamentId: string, userIds: string[]): Promise<ActionResult<{ added: number }>> {
  try {
    const id = uuid.parse(tournamentId);
    const ids = z.array(uuid).min(1).max(32).parse(userIds);
    const actor = await requireActor(id);
    if (!actor.isOrganizer) return fail("Solo el organizador agrega jugadores");
    const { data, error } = await actor.client.rpc("add_players", { p_tournament: id, p_users: ids });
    if (error) throw error;
    revalidatePath(`/t/${id}`);
    return ok({ added: (data as number) ?? 0 });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ¿Está libre este apodo? Devuelve el mensaje de error si no sirve. */
export async function checkNickname(nickname: string): Promise<ActionResult<{ available: boolean }>> {
  try {
    const n = nicknameSchema.parse(nickname);
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("nickname_available", { p_nickname: n });
    if (error) throw error;
    return ok({ available: Boolean(data) });
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Apodo inválido") : errorMessage(e));
  }
}

/**
 * Quien jugó como invitado y luego entró con su cuenta: pasa ese participante a su cuenta,
 * con todos sus partidos. Solo con la cookie del invitado en este navegador (prueba de que es él).
 */
export async function claimGuestProfile(tournamentId: string): Promise<ActionResult> {
  try {
    const id = uuid.parse(tournamentId);
    const { user } = await requireUser();
    const store = await cookies();
    const token = store.get(guestCookieName(id))?.value;
    if (!token || !/^[a-f0-9]{48}$/.test(token)) return fail("Este navegador no tiene un acceso de invitado a este torneo");
    const admin = createAdminClient();
    const participantId = await participantForGuestToken(admin, id, token);
    if (!participantId) return fail("El acceso de invitado ya no es válido");
    const { data: already } = await admin.from("tournament_participants").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
    if (already) return fail("Tu cuenta ya participa en este torneo con otro perfil");
    const { data: p } = await admin.from("tournament_participants").select("user_id,avatar_url").eq("id", participantId).single();
    if (p?.user_id) return fail("Ese perfil ya está vinculado a una cuenta");
    const { data: profile } = await admin.from("profiles").select("nickname,avatar_url").eq("id", user.id).maybeSingle();

    const { error } = await admin.from("tournament_participants")
      .update({ user_id: user.id, nickname: profile?.nickname ?? null, avatar_url: profile?.avatar_url ?? (p?.avatar_url as string | null) ?? null })
      .eq("id", participantId).is("user_id", null);
    if (error) throw error;
    // Las notificaciones del invitado pasan a la cuenta y el acceso por cookie deja de hacer falta
    await admin.from("notifications").update({ user_id: user.id }).eq("participant_id", participantId).is("user_id", null);
    await admin.from("participant_tokens").delete().eq("participant_id", participantId);
    await admin.rpc("admin_recompute_tournament", { p_tournament: id });
    store.delete(guestCookieName(id));
    revalidatePath(`/t/${id}`);
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
