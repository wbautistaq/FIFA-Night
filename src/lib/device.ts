/** Con la app abierta, Supabase renueva la sesión cada hora: actividad en ese margen cuenta como "en línea". */
export const ONLINE_WINDOW_MS = 65 * 60 * 1000;

export interface Device {
  kind: "phone" | "tablet" | "desktop" | "unknown";
  /** "iPhone · Safari", "Windows · Chrome"… */
  label: string;
}

/** Resume el user-agent de una sesión en algo legible. No pretende ser exacto: solo orientar. */
export function describeDevice(ua: string | null | undefined): Device {
  if (!ua) return { kind: "unknown", label: "Dispositivo desconocido" };
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua)) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /CrOS/.test(ua) ? "Chromebook"
    : /Linux/.test(ua) ? "Linux"
    : null;
  // El orden importa: Edge, Samsung y Opera también dicen "Chrome"; Chrome también dice "Safari"
  const browser =
    /Edg(A|iOS)?\//.test(ua) ? "Edge"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /node|undici|axios|curl/i.test(ua) ? "Servidor"
    : null;
  const kind: Device["kind"] =
    os === "iPhone" || (os === "Android" && /Mobile/.test(ua)) ? "phone"
    : os === "iPad" || os === "Android" ? "tablet"
    : os ? "desktop"
    : "unknown";
  const label = [os, browser].filter(Boolean).join(" · ") || "Dispositivo desconocido";
  return { kind, label };
}
