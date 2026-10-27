"use client";

import { useState } from "react";
import { useT } from "@/components/TournamentShell";
import { PlayerChip } from "@/components/MatchRow";
import { EmptyState, useToast } from "@/components/ui/primitives";
import { savePrediction } from "@/app/actions/social";
import type { Match } from "@/lib/types";
import { CheckCircle, LockSimple, Sparkle } from "@phosphor-icons/react";

function PredictionCard({ match }: { match: Match }) {
  const { snapshot, viewer, id, refresh, derived } = useT();
  const mine = snapshot.predictions.find((p) => p.match_id === match.id && p.participant_id === viewer.participantId);
  const [winner, setWinner] = useState<string | null | undefined>(mine ? mine.predicted_winner_id : undefined);
  const [hs, setHs] = useState<string>(mine?.home_score?.toString() ?? "");
  const [as, setAs] = useState<string>(mine?.away_score?.toString() ?? "");
  const toast = useToast();
  const exact = snapshot.tournament.settings.exact_score_predictions;
  const mineMatch = viewer.participantId !== null && [match.home_id, match.away_id].includes(viewer.participantId);
  const options: [string | null, string][] = [[match.home_id, derived.participants.get(match.home_id ?? "")?.display_name ?? "Local"], [null, "Empate"], [match.away_id, derived.participants.get(match.away_id ?? "")?.display_name ?? "Visitante"]];
  return (
    <li className="card space-y-3">
      <div className="flex items-center gap-2"><PlayerChip participantId={match.home_id} /><span className="text-white/40">vs</span><PlayerChip participantId={match.away_id} align="right" /></div>
      {mineMatch ? <p className="help">No puedes predecir tus propios partidos.</p> : (
        <>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ganador">
            {options.map(([pid, label]) => <button key={label} role="radio" aria-checked={winner === pid} className={winner === pid ? "btn bg-volt !min-h-11 text-sm text-white" : "btn-secondary !min-h-11 text-sm"} onClick={() => setWinner(pid)}>{label}</button>)}
          </div>
          {exact && <div className="flex items-center justify-center gap-2"><input aria-label="Goles local" inputMode="numeric" className="input w-16 text-center" value={hs} onChange={(e) => setHs(e.target.value.replace(/\D/g, "").slice(0, 2))} /><span>-</span><input aria-label="Goles visitante" inputMode="numeric" className="input w-16 text-center" value={as} onChange={(e) => setAs(e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>}
          <button className="btn-primary w-full" disabled={winner === undefined} onClick={async () => { const r = await savePrediction(id, { match_id: match.id, predicted_winner_id: winner ?? null, home_score: exact && hs !== "" ? Number(hs) : null, away_score: exact && as !== "" ? Number(as) : null }); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "Predicción guardada"); await refresh(); } }}>{mine ? "Actualizar predicción" : "Guardar predicción"}</button>
        </>
      )}
      {toast.node}
    </li>
  );
}

export default function Predictions() {
  const { snapshot, viewer } = useT();
  if (!snapshot.tournament.settings.predictions) return <EmptyState icon={Sparkle} title="Las predicciones están desactivadas" />;
  if (!viewer.participantId) return <EmptyState icon={LockSimple} title="Solo los participantes pueden predecir" />;
  const open = snapshot.matches.filter((m) => m.status === "pending" && m.home_id && m.away_id);
  const settled = snapshot.predictions.filter((p) => p.participant_id === viewer.participantId && p.settled);
  const pts = settled.reduce((s, p) => s + p.points, 0);
  return (
    <div className="space-y-5">
      <h2 className="section-title">Predicciones</h2>
      <p className="card text-sm text-white/80">Acertar el ganador suma <strong>3</strong> puntos{snapshot.tournament.settings.exact_score_predictions ? " y el marcador exacto suma 2 más" : ""}. Llevas <strong className="text-neon">{pts}</strong> puntos.</p>
      {open.length === 0 ? <EmptyState icon={CheckCircle} title="No hay partidos abiertos para predecir" /> : <ul className="space-y-3">{open.map((m) => <PredictionCard key={m.id} match={m} />)}</ul>}
    </div>
  );
}
