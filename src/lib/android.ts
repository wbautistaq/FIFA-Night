/**
 * App Android (Trusted Web Activity) que publica este sitio en Google Play.
 * El identificador del paquete es permanente una vez publicado.
 */
export const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "com.wbautistaq.torneos";

/**
 * Huellas SHA-256 de los certificados que firman la app: la llave de subida y la de Google Play
 * (Play Console → Integridad de la app → Firma de apps). Son públicas, no secretas.
 * Sin ellas Android abre la app con una barra de navegador arriba.
 */
export const ANDROID_CERT_SHA256: string[] = (process.env.ANDROID_CERT_SHA256 ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
