"use client";

import { useT } from "@/components/TournamentShell";
import { StandingsTable } from "@/components/StandingsTable";
import { ShareButton, StandingsCard } from "@/components/ShareCard";
import { EmptyState } from "@/components/ui/primitives";
import { ListNumbers, TreeStructure } from "@phosphor-icons/react";

const TB_LABEL: Record<string, string> = { points: "puntos", goal_difference: "diferencia de gol", goals_for: "goles a favor", head_to_head: "resultado directo", alphabetical: "orden alfabético" };

export default function Standings() {
  const { snapshot } = useT();
  const { standings, tournament } = snapshot;
  const groups = [...new Set(standings.map((s) => s.group_name))].sort();
  const qualifiers = tournament.format === "groups_playoffs" ? tournament.settings.qualifiers_per_group : 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">Tabla de posiciones</h2>
        {standings.length > 0 && groups.length === 1 ? (
          <ShareButton className="btn-secondary !min-h-10 !px-3 text-sm" fileName="tabla-fifa-night" text={`Así va la tabla de ${tournament.name} 🔥`} card={<StandingsCard rows={standings} />} />
        ) : null}
      </div>
      {tournament.format === "cup" || tournament.format === "double_elimination" ? (
        <EmptyState icon={TreeStructure} title="Este formato no usa tabla">Sigue el avance en la pestaña Bracket.</EmptyState>
      ) : standings.length === 0 ? (
        <EmptyState icon={ListNumbers} title="La tabla aparecerá cuando comience el torneo" />
      ) : (
        groups.map((g) => (
          <section key={g || "all"} className="space-y-2" aria-label={g ? `Grupo ${g}` : "Tabla general"}>
            {g ? <h3 className="font-bold">Grupo {g}</h3> : null}
            <StandingsTable rows={standings.filter((s) => s.group_name === g)} qualifiers={qualifiers} />
          </section>
        ))
      )}
      <p className="help">Desempates: {tournament.settings.tiebreakers.map((t) => TB_LABEL[t]).join(" → ")}. Solo cuentan resultados confirmados.</p>
    </div>
  );
}
