import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { staffRole, type StaffRole } from "@/lib/staff";

export { STAFF_ROLE_LABEL, staffRole, type StaffRole } from "@/lib/staff";

export interface AdminState {
  /** Rol en el equipo de la plataforma (null para jugadores). */
  role: StaffRole | null;
  isAdmin: boolean;
  /** Administrador o moderador: puede entrar al panel. */
  isStaff: boolean;
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
  const role = staffRole(claims?.app_metadata);
  return {
    role,
    isAdmin: role === "admin",
    isStaff: role !== null,
    aal: claims?.aal ?? null,
    userId: claims?.sub ?? null,
    email: claims?.email ?? null,
    sessionId: claims?.session_id ?? null,
  };
}

export interface AdminContext {
  role: StaffRole;
  userId: string;
  email: string | null;
  sessionId: string | null;
}

/**
 * Exige un rol del equipo con verificación en dos pasos completada. Úsalo al inicio de cada acción.
 * El rol se vuelve a leer de la base de datos: si se lo quitaron hace un momento, el token aún podría decir lo contrario.
 */
export async function requireStaff(min: StaffRole = "admin"): Promise<AdminContext> {
  const s = await adminState();
  if (!s.isStaff || !s.userId) throw new Error("No autorizado");
  if (s.aal !== "aal2") throw new Error("Confirma tu código de verificación en dos pasos");
  const { data, error } = await createAdminClient().auth.admin.getUserById(s.userId);
  const role = error ? null : staffRole(data.user?.app_metadata);
  if (!role || (min === "admin" && role !== "admin")) throw new Error("No autorizado");
  return { role, userId: s.userId, email: s.email, sessionId: s.sessionId };
}

/** Solo administradores. */
export const requireAdmin = () => requireStaff("admin");

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
