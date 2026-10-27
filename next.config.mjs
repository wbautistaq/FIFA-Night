/** @type {import('next').NextConfig} */

// Content-Security-Policy: solo se cargan scripts propios y se conecta con Supabase (API, Realtime y fotos)
// y jsDelivr (emoticonos 3D). Next.js necesita 'unsafe-inline' para sus scripts de arranque.
// En desarrollo no se aplica: el modo dev usa eval y websockets propios.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "*.supabase.co";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabase} https://cdn.jsdelivr.net`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabase} wss://${supabase} https://cdn.jsdelivr.net`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  // Permite verificar una build de producción sin pisar la carpeta .next del servidor de desarrollo
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Fotos del marcador: el teléfono las reduce antes de enviarlas, pero se deja margen sobre el 1 MB por defecto
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Solo desarrollo: permite abrir el servidor de dev desde el celular en la misma red Wi-Fi
  allowedDevOrigins: ["192.168.31.171"],
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // La cámara se usa solo vía <input capture> (app nativa), así que ninguna API sensible hace falta
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
      ],
    },
  ],
};
export default nextConfig;
