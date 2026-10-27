/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite verificar una build de producción sin pisar la carpeta .next del servidor de desarrollo
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
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
      ],
    },
  ],
};
export default nextConfig;
