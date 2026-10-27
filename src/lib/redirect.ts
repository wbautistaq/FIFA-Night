/**
 * Ruta interna segura para redirigir tras iniciar sesión. Rechaza lo que el navegador trataría como
 * otro dominio: "//evil.com", "/\evil.com" (la barra invertida equivale a "/") y caracteres de control.
 */
export function safeInternalPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f\\]/.test(raw)) return "/";
  return raw;
}
