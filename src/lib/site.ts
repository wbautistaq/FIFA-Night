/**
 * Dirección base para links que se comparten con otras personas (invitaciones, QR).
 * Si la app está abierta en localhost, ese link no le sirve a nadie más: se usa NEXT_PUBLIC_SITE_URL.
 */
export function shareOrigin(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  return local && site ? site : window.location.origin;
}

/** Correo de soporte público (eliminación de cuenta, privacidad y ayuda). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "fifanightsupport@gmail.com";

/** Fecha de la versión vigente de la política de privacidad. */
export const PRIVACY_UPDATED = "9 de noviembre de 2026";
