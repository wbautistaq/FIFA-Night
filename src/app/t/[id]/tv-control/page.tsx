"use client";

import Link from "next/link";
import { useT } from "@/components/TournamentShell";
import { EmptyState, useToast } from "@/components/ui/primitives";
import { setTvView } from "@/app/actions/tournaments";
import { ArrowsClockwise, CheckCircle, ListNumbers, LockSimple, Medal, SoccerBall, TreeStructure, type Icon } from "@phosphor-icons/react";

const VIEWS: readonly (readonly [string, string, Icon])[] = [["auto", "Automático", ArrowsClockwise], ["next", "Próximo partido", SoccerBall], ["standings", "Tabla", ListNumbers], ["bracket", "Bracket", TreeStructure], ["scorers", "Goleadores", Medal], ["results", "Últimos resultados", CheckCircle]];

export default function TvControl() {
  const { id, snapshot, viewer, refresh } = useT();
  const toast = useToast();
  if (!viewer.isOrganizer) return <EmptyState icon={LockSimple} title="Solo el organizador controla la TV" />;
  const current = snapshot.tournament.tv_state?.view ?? "auto";
  return (
    <div className="space-y-4">
      <h2 className="section-title">Control remoto de la TV</h2>
      <p className="text-sm text-white/75">Abre el <Link className="font-semibold text-neon underline" href={`/t/${id}/tv`} target="_blank">Modo TV</Link> en la pantalla grande y elige desde aquí qué mostrar.</p>
      <div className="grid grid-cols-2 gap-2">{VIEWS.map(([v, l, ViewIcon]) => (
        <button key={v} aria-pressed={current === v} className={current === v ? "btn flex-col !min-h-24 border border-neon bg-neon/15 text-neon shadow-glow-neon" : "btn-secondary flex-col !min-h-24"} onClick={async () => { const r = await setTvView(id, v); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "TV actualizada"); await refresh(); } }}>
          <ViewIcon size={28} weight={current === v ? "fill" : "duotone"} aria-hidden />{l}
        </button>
      ))}</div>
      {toast.node}
    </div>
  );
}
