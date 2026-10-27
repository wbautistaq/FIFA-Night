"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, Trophy, UserCircle } from "@phosphor-icons/react";

const items = [
  { href: "/", label: "Torneos", Icon: Trophy },
  { href: "/historial", label: "Historial", Icon: ChartBar },
  { href: "/perfil", label: "Perfil", Icon: UserCircle },
];

/** Barra inferior flotante de la zona personal (mismo estilo que la del torneo). */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),.75rem)]">
      <ul className="mx-auto flex max-w-2xl rounded-2xl border border-white/10 bg-pitch-900/85 p-1 shadow-[0_-8px_40px_-12px_rgba(139,92,246,.45)] backdrop-blur-xl">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide transition ${active ? "bg-gradient-to-b from-volt/30 to-volt/5 text-neon" : "text-white/65 hover:text-white"}`}>
                {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-neon shadow-[0_0_10px_#2ee6ff]" aria-hidden /> : null}
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
