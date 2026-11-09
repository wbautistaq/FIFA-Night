"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/TournamentShell";
import { MatchRow } from "@/components/MatchRow";
import { EmptyState, Field, useToast } from "@/components/ui/primitives";
import { addFriendly } from "@/app/actions/tournaments";
import { stageLabel } from "@/lib/labels";
import type { Match } from "@/lib/types";
import { CalendarBlank, MagnifyingGlass } from "@phosphor-icons/react";

type Filter = "all" | "pending" | "finished" | "mine";

export default function Calendar() {
  const { snapshot, viewer, id, refresh } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const toast = useToast();
  const { matches, participants, brackets, tournament } = snapshot;

  const groups = useMemo(() => {
    const visible = matches.filter((m) => {
      if (m.status === "cancelled" && m.is_bye) return false;
      if (filter === "pending") return ["pending", "live", "disputed"].includes(m.status);
      if (filter === "finished") return m.status === "finished";
      if (filter === "mine") return viewer.participantId !== null && [m.home_id, m.away_id].includes(viewer.participantId);
      return true;
    });
    const map = new Map<string, Match[]>();
    for (const m of visible) {
      const total = brackets.find((b) => (m.stage === "winners" ? b.kind === "winners" : m.stage === "losers" ? b.kind === "losers" : ["knockout"].includes(m.stage) ? ["knockout", "playoffs"].includes(b.kind) : false))?.rounds;
      const key = stageLabel(m.stage, m.round, total, m.group_name);
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()];
  }, [matches, filter, viewer.participantId, brackets]);

  const filters: [Filter, string][] = [["all", "Todos"], ["pending", "Pendientes"], ["finished", "Jugados"], ["mine", "Míos"]];

  return (
    <div className="space-y-5">
      <h2 className="section-title">Calendario</h2>
      <div role="tablist" aria-label="Filtro de partidos" className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={filter === k ? "btn bg-neon !min-h-10 text-onaccent" : "btn-secondary !min-h-10"}>{l}</button>)}
      </div>

      {tournament.format === "friendlies" && tournament.status === "in_progress" && viewer.isOrganizer && (
        <form className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); const r = await addFriendly(id, home, away); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "Amistoso creado"); setHome(""); setAway(""); await refresh(); } }}>
          <Field label="Local" htmlFor="fh"><select id="fh" className="input" value={home} onChange={(e) => setHome(e.target.value)}><option value="">Elige…</option>{participants.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></Field>
          <Field label="Visitante" htmlFor="fa"><select id="fa" className="input" value={away} onChange={(e) => setAway(e.target.value)}><option value="">Elige…</option>{participants.filter((p) => p.id !== home).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></Field>
          <button className="btn-primary self-end" disabled={!home || !away}>Crear</button>
        </form>
      )}

      {matches.length === 0 ? (
        <EmptyState icon={CalendarBlank} title="Todavía no hay calendario">{tournament.format === "friendlies" ? "Inicia el torneo y crea tus amistosos." : "El calendario se genera cuando el organizador inicia el torneo."}</EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState icon={MagnifyingGlass} title="Sin partidos para este filtro" />
      ) : (
        groups.map(([label, list]) => (
          <section key={label} aria-label={label} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">{label}</h3>
            {list.map((m) => <MatchRow key={m.id} match={m} />)}
          </section>
        ))
      )}
      {toast.node}
    </div>
  );
}
