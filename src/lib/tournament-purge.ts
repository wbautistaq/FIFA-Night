import "server-only";
import type { createAdminClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

/** Borra un torneo con todo su contenido, incluidas las fotos de marcador. Devuelve cuántas fotos se borraron. */
export async function purgeTournament(db: Admin, id: string): Promise<number> {
  const { data: files } = await db.storage.from("fifa-night").list(`proofs/${id}`);
  if (files?.length) await db.storage.from("fifa-night").remove(files.map((f) => `proofs/${id}/${f.name}`));
  // Las asignaciones apuntan a equipos propios del torneo (RESTRICT): se borran antes
  const del1 = await db.from("team_assignments").delete().eq("tournament_id", id);
  if (del1.error) throw del1.error;
  const del2 = await db.from("tournaments").delete().eq("id", id);
  if (del2.error) throw del2.error;
  return files?.length ?? 0;
}
