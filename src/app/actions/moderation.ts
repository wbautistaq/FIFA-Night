"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { errorMessage, fail, ok, requireActor, requireUser, type ActionResult } from "@/lib/actor";
import { audit, requireStaff, staffRole } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";

const uuid = z.string().uuid();
const reasonSchema = z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]);
const MAX_REPORTS_PER_DAY = 10;

const shownName = (p: { nickname?: string | null; display_name?: string | null } | null | undefined) => p?.nickname || p?.display_name || null;

/**
 * Reporta una publicación del muro o a un jugador. Lo puede hacer cualquier participante, también invitados.
 * Se guarda una copia del contenido para que el equipo lo revise aunque luego lo borren.
 */
export async function reportContent(
  tournamentId: string,
  target: { kind: "post"; postId: string } | { kind: "user"; participantId: string },
  reason: ReportReason,
  details?: string,
): Promise<ActionResult> {
  try {
    const tid = uuid.parse(tournamentId);
    const why = reasonSchema.parse(reason);
    const actor = await requireActor(tid);
    if (!actor.participantId) return fail("Solo los participantes del torneo pueden reportar");
    const db = createAdminClient();

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await db.from("content_reports").select("id", { count: "exact", head: true }).eq("reporter_participant_id", actor.participantId).gte("created_at", since);
    if ((count ?? 0) >= MAX_REPORTS_PER_DAY) return fail("Ya enviaste muchos reportes hoy. El equipo los está revisando.");

    const [{ data: t }, { data: me }] = await Promise.all([
      db.from("tournaments").select("name").eq("id", tid).maybeSingle(),
      db.from("tournament_participants").select("display_name,nickname").eq("id", actor.participantId).maybeSingle(),
    ]);

    let post: { id: string; body: string; image_url: string | null; author_participant_id: string } | null = null;
    let reportedParticipantId: string;
    if (target.kind === "post") {
      const { data } = await db.from("tournament_posts").select("id,body,image_url,author_participant_id").eq("id", uuid.parse(target.postId)).eq("tournament_id", tid).maybeSingle();
      if (!data) return fail("Esa publicación ya no existe");
      post = data;
      reportedParticipantId = data.author_participant_id;
    } else {
      reportedParticipantId = uuid.parse(target.participantId);
    }
    if (reportedParticipantId === actor.participantId) return fail("No puedes reportarte a ti mismo");
    const { data: reported } = await db.from("tournament_participants").select("id,user_id,display_name,nickname").eq("id", reportedParticipantId).eq("tournament_id", tid).maybeSingle();
    if (!reported) return fail("Ese jugador no está en este torneo");

    // Un mismo reporte abierto no se duplica
    let dup = db.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open").eq("reporter_participant_id", actor.participantId);
    dup = post ? dup.eq("post_id", post.id) : dup.eq("kind", "user").eq("reported_participant_id", reported.id);
    if (((await dup).count ?? 0) > 0) return ok();

    const { error } = await db.from("content_reports").insert({
      kind: target.kind,
      reason: why,
      details: details ? sanitizeText(details, 500) || null : null,
      tournament_id: tid,
      tournament_name: t?.name ?? null,
      post_id: post?.id ?? null,
      post_body: post?.body ?? null,
      post_image_url: post?.image_url ?? null,
      reported_participant_id: reported.id,
      reported_user_id: reported.user_id,
      reported_name: shownName(reported),
      reporter_user_id: actor.userId,
      reporter_participant_id: actor.participantId,
      reporter_name: shownName(me),
    });
    if (error) throw error;
    return ok();
  } catch (e) {
    return fail(e instanceof z.ZodError ? "Elige un motivo válido" : errorMessage(e));
  }
}

/** Bloquea (o desbloquea) al autor con cuenta de un torneo: sus publicaciones dejan de verse para ti. */
export async function setBlocked(tournamentId: string, participantId: string, blocked: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { data: p } = await createAdminClient().from("tournament_participants").select("user_id").eq("id", uuid.parse(participantId)).eq("tournament_id", uuid.parse(tournamentId)).maybeSingle();
    if (!p?.user_id) return fail("Solo se puede bloquear a jugadores con cuenta. A un invitado puedes reportarlo.");
    return blocked ? blockUserId(supabase, user.id, p.user_id) : unblockUser(p.user_id);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

async function blockUserId(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], me: string, other: string): Promise<ActionResult> {
  if (other === me) return fail("No puedes bloquearte a ti mismo");
  const { error } = await supabase.from("user_blocks").upsert({ blocker_id: me, blocked_id: other }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) throw error;
  return ok();
}

