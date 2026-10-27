"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { errorMessage, fail, guestCookieName, ok, participantForGuestToken, requireActor, type ActionResult } from "@/lib/actor";
import { participantInputSchema } from "@/lib/schemas";
import { guestNameConflict } from "@/lib/people";

const uuid = z.string().uuid();
const token = z.string().regex(/^[a-f0-9]{36}$/, "Link de invitación inválido");

export async function regenerateInvitation(tournamentId: string): Promise<ActionResult<{ token: string }>> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer || !actor.userId) return fail("Solo el organizador puede gestionar invitaciones");
    // Revoca los links anteriores y crea uno nuevo
    await actor.client.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("tournament_id", tournamentId).is("revoked_at", null);
    const { data, error } = await actor.client.from("invitations").insert({ tournament_id: tournamentId, created_by: actor.userId }).select("token").single();
    if (error) throw error;
    return ok({ token: data.token as string });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function revokeInvitations(tournamentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(uuid.parse(tournamentId));
    if (!actor.isOrganizer) return fail("Solo el organizador puede revocar invitaciones");
    const { error } = await actor.client.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("tournament_id", tournamentId).is("revoked_at", null);
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export interface InvitePreview {
  tournamentId: string;
  name: string;
  format: string;
  platform: string;
  startsAt: string;
  players: number;
  maxPlayers: number;
  open: boolean;
  alreadyIn: boolean;
  /** Solo se puede entrar con cuenta. */
  accountsOnly: boolean;
  /** Quien abre el link con sesión iniciada: entra con su apodo. */
  me: { name: string; avatarUrl: string | null } | null;
}

/** Lectura pública mínima del torneo detrás de un token válido (service role, solo campos no sensibles). */
export async function previewInvitation(rawToken: string): Promise<ActionResult<InvitePreview>> {
  try {
    const t = token.parse(rawToken);
    const admin = createAdminClient();
    const { data: inv } = await admin.from("invitations").select("tournament_id,revoked_at,expires_at").eq("token", t).maybeSingle();
    if (!inv || inv.revoked_at || (inv.expires_at && new Date(inv.expires_at) < new Date())) return fail("Esta invitación no es válida o fue revocada");
    const { data: tr } = await admin.from("tournaments").select("id,name,format,platform,starts_at,max_players,status,settings").eq("id", inv.tournament_id).single();
    if (!tr) return fail("Torneo no encontrado");
    const { count } = await admin.from("tournament_participants").select("id", { count: "exact", head: true }).eq("tournament_id", tr.id);

    let alreadyIn = false;
    const store = await cookies();
    const g = store.get(guestCookieName(tr.id))?.value;
    if (g) {
      alreadyIn = /^[a-f0-9]{48}$/.test(g) && Boolean(await participantForGuestToken(admin, tr.id, g));
    }
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    let me: InvitePreview["me"] = null;
    if (u.user) {
      const [{ data }, { data: prof }] = await Promise.all([
        admin.from("tournament_participants").select("id").eq("tournament_id", tr.id).eq("user_id", u.user.id).maybeSingle(),
        admin.from("profiles").select("nickname,display_name,avatar_url").eq("id", u.user.id).maybeSingle(),
      ]);
      alreadyIn = alreadyIn || Boolean(data);
      me = { name: (prof?.nickname as string | null) || (prof?.display_name as string | undefined) || "Jugador", avatarUrl: (prof?.avatar_url as string | null) ?? null };
    }
    return ok({
      tournamentId: tr.id,
      name: tr.name,
      format: tr.format,
      platform: tr.platform,
      startsAt: tr.starts_at,
      players: count ?? 0,
      maxPlayers: tr.max_players,
      open: tr.status === "registration" && (count ?? 0) < tr.max_players,
      alreadyIn,
      me,
      accountsOnly: Boolean((tr.settings as { accounts_only?: boolean } | null)?.accounts_only),
    });
  } catch (e) {
    return fail(e instanceof z.ZodError ? "Link de invitación inválido" : errorMessage(e));
  }
}

const COLORS = ["#7c3aed", "#0ea5e9", "#f97316", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#22c55e", "#6366f1", "#f43f5e"];

export async function joinByToken(rawToken: string, input: unknown): Promise<ActionResult<{ tournamentId: string }>> {
  try {
    const t = token.parse(rawToken);
    const parsed = participantInputSchema.parse(input);
    const admin = createAdminClient();
    const { data: inv } = await admin.from("invitations").select("id,tournament_id,revoked_at,expires_at,uses").eq("token", t).maybeSingle();
    if (!inv || inv.revoked_at || (inv.expires_at && new Date(inv.expires_at) < new Date())) return fail("Esta invitación no es válida o fue revocada");

    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: existing } = await admin.from("tournament_participants").select("id").eq("tournament_id", inv.tournament_id).eq("user_id", u.user.id).maybeSingle();
      if (existing) return ok({ tournamentId: inv.tournament_id });
    } else {
      const { data: tr } = await admin.from("tournaments").select("settings").eq("id", inv.tournament_id).single();
      if ((tr?.settings as { accounts_only?: boolean } | null)?.accounts_only) return fail("Este torneo es solo para jugadores con cuenta. Inicia sesión para unirte.");
      const conflict = await guestNameConflict([parsed.display_name], "self");
      if (conflict) return fail(conflict);
    }
    const { count } = await admin.from("tournament_participants").select("id", { count: "exact", head: true }).eq("tournament_id", inv.tournament_id);
    // Con cuenta: se reutiliza el avatar del perfil; invitado: el emoticono elegido al unirse
    const prof = u.user ? (await admin.from("profiles").select("avatar_url,nickname,display_name").eq("id", u.user.id).maybeSingle()).data : null;
    const profileAvatar = prof?.avatar_url as string | null | undefined;
    const profileNick = (prof?.nickname as string | null | undefined) ?? null;
    const profileName = profileNick || (prof?.display_name as string | undefined);
    const { data: row, error } = await admin
      .from("tournament_participants")
      .insert({
        tournament_id: inv.tournament_id,
        user_id: u.user?.id ?? null,
        display_name: u.user ? (profileName ?? parsed.display_name) : parsed.display_name,
        nickname: u.user ? profileNick : parsed.nickname || null,
        platform: parsed.platform,
        gamer_id: parsed.gamer_id || null,
        avatar_url: profileAvatar ?? (parsed.avatar || null),
        avatar_color: COLORS[(count ?? 0) % COLORS.length],
      })
      .select("id")
      .single();
    if (error) {
      if (/participants_name|duplicate/i.test(error.message)) return fail("Ya hay alguien con ese nombre en el torneo");
      throw error;
    }
    await admin.from("invitations").update({ uses: inv.uses + 1 }).eq("id", inv.id);
    if (!u.user) {
      // El token lo crea un trigger de la base en participant_tokens (tabla solo accesible desde el servidor)
      const { data: tk, error: te } = await admin.from("participant_tokens").select("token").eq("participant_id", row.id).single();
      if (te) throw te;
      const store = await cookies();
      store.set(guestCookieName(inv.tournament_id), tk.token as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 120 });
    }
    return ok({ tournamentId: inv.tournament_id });
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

/** Espectador por link: recibe cookie de solo lectura (sin participante) */
export async function currentInviteToken(tournamentId: string): Promise<string | null> {
  const actor = await requireActor(uuid.parse(tournamentId));
  if (!actor.isOrganizer) return null;
  const { data } = await actor.client.from("invitations").select("token").eq("tournament_id", tournamentId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.token as string | undefined) ?? null;
}
