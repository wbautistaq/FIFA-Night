/** Equipo de la plataforma: "admin" puede todo; "moderator" solo bloquear cuentas y cancelar torneos. */
export type StaffRole = "admin" | "moderator";
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { admin: "Administrador", moderator: "Moderador" };

export function staffRole(appMetadata: unknown): StaffRole | null {
  const role = (appMetadata as { role?: unknown } | null | undefined)?.role;
  return role === "admin" || role === "moderator" ? role : null;
}
