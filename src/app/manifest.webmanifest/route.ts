export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "FIFA Night",
      short_name: "FIFA Night",
      description: "Torneos de FIFA / EA SPORTS FC entre amigos",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#04100a",
      theme_color: "#04100a",
      lang: "es",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
