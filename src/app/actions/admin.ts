"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { errorMessage, fail, ok, type ActionResult } from "@/lib/actor";
import { audit, requireAdmin, requireStaff, staffRole, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/admin";
import { newAccessCode } from "@/lib/access-code";
import { createAdminClient } from "@/lib/supabase/server";
import { describeDevice, ONLINE_WINDOW_MS, type Device } from "@/lib/device";
import { APPEARANCE_TAG } from "@/lib/site-appearance";
import { THEME_IDS, effectiveTheme, themeInfo, type ThemeId } from "@/lib/themes";

const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email("Correo inválido");

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastSignIn: string | null;
  /** Rol en el equipo de la plataforma (null para jugadores). */
  role: StaffRole | null;
  banned: boolean;
  mfa: boolean;
  tournamentsOwned: number;
}

export interface AdminTournament {
  id: string;
  name: string;
  status: string;
  format: string;
  createdAt: string;
  ownerName: string | null;
  players: number;
  matches: number;
}

export interface AdminLogEntry {
  id: number;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminSession {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastActiveAt: string;
  /** Pasó la verificación en dos pasos en esa sesión. */
  mfa: boolean;
  device: string;
  deviceKind: Device["kind"];
  /** Es la sesión desde la que se está viendo el panel. */
  current: boolean;
}

export interface AdminOverview {
  /** Rol de quien ve el panel: los moderadores reciben menos datos (sin correos, sesiones ni registro). */
  viewerRole: StaffRole;
  users: AdminUser[];
  tournaments: AdminTournament[];
  log: AdminLogEntry[];
  /** null si la base de datos aún no tiene la función de sesiones (migración 17). */
  sessions: AdminSession[] | null;
  /** null si la base de datos aún no tiene la tabla site_settings (migración 21). */
  appearance: { theme: ThemeId } | null;
  totals: { users: number; tournaments: number; active: number; matches: number; results: number; onlineUsers: number };
}

/** Datos del panel: usuarios, torneos, totales y las últimas acciones registradas. */
export async function loadAdminOverview(): Promise<AdminOverview> {
  const admin = await requireStaff("moderator");
  const full = admin.role === "admin";
  const db = createAdminClient();
  const [usersRes, profiles, tournaments, participants, matches, results, log, sessionsRes] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 500 }),
    db.from("profiles").select("id,display_name"),
    db.from("tournaments").select("id,name,status,format,created_at,owner_id").order("created_at", { ascending: false }),
    db.from("tournament_participants").select("tournament_id"),
    db.from("matches").select("tournament_id"),
    db.from("match_results").select("id", { count: "exact", head: true }),
    db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    db.rpc("admin_list_sessions"),
  ]);
  type SessionRow = { session_id: string; user_id: string; email: string | null; created_at: string; last_active_at: string; aal: string | null; user_agent: string | null };
  const sessionRows = sessionsRes.error ? null : ((sessionsRes.data ?? []) as SessionRow[]);
  if (usersRes.error) throw usersRes.error;
  const names = new Map((profiles.data ?? []).map((p) => [p.id as string, p.display_name as string]));
  const count = (rows: { tournament_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.tournament_id === id).length;
  const ts = tournaments.data ?? [];

  return {
    viewerRole: admin.role,
    users: usersRes.data.users.map((u) => ({
      id: u.id,
      email: full ? u.email ?? null : null,
      name: names.get(u.id) ?? null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      role: staffRole(u.app_metadata),
      banned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      mfa: (u.factors ?? []).some((f) => f.status === "verified"),
      tournamentsOwned: ts.filter((t) => t.owner_id === u.id).length,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tournaments: ts.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      status: t.status as string,
      format: t.format as string,
      createdAt: t.created_at as string,
      ownerName: names.get(t.owner_id as string) ?? null,
      players: count(participants.data as { tournament_id: string }[] | null, t.id as string),
      matches: count(matches.data as { tournament_id: string }[] | null, t.id as string),
    })),
    log: (full ? log.data ?? [] : []).map((l) => ({
      id: l.id as number,
      adminEmail: l.admin_email as string | null,
      action: l.action as string,
      targetType: l.target_type as string | null,
      targetId: l.target_id as string | null,
      details: (l.details ?? {}) as Record<string, unknown>,
      createdAt: l.created_at as string,
    })),
    sessions: full && sessionRows ? sessionRows.map((s) => {
      const d = describeDevice(s.user_agent);
      return {
        id: s.session_id, userId: s.user_id, email: s.email, name: names.get(s.user_id) ?? null,
        createdAt: s.created_at, lastActiveAt: s.last_active_at, mfa: s.aal === "aal2",
        device: d.label, deviceKind: d.kind, current: s.session_id === admin.sessionId,
      };
    }) : null,
    appearance: full ? await readAppearance(db) : null,
    totals: {
      users: usersRes.data.users.length,
      tournaments: ts.length,
      active: ts.filter((t) => t.status === "in_progress").length,
      matches: (matches.data ?? []).length,
      results: results.count ?? 0,
      onlineUsers: new Set((sessionRows ?? []).filter((s) => Date.now() - Date.parse(s.last_active_at) < ONLINE_WINDOW_MS).map((s) => s.user_id)).size,
    },
  };
}

