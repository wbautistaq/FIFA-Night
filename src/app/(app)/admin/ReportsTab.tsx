"use client";

import { useState } from "react";
import clsx from "clsx";
import { Flag } from "@phosphor-icons/react";
import { ActionButton, EmptyState, RemoteImage } from "@/components/ui/primitives";
import type { ReportAction, ReportRow } from "@/app/actions/moderation";
import { REPORT_REASONS } from "@/lib/moderation";
import { formatFullDateTime } from "@/lib/datetime";

/** Bandeja de reportes de publicaciones y jugadores. La atienden administradores y moderadores. */
export function ReportsTab({ reports, onResolve }: { reports: ReportRow[] | null; onResolve: (r: ReportRow, action: ReportAction) => Promise<void> }) {
  const [view, setView] = useState<"open" | "closed">("open");
  if (!reports) return <EmptyState title="Falta un paso en la base de datos"><p className="text-sm text-white/70">Aplica la migración 22 (reportes y bloqueos) en Supabase.</p></EmptyState>;
  const open = reports.filter((r) => r.status === "open");
  const list = view === "open" ? open : reports.filter((r) => r.status !== "open");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Reportes" className="grid grid-cols-2 gap-1 rounded-xl bg-white/[.04] p-1">
        {([["open", `Abiertos (${open.length})`], ["closed", "Historial"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={clsx("min-h-11 rounded-lg text-sm font-semibold", view === k ? "bg-volt/30 text-white" : "text-white/65")}>{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Flag size={32} weight="duotone" />} title={view === "open" ? "No hay reportes pendientes" : "Aún no hay reportes atendidos"} />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip">{r.kind === "post" ? "Publicación" : "Jugador"}</span>
                <span className="chip-live">{REPORT_REASONS[r.reason] ?? r.reason}</span>
                {r.status !== "open" && <span className="chip">{r.resolution}</span>}
              </div>
              <div className="text-sm">
                <p><span className="text-white/60">Reportado:</span> <b>{r.reportedName ?? "—"}</b>{r.reportedUserId ? "" : <span className="text-white/50"> (invitado)</span>}</p>
                <p><span className="text-white/60">Torneo:</span> {r.tournamentId ? <a href={`/t/${r.tournamentId}`} className="underline hover:text-neon">{r.tournamentName ?? "Ver"}</a> : r.tournamentName ?? "—"}</p>
                <p className="text-white/60">Por {r.reporterName ?? "—"} · {formatFullDateTime(r.createdAt)}</p>
              </div>
              {r.details && <p className="rounded-lg bg-white/5 p-2 text-sm"><span className="text-white/60">Comentario: </span>{r.details}</p>}
              {r.kind === "post" && (
                <blockquote className="space-y-2 border-l-2 border-white/25 pl-3">
                  <p className="whitespace-pre-wrap break-words text-sm">{r.postBody}</p>
                  {r.postImageUrl && <RemoteImage src={r.postImageUrl} alt="Imagen reportada" className="max-h-56 rounded-lg object-cover" />}
                  {!r.postId && <p className="text-xs text-white/50">La publicación ya fue eliminada.</p>}
                </blockquote>
              )}
              {r.status === "open" && (
                <div className="grid grid-cols-2 gap-2">
                  {r.kind === "post" && r.postId && (
                    <ActionButton className="btn-danger !min-h-11 text-sm" confirm="¿Eliminar la publicación? No se puede deshacer." onAction={() => onResolve(r, "delete_post")}>Eliminar publicación</ActionButton>
                  )}
                  {r.reportedUserId && (
                    <ActionButton className="btn-secondary !min-h-11 text-sm" confirm={`¿Bloquear la cuenta de ${r.reportedName ?? "este jugador"}? No podrá entrar hasta que la desbloqueen en Usuarios.`} onAction={() => onResolve(r, "ban_user")}>Bloquear cuenta</ActionButton>
                  )}
                  <ActionButton className="btn-secondary !min-h-11 text-sm" onAction={() => onResolve(r, "resolve")}>Resuelto</ActionButton>
                  <ActionButton className="btn-ghost !min-h-11 text-sm" onAction={() => onResolve(r, "dismiss")}>Descartar</ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
