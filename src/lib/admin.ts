import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface AdminState {
  isAdmin: boolean;
  /** "aal2" cuando la sesión ya pasó la verificación en dos pasos. */
  aal: string | null;
  userId: string | null;
  email: string | null;
  /** Sesión (dispositivo) desde la que se consulta, para no cerrarla por error. */
  sessionId: string | null;
}

/**
 * Estado de administrador de la sesión actual, leído del JWT verificado.
 * El rol vive en app_metadata (solo editable con la clave de servicio), nunca en user_metadata.
 */
export async function adminState(): Promise<AdminState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string; aal?: string; session_id?: string; app_metadata?: { role?: string } } | undefined;
  return {
    isAdmin: claims?.app_metadata?.role === "admin",
    aal: claims?.aal ?? null,
    userId: claims?.sub ?? null,
    email: claims?.email ?? null,
    sessionId: claims?.session_id ?? null,
  };
}

export interface AdminContext {
  userId: string;
  email: string | null;
  sessionId: string | null;
}

/** Exige administrador con verificación en dos pasos completada. Úsalo al inicio de cada acción. */
export async function requireAdmin(): Promise<AdminContext> {
  const s = await adminState();
  if (!s.isAdmin || !s.userId) throw new Error("No autorizado");
  if (s.aal !== "aal2") throw new Error("Confirma tu código de verificación en dos pasos");
  return { userId: s.userId, email: s.email, sessionId: s.sessionId };
}

/** Registra una acción de administración. Si el registro falla, la acción se considera fallida. */
export async function audit(admin: AdminContext, action: string, targetType: "user" | "tournament" | "platform", targetId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await createAdminClient().from("admin_audit_log").insert({
    admin_id: admin.userId,
    admin_email: admin.email,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
  if (error) throw new Error(`No se pudo registrar la acción: ${error.message}`);
}