async function isStaffMember(id: string) {
  const { data } = await createAdminClient().auth.admin.getUserById(id);
  return staffRole(data.user?.app_metadata) !== null;
}

async function userLabel(id: string) {
  const { data } = await createAdminClient().auth.admin.getUserById(id);
  return data.user?.email ?? id;
}

/** Nuevo código de acceso (contraseña) para un usuario. Se muestra una sola vez y no se guarda en el registro. */
export async function adminGenerateAccessCode(userId: string): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(userId);
    const code = newAccessCode();
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: code });
    if (error) throw error;
    await audit(admin, "Generó código de acceso", "user", id, { email: await userLabel(id) });
    return ok({ code });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Crea una cuenta ya confirmada (sin correo) con un código de acceso. */
export async function adminCreateUser(rawEmail: string): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireAdmin();
    const mail = email.parse(rawEmail);
    const code = newAccessCode();
    const { data, error } = await createAdminClient().auth.admin.createUser({ email: mail, password: code, email_confirm: true });
    if (error) return fail(/already/i.test(error.message) ? "Ya existe una cuenta con ese correo" : error.message);
    await audit(admin, "Creó usuario", "user", data.user.id, { email: mail });
    revalidatePath("/admin");
    return ok({ code });
  } catch (e) {
    return fail(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos") : errorMessage(e));
  }
}

/** Cierra todas las sesiones del usuario en todos sus dispositivos. */
export async function adminRevokeSessions(userId: string): Promise<ActionResult<{ sessions: number }>> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(userId);
    const { data, error } = await createAdminClient().rpc("admin_revoke_sessions", { p_user: id });
    if (error) throw error;
    await audit(admin, "Cerró sesiones", "user", id, { email: await userLabel(id), sesiones: data });
    return ok({ sessions: (data as number) ?? 0 });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Cierra una sola sesión (un dispositivo concreto). La que usa el administrador no se puede cerrar desde aquí. */
