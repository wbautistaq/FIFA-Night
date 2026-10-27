"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, Copy, Prohibit, Trash } from "@phosphor-icons/react";
import { ActionButton, useToast } from "@/components/ui/primitives";
import { deleteTournament, duplicateTournament } from "@/app/actions/tournaments";
import type { Snapshot, Viewer } from "@/lib/types";

/**
 * Un torneo cancelado no muestra tabla, estadísticas ni calendario: sus resultados no cuentan
 * en el historial ni en el ranking. Solo queda duplicarlo para jugarlo de nuevo o eliminarlo.
 */
export function CancelledTournament({ id, snapshot, viewer }: { id: string; snapshot: Snapshot; viewer: Viewer }) {
  const router = useRouter();
  const toast = useToast();
  const t = snapshot.tournament;
  const isOwner = viewer.kind === "user" && viewer.userId === t.owner_id;
  const played = snapshot.results.filter((r) => r.status === "confirmed").length;

  return (
    <div className="mx-auto min-h-dvh max-w-md space-y-5 px-4 pt-6">
      <Link href="/" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/55 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Mis torneos</Link>
      <section className="card space-y-3 text-center" aria-labelledby="cx-h">
        <Prohibit size={48} weight="duotone" className="mx-auto text-blaze-light" aria-hidden />
        <p className="eyebrow !text-blaze-light">Torneo cancelado</p>
        <h1 id="cx-h" className="text-2xl uppercase">{t.name}</h1>
        <p className="text-sm text-white/70">
          {played ? `Se alcanzaron a jugar ${played} ${played === 1 ? "partido" : "partidos"}, pero ` : ""}sus resultados no cuentan en el historial, las rivalidades ni el ranking.
        </p>
      </section>

      {viewer.isOrganizer && (
        <div className="grid gap-2">
          <ActionButton className="btn-primary" onAction={async () => {
            const r = await duplicateTournament(id, t.name);
            if (!r.ok) return toast.show("error", r.error);
            router.push(`/t/${r.data?.id}`);
          }}><Copy size={20} aria-hidden />Crear uno igual (misma configuración)</ActionButton>
          {isOwner && (
            <ActionButton className="btn-danger" confirm={`¿Eliminar "${t.name}" para siempre? Se borran partidos, resultados, fotos y comentarios.`} onAction={async () => {
              const r = await deleteTournament(id);
              if (!r.ok) return toast.show("error", r.error);
              router.replace("/");
              router.refresh();
            }}><Trash size={20} aria-hidden />Eliminar torneo</ActionButton>
          )}
        </div>
      )}
      <Link href="/" className="btn-ghost w-full">Volver al inicio</Link>
      {toast.node}
    </div>
  );
}
