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
const KNOWN_CERTS = [
  // Llave de subida generada con PWABuilder (10 nov 2026)
  "62:19:C0:41:27:D0:72:14:C3:97:58:1E:EA:4B:6D:B6:7C:56:E1:C5:FB:95:6A:01:11:B7:83:83:BA:7C:5D:EB",
  // Pendiente: huella de la llave de firma de Google Play (Play Console → Integridad de la app)
];

export const ANDROID_CERT_SHA256: string[] = [...KNOWN_CERTS, ...(process.env.ANDROID_CERT_SHA256 ?? "").split(",")]
  .map((s) => s.trim().toUpperCase())
  .filter((s, i, all) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s) && all.indexOf(s) === i);