export async function adminRevokeSession(sessionId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(sessionId);
    if (id === admin.sessionId) return fail("Esa es tu sesión actual: usa «Cerrar sesión» en tu perfil");
    const { data, error } = await createAdminClient().rpc("admin_revoke_session", { p_session: id });
    if (error) throw error;
    if (!data) return fail("Esa sesión ya estaba cerrada");
    await audit(admin, "Cerró una sesión", "user", data as string, { email: await userLabel(data as string), sesion: id });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Bloquea (o desbloquea) la cuenta: no puede iniciar sesión ni renovar la que tenga abierta. */
export async function adminSetBan(userId: string, banned: boolean): Promise<ActionResult> {
  try {
    const admin = await requireStaff("moderator");
    const id = uuid.parse(userId);
    if (id === admin.userId) return fail("No puedes bloquear tu propia cuenta");
    const db = createAdminClient();
    if (await isStaffMember(id)) return fail("Es parte del equipo: primero quítale el rol en la pestaña Equipo");
    const { error } = await db.auth.admin.updateUserById(id, { ban_duration: banned ? "876000h" : "none" });
    if (error) throw error;
    if (banned) await db.rpc("admin_revoke_sessions", { p_user: id });
    await audit(admin, banned ? "Bloqueó usuario" : "Desbloqueó usuario", "user", id, { email: await userLabel(id) });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Elimina la cuenta. Si organiza torneos, primero hay que borrarlos (no se pierden datos de otros sin querer). */
export async function adminDeleteUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(userId);
    if (id === admin.userId) return fail("No puedes eliminar tu propia cuenta");
    if (await isStaffMember(id)) return fail("Es parte del equipo: primero quítale el rol en la pestaña Equipo");
    const db = createAdminClient();
    const { count } = await db.from("tournaments").select("id", { count: "exact", head: true }).eq("owner_id", id);
    if (count) return fail(`Organiza ${count} torneo(s). Elimínalos primero desde la pestaña Torneos.`);
    const label = await userLabel(id);
    // Eliminar la cuenta no invalida los accesos abiertos: se cierran antes
    await db.rpc("admin_revoke_sessions", { p_user: id });
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw error;
    await audit(admin, "Eliminó usuario", "user", id, { email: label });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

async function tournamentName(id: string) {
  const { data } = await createAdminClient().from("tournaments").select("name").eq("id", id).maybeSingle();
  return (data?.name as string | undefined) ?? id;
}

/** Cancela un torneo en curso o en inscripción (los datos se conservan). */
export async function adminCancelTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const admin = await requireStaff("moderator");
    const id = uuid.parse(tournamentId);
    const { error } = await createAdminClient().from("tournaments").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
    await audit(admin, "Canceló torneo", "tournament", id, { nombre: await tournamentName(id) });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Elimina un torneo con todo su contenido, incluidas las fotos de marcador guardadas. */
export async function adminDeleteTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(tournamentId);
    const db = createAdminClient();
    const name = await tournamentName(id);
    const { data: files } = await db.storage.from("fifa-night").list(`proofs/${id}`);
    if (files?.length) await db.storage.from("fifa-night").remove(files.map((f) => `proofs/${id}/${f.name}`));
    // Las asignaciones apuntan a equipos propios del torneo (RESTRICT): se borran antes
    const del1 = await db.from("team_assignments").delete().eq("tournament_id", id);
    if (del1.error) throw del1.error;
    const del2 = await db.from("tournaments").delete().eq("id", id);
    if (del2.error) throw del2.error;
    await audit(admin, "Eliminó torneo", "tournament", id, { nombre: name, fotos: files?.length ?? 0 });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Mantenimiento: recalcula tabla, predicciones y estadísticas de un torneo. */
export async function adminRecomputeTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(tournamentId);
    const { error } = await createAdminClient().rpc("admin_recompute_tournament", { p_tournament: id });
    if (error) throw error;
    await audit(admin, "Recalculó torneo", "tournament", id, { nombre: await tournamentName(id) });
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

async function readAppearance(db: ReturnType<typeof createAdminClient>): Promise<AdminOverview["appearance"]> {
  const { data, error } = await db.from("site_settings").select("theme").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return { theme: effectiveTheme(data.theme) };
}

/** Cambia la paleta de todo el sitio. */
export async function adminSetTheme(theme: ThemeId): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const next = z.enum(THEME_IDS).parse(theme);
    const db = createAdminClient();
    if (!(await readAppearance(db))) return fail("Falta aplicar la migración 21 (site_settings) en Supabase");
    const { error } = await db.from("site_settings").update({ theme: next, updated_at: new Date().toISOString(), updated_by: admin.userId }).eq("id", 1);
    if (error) throw error;
    await audit(admin, "Cambió la paleta", "platform", null, { tema: themeInfo(next).name });
    revalidateTag(APPEARANCE_TAG);
    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const roleInput = z.enum(["admin", "moderator"]).nullable();

/**
 * Da, cambia o quita el rol de alguien del equipo. Nadie cambia su propio rol: así siempre queda
 * al menos un administrador (quien hace el cambio) y nadie se queda fuera por error.
 */
export async function adminSetRole(userId: string, role: StaffRole | null): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse(userId);
    const next = roleInput.parse(role);
    if (id === admin.userId) return fail("No puedes cambiar tu propio rol: pídeselo a otro administrador");
    const db = createAdminClient();
    const { data, error } = await db.auth.admin.getUserById(id);
    if (error || !data.user) return fail("No se encontró la cuenta");
    const before = staffRole(data.user.app_metadata);
    if (before === next) return ok();
    if (next && data.user.banned_until && new Date(data.user.banned_until) > new Date()) return fail("La cuenta está bloqueada: desbloquéala primero");
    const upd = await db.auth.admin.updateUserById(id, { app_metadata: { role: next } });
    if (upd.error) throw upd.error;
    // Al bajar o quitar un rol se cierran sus sesiones para que el permiso deje de valer de inmediato
    if (before && before !== next) await db.rpc("admin_revoke_sessions", { p_user: id });
    await audit(admin, next ? (before ? "Cambió rol" : "Agregó al equipo") : "Quitó del equipo", "user", id, {
      email: data.user.email ?? id, antes: before ? STAFF_ROLE_LABEL[before] : "Jugador", ahora: next ? STAFF_ROLE_LABEL[next] : "Jugador",
    });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Agrega al equipo una cuenta existente, buscándola por correo. */
export async function adminAddStaff(rawEmail: string, role: StaffRole): Promise<ActionResult> {
  try {
    await requireAdmin();
    const target = email.parse(rawEmail);
    const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (!user) return fail("No hay ninguna cuenta con ese correo. Créala primero en la pestaña Usuarios.");
    return adminSetRole(user.id, roleInput.parse(role));
  } catch (e) {
    return fail(errorMessage(e));
  }
}