/** Quita un bloqueo propio. */
export async function unblockUser(userId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", uuid.parse(userId));
    if (error) throw error;
    revalidatePath("/perfil");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Personas que bloqueé, con el nombre que usan en la app. */
export async function listMyBlocks(): Promise<ActionResult<{ userId: string; name: string }[]>> {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id);
    if (error) throw error;
    const ids = (data ?? []).map((b) => b.blocked_id as string);
    if (!ids.length) return ok([]);
    const { data: profiles } = await createAdminClient().from("profiles").select("id,display_name,nickname").in("id", ids);
    const names = new Map((profiles ?? []).map((p) => [p.id as string, shownName(p) ?? "Jugador"]));
    return ok(ids.map((id) => ({ userId: id, name: names.get(id) ?? "Jugador" })));
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export interface ReportRow {
  id: number;
  createdAt: string;
  kind: "post" | "user";
  reason: ReportReason;
  details: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  postId: string | null;
  postBody: string | null;
  postImageUrl: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  reporterName: string | null;
  status: "open" | "resolved" | "dismissed";
  resolution: string | null;
  resolvedAt: string | null;
}

/** Bandeja de reportes para el equipo (abiertos primero). null si falta la migración 22. */
export async function loadReports(): Promise<ReportRow[] | null> {
  await requireStaff("moderator");
  const { data, error } = await createAdminClient().from("content_reports").select("*").order("created_at", { ascending: false }).limit(150);
  if (error) return null;
  const rows = [...(data ?? [])].sort((x, y) => Number(y.status === "open") - Number(x.status === "open"));
  return rows.map((r) => ({
    id: r.id, createdAt: r.created_at, kind: r.kind, reason: r.reason, details: r.details,
    tournamentId: r.tournament_id, tournamentName: r.tournament_name, postId: r.post_id, postBody: r.post_body, postImageUrl: r.post_image_url,
    reportedUserId: r.reported_user_id, reportedName: r.reported_name, reporterName: r.reporter_name,
    status: r.status, resolution: r.resolution, resolvedAt: r.resolved_at,
  }));
}

const RESOLUTION_TEXT = { dismiss: "Descartado", resolve: "Resuelto sin cambios", delete_post: "Publicación eliminada", ban_user: "Cuenta bloqueada" } as const;
export type ReportAction = keyof typeof RESOLUTION_TEXT;

/** Atiende un reporte: descartar, marcar resuelto, borrar la publicación o bloquear la cuenta reportada. */
export async function resolveReport(reportId: number, action: ReportAction): Promise<ActionResult> {
  try {
    const staff = await requireStaff("moderator");
    const what = z.enum(["dismiss", "resolve", "delete_post", "ban_user"]).parse(action);
    const db = createAdminClient();
    const { data: r } = await db.from("content_reports").select("*").eq("id", z.number().int().parse(reportId)).maybeSingle();
    if (!r) return fail("Reporte no encontrado");

    if (what === "delete_post") {
      if (!r.post_id) return fail("La publicación ya no existe");
      const { error } = await db.from("tournament_posts").delete().eq("id", r.post_id);
      if (error) throw error;
      await removePostImage(db, r.post_image_url as string | null);
    }
    if (what === "ban_user") {
      if (!r.reported_user_id) return fail("Es un invitado sin cuenta: elimina la publicación o pide al organizador que lo saque del torneo");
      if (r.reported_user_id === staff.userId) return fail("No puedes bloquear tu propia cuenta");
      const { data: target } = await db.auth.admin.getUserById(r.reported_user_id);
      if (staffRole(target.user?.app_metadata)) return fail("Es parte del equipo: un administrador debe quitarle el rol primero");
      const { error } = await db.auth.admin.updateUserById(r.reported_user_id, { ban_duration: "876000h" });
      if (error) throw error;
      await db.rpc("admin_revoke_sessions", { p_user: r.reported_user_id });
    }

    const closed = { status: what === "dismiss" ? "dismissed" : "resolved", resolution: RESOLUTION_TEXT[what], resolved_by: staff.userId, resolved_at: new Date().toISOString() };
    // Al borrar la publicación se cierran todos los reportes abiertos sobre ella
    const upd = what === "delete_post" && r.post_id
      ? await db.from("content_reports").update(closed).eq("status", "open").or(`id.eq.${r.id},post_id.eq.${r.post_id}`)
      : await db.from("content_reports").update(closed).eq("id", r.id);
    if (upd.error) throw upd.error;

    await audit(staff, `Reporte: ${RESOLUTION_TEXT[what]}`, what === "ban_user" ? "user" : "platform", what === "ban_user" ? r.reported_user_id : null, {
      reporte: r.id, motivo: REPORT_REASONS[r.reason as ReportReason] ?? r.reason, reportado: r.reported_name ?? "—", torneo: r.tournament_name ?? "—",
    });
    revalidatePath("/admin");
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}

async function removePostImage(db: ReturnType<typeof createAdminClient>, url: string | null) {
  const marker = "/storage/v1/object/public/fifa-night/";
  const i = url?.indexOf(marker) ?? -1;
  if (url && i >= 0) await db.storage.from("fifa-night").remove([decodeURIComponent(url.slice(i + marker.length))]);
}
