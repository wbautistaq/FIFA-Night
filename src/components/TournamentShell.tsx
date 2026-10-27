"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { useTournament } from "@/hooks/useTournament";
import { Bell, CalendarBlank, CaretLeft, ChartBar, House, ListNumbers, SquaresFour, TreeStructure, type Icon } from "@phosphor-icons/react";
import { ErrorState } from "@/components/ui/primitives";
import { TurnAlert } from "@/components/TurnAlert";
import { CancelledTournament } from "@/components/CancelledTournament";
import { ClaimGuestBanner } from "@/components/ClaimGuestBanner";
import { STATUS_LABEL } from "@/lib/labels";

type Ctx = ReturnType<typeof useTournament> & { snapshot: NonNullable<ReturnType<typeof useTournament>["snapshot"]>; viewer: NonNullable<ReturnType<typeof useTournament>["viewer"]>; derived: NonNullable<ReturnType<typeof useTournament>["derived"]>; id: string };
const TournamentCtx = createContext<Ctx | null>(null);

export function useT(): Ctx {
  const c = useContext(TournamentCtx);
  if (!c) throw new Error("useT debe usarse dentro de TournamentShell");
  return c;
}

const BRACKET_FORMATS = ["cup", "double_elimination", "groups_playoffs"];

type NavItem = { slug: string; label: string; Icon: Icon };

// Los formatos sin llaves muestran Estadísticas en lugar de un Bracket vacío
const navFor = (format: string): NavItem[] => [
  { slug: "", label: "Resumen", Icon: House },
  { slug: "calendario", label: "Partidos", Icon: CalendarBlank },
  { slug: "tabla", label: "Tabla", Icon: ListNumbers },
  BRACKET_FORMATS.includes(format) ? { slug: "bracket", label: "Bracket", Icon: TreeStructure } : { slug: "estadisticas", label: "Stats", Icon: ChartBar },
  { slug: "mas", label: "Más", Icon: SquaresFour },
];

const STATUS_CHIP: Record<string, string> = { in_progress: "chip-live", finished: "chip border-amber-300/50 bg-amber-300/10 text-amber-200" };

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6" role="status" aria-live="polite">
      <span className="sr-only">Cargando torneo…</span>
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-9 w-2/3" />
      <div className="skeleton h-28 w-full" />
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-16 w-full" />
    </div>
  );
}

export function TournamentShell({ id, children }: { id: string; children: ReactNode }) {
  const t = useTournament(id);
  const pathname = usePathname();
  const isTv = pathname.endsWith("/tv");

  if (t.isLoading) return <ShellSkeleton />;
  if (t.isError || !t.snapshot || !t.viewer || !t.derived) {
    const msg = t.error instanceof Error ? t.error.message : "No se pudo cargar el torneo";
    const noAccess = /acceso|unirte/i.test(msg);
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 pt-10">
        <ErrorState message={msg} onRetry={() => t.refetch()} />
        {noAccess ? <p className="text-center text-sm text-white/70">Pídele al organizador el link o QR de invitación, o <Link className="underline" href={`/login?next=/t/${id}`}>inicia sesión</Link>.</p> : null}
        <Link href="/" className="btn-secondary w-full">Ir al inicio</Link>
      </div>
    );
  }

  const ctx = { ...t, snapshot: t.snapshot, viewer: t.viewer, derived: t.derived, id } as Ctx;
  if (ctx.snapshot.tournament.status === "cancelled") return <CancelledTournament id={id} snapshot={ctx.snapshot} viewer={ctx.viewer} />;
  if (isTv) return <TournamentCtx.Provider value={ctx}>{children}</TournamentCtx.Provider>;

  const base = `/t/${id}`;
  const unread = t.notifications.filter((n) => !n.read_at).length;
  return (
    <TournamentCtx.Provider value={ctx}>
      <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-5">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/55 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Mis torneos</Link>
            <h1 className="truncate bg-gradient-to-r from-white via-white to-volt-light bg-clip-text text-[1.7rem] uppercase leading-tight text-transparent">{ctx.snapshot.tournament.name}</h1>
            <span className={`mt-1 ${STATUS_CHIP[ctx.snapshot.tournament.status] ?? "chip"}`}>
              {ctx.snapshot.tournament.status === "in_progress" ? <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-blaze" aria-hidden /> : null}
              {STATUS_LABEL[ctx.snapshot.tournament.status]}
            </span>
          </div>
          <Link href={`${base}/notificaciones`} className="btn-secondary relative !min-h-11 !w-11 !px-0" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}>
            <Bell size={22} weight={unread ? "fill" : "regular"} aria-hidden />
            {unread > 0 ? <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-blaze px-1.5 text-center text-xs font-bold leading-5 text-white shadow-[0_0_12px_rgba(244,63,94,.7)]">{unread}</span> : null}
          </Link>
        </header>
        {ctx.viewer.canClaim && ctx.viewer.participantId ? (
          <ClaimGuestBanner tournamentId={id} name={ctx.derived.participants.get(ctx.viewer.participantId)?.display_name ?? "invitado"} onDone={ctx.refresh} />
        ) : null}
        <main id="main">{children}</main>
        <TurnAlert tournamentId={id} participantId={ctx.viewer.participantId} matches={ctx.snapshot.matches} participants={ctx.derived.participants} teamOf={ctx.derived.teamOf} />
        <nav aria-label="Secciones del torneo" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),.75rem)]">
          <ul className="mx-auto flex max-w-2xl rounded-2xl border border-white/10 bg-pitch-900/85 p-1 shadow-[0_-8px_40px_-12px_rgba(139,92,246,.45)] backdrop-blur-xl">
            {navFor(ctx.snapshot.tournament.format).map((n) => {
              const href = n.slug ? `${base}/${n.slug}` : base;
              const active = n.slug ? pathname.startsWith(href) : pathname === base;
              return (
                <li key={n.slug} className="flex-1">
                  <Link href={href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold uppercase tracking-wide transition ${active ? "bg-gradient-to-b from-volt/30 to-volt/5 text-neon" : "text-white/65 hover:text-white"}`}>
                    {active ? <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-neon shadow-[0_0_10px_#2ee6ff]" aria-hidden /> : null}
                    <n.Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />{n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </TournamentCtx.Provider>
  );
}
