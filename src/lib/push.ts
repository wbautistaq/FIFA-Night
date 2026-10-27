import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta interna que se abre al tocar el aviso. */
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en lugar de acumularse. */
  tag?: string;
}

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://fifa-night.app", pub!, priv!);
  return configured;
}

/**
 * Envía un aviso a los celulares de esos participantes (por su cuenta o por su acceso de invitado).
 * Nunca falla hacia afuera: el aviso dentro de la app ya quedó registrado aunque el push no llegue.
 */
export async function pushToParticipants(participantIds: string[], payload: PushPayload): Promise<number> {
  if (!ready() || participantIds.length === 0) return 0;
  const db = createAdminClient();
  const { data: parts } = await db.from("tournament_participants").select("id,user_id").in("id", participantIds);
  const userIds = (parts ?? []).map((p) => p.user_id as string | null).filter((x): x is string => Boolean(x));
  const filters = [`participant_id.in.(${participantIds.join(",")})`, ...(userIds.length ? [`user_id.in.(${userIds.join(",")})`] : [])];
  const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").or(filters.join(","));
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, JSON.stringify(payload), { TTL: 600, urgency: "high" });
      sent++;
    } catch (e) {
      // 404/410: el navegador anuló la suscripción; se limpia
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return sent;
}
