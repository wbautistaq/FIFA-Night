"use client";

import Link from "next/link";
import { Bell, CaretRight, ChartBar, ChatsCircle, GearSix, Shuffle, Sliders, Sparkle, Television, UserPlus, type Icon } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";

export default function More() {
  const { id, viewer, snapshot } = useT();
  const b = `/t/${id}`;
  const status = snapshot.tournament.status;
  const items: { href: string; Icon: Icon; label: string; hint: string; show: boolean }[] = [
    { href: `${b}/estadisticas`, Icon: ChartBar, label: "Estadísticas", hint: "Goleadores, logros e historial", show: true },
    { href: `${b}/muro`, Icon: ChatsCircle, label: "Muro del torneo", hint: "Comentarios y fotos del grupo", show: snapshot.tournament.settings.wall },
    { href: `${b}/tv`, Icon: Television, label: "Modo TV", hint: "Pantalla grande para la sala", show: true },
    { href: `${b}/tv-control`, Icon: Sliders, label: "Control remoto de la TV", hint: "Elige qué se ve en la TV", show: viewer.isOrganizer },
    { href: `${b}/invitar`, Icon: UserPlus, label: "Invitar jugadores", hint: "Link y código QR", show: viewer.isOrganizer || ["registration", "draft"].includes(status) },
    { href: `${b}/sorteo`, Icon: Shuffle, label: "Sorteo de equipos", hint: "Equipos de FC 26", show: true },
    { href: `${b}/predicciones`, Icon: Sparkle, label: "Predicciones", hint: "Adivina marcadores y suma puntos", show: snapshot.tournament.settings.predictions },
    { href: `${b}/ajustes`, Icon: GearSix, label: "Ajustes del torneo", hint: "Reglas, coorganizadores y estado", show: viewer.isOrganizer },
    { href: `${b}/notificaciones`, Icon: Bell, label: "Notificaciones", hint: "Resultados, sorteos y líderes", show: true },
  ].filter((i) => i.show);
  return (
    <div className="space-y-4">
      <h2 className="section-title">Más</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(({ href, Icon: ItemIcon, label, hint }) => (
          <li key={href}>
            <Link href={href} className="card card-interactive flex min-h-16 items-center gap-3 !py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-volt/40 to-blaze/20 text-neon ring-1 ring-white/10" aria-hidden><ItemIcon size={24} weight="duotone" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block truncate text-xs text-white/60">{hint}</span></span>
              <CaretRight size={18} className="text-white/40" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
