import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export { normName } from "@/lib/names";

/**
 * Un invitado no puede llevar el apodo de alguien con cuenta: sería un registro duplicado (o una suplantación).
 * Devuelve el mensaje para el usuario, o null si el nombre está libre.
 */
export async function guestNameConflict(names: string[], who: "organizer" | "self"): Promise<string | null> {
  const db = createAdminClient();
  for (const name of names) {
    const { data } = await db.rpc("nickname_owner", { p_name: name });
    if (data) {
      return who === "self"
        ? `«${name}» es el apodo de un jugador con cuenta. Si eres tú, entra con tu cuenta; si no, usa otro nombre.`
        : `«${name}» ya tiene cuenta en FIFA Night: agrégalo buscándolo por su apodo, no como invitado.`;
    }
  }
  return null;
}
