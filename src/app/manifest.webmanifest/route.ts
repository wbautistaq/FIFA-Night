export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id: "/",
      name: "Copa del Parche",
      short_name: "Copa Parche",
      description: "Torneos de fútbol en consola con tu parche",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#1e4331",
      theme_color: "#1e4331",
      lang: "es",
      dir: "ltr",
      categories: ["sports", "games", "entertainment"],
      prefer_related_applications: false,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
