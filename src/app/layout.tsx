import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { OfflineBanner } from "@/components/ui/primitives";
import { fontVariables } from "@/lib/fonts";
import { getSiteAppearance } from "@/lib/site-appearance";
import { themeInfo } from "@/lib/themes";

export const metadata: Metadata = {
  title: { default: "Copa Parche", template: "%s · Copa Parche" },
  description: "Organiza torneos de fútbol en consola con tu parche: sorteo, fixtures, tablas, bracket y modo TV.",
  manifest: "/manifest.webmanifest",
  applicationName: "Copa Parche",
  appleWebApp: { capable: true, title: "Copa Parche", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export async function generateViewport(): Promise<Viewport> {
  const { effective } = await getSiteAppearance();
  return { themeColor: themeInfo(effective).browserColor, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { effective } = await getSiteAppearance();
  return (
    <html lang="es" data-theme={effective} className={`dark ${fontVariables}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-neon focus:px-3 focus:py-2 focus:text-onaccent">Saltar al contenido</a>
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
