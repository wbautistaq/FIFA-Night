import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarBlank, CaretRight, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { FORMAT_LABEL, STATUS_LABEL, PLATFORM_LABEL } from "@/lib/labels";
import type { Tournament } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  in_progress: "border-blaze/50 bg-blaze/15 text-blaze-light",
  finished: "border-amber-300/50 bg-amber-300/10 text-amber-200",
  cancelled: "border-white/15 bg-white/5 text-white/55",
};

export function TournamentCard({ t, players }: { t: Pick<Tournament, "id" | "name" | "status" | "format" | "platform" | "starts_at">; players?: number }) {
  return (
    <Link href={`/t/${t.id}`} className="card card-interactive group block overflow-hidden">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-neon via-volt to-blaze" aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{FORMAT_LABEL[t.format]} · {PLATFORM_LABEL[t.platform]}</p>
          <h3 className="mt-0.5 truncate text-lg uppercase leading-tight">{t.name}</h3>
        </div>
        <span className={`chip shrink-0 ${STATUS_STYLE[t.status] ?? ""}`}>{STATUS_LABEL[t.status]}</span>
      </div>
      <div className="mt-3 flex items-center gap-4 pl-1 text-xs text-white/65">
        <span className="inline-flex items-center gap-1"><CalendarBlank size={14} aria-hidden />{format(new Date(t.starts_at), "EEE d MMM, HH:mm", { locale: es })}</span>
        {players !== undefined ? <span className="inline-flex items-center gap-1"><UsersThree size={14} aria-hidden />{players} jugadores</span> : null}
        <CaretRight size={16} className="ml-auto text-white/40 transition group-hover:translate-x-0.5 group-hover:text-neon" aria-hidden />
      </div>
    </Link>
  );
}
