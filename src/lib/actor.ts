import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const guestCookieName = (tournamentId: string) => `fn_g_${tournamentId.replace(/-/g, "").slice(0, 16)}`;

export interface Actor {
  /** Cliente a usar: RLS para usuarios con cuenta, service role (validado) para invitados. */
  client: SupabaseClient;
  kind: "user" | "guest";
  userId: string | null;
  participantId: string | null;
  isOrganizer: boolean;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
export const ok = <T = undefined>(data?: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Error inesperado";
  if (/row-level security/i.test(raw)) return "No tienes permiso para hacer esto";
  if (/duplicate key/i.test(raw)) return "Ya existe un registro igual (nombre o resultado duplicado)";
  return raw;
}

/**
 * Id del usuario con sesión. `getClaims` verifica el JWT localmente con las claves públicas del proyecto
 * (sin ir al servidor de Auth en cada petición); con claves simétricas legacy recurre a `getUser`.
 */
async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string" ? data.claims.sub : null;
}

/** Resuelve quién actúa sobre un torneo: usuario con cuenta o invitado con cookie de token. */
export async function getActor(tournamentId: string): Promise<Actor | null> {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (userId) {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("tournament_participants").select("id,role").eq("tournament_id", tournamentId).eq("user_id", userId).maybeSingle(),
      supabase.from("tournaments").select("owner_id").eq("id", tournamentId).maybeSingle(),
    ]);
    if (t || p) {
      return {
        client: supabase,
        kind: "user",
        userId,
        participantId: p?.id ?? null,
        isOrganizer: t?.owner_id === userId || p?.role === "coorganizer",
      };
    }
  }
  const store = await cookies();
  const token = store.get(guestCookieName(tournamentId))?.value;
  if (!token || !/^[a-f0-9]{48}$/.test(token)) return null;
  const admin = createAdminClient();
  const participantId = await participantForGuestToken(admin, tournamentId, token);
  if (!participantId) return null;
  return { client: admin, kind: "guest", userId: null, participantId, isOrganizer: false };
}

/**
 * Participante invitado dueño de un token, solo si pertenece a ese torneo.
 * Los tokens viven en `participant_tokens`, sin permisos para usuarios: únicamente el servidor los lee.
 */
export async function participantForGuestToken(admin: SupabaseClient, tournamentId: string, token: string): Promise<string | null> {
  const { data } = await admin
    .from("participant_tokens")
    .select("participant_id, tournament_participants!inner(tournament_id)")
    .eq("token", token)
    .eq("tournament_participants.tournament_id", tournamentId)
    .maybeSingle();
  return (data?.participant_id as string | undefined) ?? null;
}

export async function requireActor(tournamentId: string): Promise<Actor> {
  const a = await getActor(tournamentId);
  if (!a) throw new Error("Necesitas unirte al torneo con el link de invitación");
  return a;
}

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inicia sesión para continuar");
  return { supabase, user: data.user };
}
