"use server";

import { errorMessage, fail, ok, requireUser, type ActionResult } from "@/lib/actor";
import { staffRole } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { purgeTournament } from "@/lib/tournament-purge";

type Admin = ReturnType<typeof createAdminClient>;

export interface DeletionPlan {
  /** Torneos que pasan a un coorganizador con cuenta. */
  transfer: { id: string; name: string; to: string }[];
  /** Torneos sin coorganizador con cuenta: se borran completos. */
  remove: { id: string; name: string }[];
  /** Torneos de otros donde juega: se conservan los resultados con un nombre anónimo. */
  playing: number;
}

async function planFor(db: Admin, userId: string): Promise<DeletionPlan> {
  const [{ data: owned }, { count }] = await Promise.all([
    db.from("tournaments").select("id,name").eq("owner_id", userId).order("created_at"),
    db.from("tournament_participants").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const plan: DeletionPlan = { transfer: [], remove: [], playing: 0 };
  for (const t of owned ?? []) {
    const { data: heir } = await db.from("tournament_participants").select("user_id,display_name,nickname")
      .eq("tournament_id", t.id).eq("role", "coorganizer").not("user_id", "is", null).neq("user_id", userId)
      .order("joined_at").limit(1).maybeSingle();
    if (heir?.user_id) plan.transfer.push({ id: t.id, name: t.name, to: heir.nickname || heir.display_name });
    else plan.remove.push({ id: t.id, name: t.name });
  }
  plan.playing = Math.max(0, (count ?? 0) - (owned?.length ?? 0));
  return plan;
}

/** Qué pasará con los torneos si la persona borra su cuenta (se muestra antes de confirmar). */
export async function accountDeletionPlan(): Promise<ActionResult<DeletionPlan>> {
  try {
    const { user } = await requireUser();
    return ok(await planFor(createAdminClient(), user.id));
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Borra todos los archivos que la persona subió (avatar y fotos del muro), guardados bajo su id. */
async function removeUserFiles(db: Admin, userId: string) {
  const bucket = db.storage.from("fifa-night");
  const { data: top } = await bucket.list(userId, { limit: 1000 });
  const paths: string[] = [];
  for (const entry of top ?? []) {
    if (entry.id) { paths.push(`${userId}/${entry.name}`); continue; }
    // Carpeta (una por torneo): lista sus archivos
    const { data: inner } = await bucket.list(`${userId}/${entry.name}`, { limit: 1000 });
    for (const f of inner ?? []) if (f.id) paths.push(`${userId}/${entry.name}/${f.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100));
}

/**
 * Borra la cuenta de quien la pide y sus datos personales (requisito de Google Play).
 * - Sus torneos pasan a un coorganizador con cuenta; si no hay, se borran.
 * - En torneos de otros sus partidos se conservan, pero con un nombre anónimo y sin foto ni ID de jugador.
 * - Se borran sus publicaciones del muro, sus archivos, avisos, bloqueos y suscripciones.
 */
export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation.trim().toUpperCase() !== "ELIMINAR") return fail("Escribe ELIMINAR para confirmar");
    const { user } = await requireUser();
    const db = createAdminClient();
    const { data: fresh } = await db.auth.admin.getUserById(user.id);
    if (staffRole(fresh.user?.app_metadata)) return fail("Eres parte del equipo de la plataforma: pide a un administrador que te quite el rol antes de borrar tu cuenta");

    const plan = await planFor(db, user.id);
    for (const t of plan.transfer) {
      const { data: heir } = await db.from("tournament_participants").select("user_id")
        .eq("tournament_id", t.id).eq("role", "coorganizer").not("user_id", "is", null).neq("user_id", user.id)
        .order("joined_at").limit(1).maybeSingle();
      if (!heir?.user_id) { await purgeTournament(db, t.id); continue; }
      const { error } = await db.from("tournaments").update({ owner_id: heir.user_id }).eq("id", t.id);
      if (error) throw error;
    }
    for (const t of plan.remove) await purgeTournament(db, t.id);

    const { data: mine } = await db.from("tournament_participants").select("id").eq("user_id", user.id);
    const ids = (mine ?? []).map((p) => p.id as string);
    if (ids.length) {
      const posts = await db.from("tournament_posts").delete().in("author_participant_id", ids);
      if (posts.error) throw posts.error;
      for (const pid of ids) {
        const { error } = await db.from("tournament_participants").update({
          display_name: `Jugador eliminado ${pid.slice(0, 4)}`, nickname: null, avatar_url: null, gamer_id: null, user_id: null, role: "player",
        }).eq("id", pid);
        if (error) throw error;
      }
    }

    await removeUserFiles(db, user.id);
    await db.from("push_subscriptions").delete().eq("user_id", user.id);
    // Cerrar las sesiones abiertas antes de borrar: borrar la cuenta no invalida los accesos ya emitidos
    await db.rpc("admin_revoke_sessions", { p_user: user.id });
    const del = await db.auth.admin.deleteUser(user.id);
    if (del.error) throw del.error;
    return ok();
  } catch (e) {
    return fail(errorMessage(e));
  }
}
