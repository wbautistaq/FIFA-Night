/** Sanitiza texto del muro: sin HTML, sin caracteres de control, espacios normalizados. */
export function sanitizeText(input: string, max = 500): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Solo permite URLs https de imágenes alojadas en Supabase Storage. */
export function safeImageUrl(url: string | null | undefined, supabaseUrl: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    if (u.host !== base.host) return null;
    if (!u.pathname.includes("/storage/v1/object/")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
