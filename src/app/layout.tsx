import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Chakra_Petch, Russo_One } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { OfflineBanner } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: { default: "FIFA Night", template: "%s · FIFA Night" },
  description: "Organiza torneos de FIFA / EA SPORTS FC entre amigos: sorteo, fixtures, tablas, bracket y modo TV.",
  manifest: "/manifest.webmanifest",
  applicationName: "FIFA Night",
  appleWebApp: { capable: true, title: "FIFA Night", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#07061a", width: "device-width", initialScale: 1, viewportFit: "cover" };

// Russo One para títulos y marcadores; Chakra Petch (técnica, legible) para el texto
const display = Russo_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-display" });
const sans = Chakra_Petch({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap", variable: "--font-sans" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`dark ${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-black">Saltar al contenido</a>
        <Providers>
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
