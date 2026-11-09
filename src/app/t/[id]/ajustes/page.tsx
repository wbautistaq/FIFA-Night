"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/TournamentShell";
import { TournamentForm } from "@/components/TournamentForm";
import { ActionButton, EmptyState, useToast } from "@/components/ui/primitives";
import { cancelTournament, deleteTournament, duplicateTournament, setCoorganizer, setTournamentStatus, transferOwnership, updateTournament } from "@/app/actions/tournaments";
import { PlayerChip } from "@/components/MatchRow";
import { Crown, LockSimple } from "@phosphor-icons/react";
import { isoToColombiaInput } from "@/lib/datetime";

export default function Settings() {
  const { id, snapshot, viewer, refresh } = useT();
  const router = useRouter();
  const toast = useToast();
  const t = snapshot.tournament;
  if (!viewer.isOrganizer) return <EmptyState icon={LockSimple} title="Solo los organizadores pueden administrar el torneo" />;
  const beforeDraw = ["draft", "registration"].includes(t.status) && !t.draw_confirmed;
  const isOwner = viewer.userId === t.owner_id;
  const owner = snapshot.participants.find((p) => p.user_id === t.owner_id);
  // Con cuenta y distintos del dueño: los únicos que pueden ser coorganizadores
  const others = snapshot.participants.filter((p) => p.user_id && p.user_id !== t.owner_id && (isOwner || p.role === "coorganizer"));

  return (
    <div className="space-y-6">
      <h2 className="section-title">Administrar torneo</h2>
      {!beforeDraw && <p className="card border-amber-400/40 text-sm text-amber-100">El sorteo ya se confirmó o el torneo está en marcha: la configuración está bloqueada para mantener el fixture.  Si necesitas otra configuración, duplica el torneo.</p>}
      {beforeDraw ? (
        <div className="card">
          <TournamentForm
            initial={{ name: t.name, starts_at: isoToColombiaInput(t.starts_at), platform: t.platform, format: t.format, max_players: t.max_players, rules: t.rules, settings: t.settings }}
            submitLabel="Guardar cambios"
            onSubmit={async (v) => { const r = await updateTournament(id, v); if (!r.ok) return r.error; toast.show("success", "Ajustes guardados"); await refresh(); return null; }}
          />
        </div>
      ) : null}

      <section className="card space-y-3" aria-labelledby="co-h">
        <h3 id="co-h" className="font-bold">Equipo organizador</h3>
        <p className="text-sm text-white/70">Los coorganizadores pueden registrar y corregir resultados, invitar, sortear, sacar jugadores y moderar el muro. Solo el dueño nombra coorganizadores y puede entregar el torneo.</p>
        {owner ? (
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><PlayerChip participantId={owner.id} /></div><span className="chip border-amber-300/50 text-amber-300"><Crown size={14} weight="fill" aria-hidden />Dueño</span></div>
        ) : null}
        <ul className="space-y-2">{others.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1"><PlayerChip participantId={p.id} /></div>
            {p.role === "coorganizer" && !isOwner && <span className="chip">Coorganizador</span>}
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary !min-h-10" onClick={async () => { const r = await setCoorganizer(id, p.id, p.role !== "coorganizer"); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>{p.role === "coorganizer" ? "Quitar rol" : "Hacer coorganizador"}</button>
                {p.role === "coorganizer" && (
                  <ActionButton className="btn-ghost !min-h-10" confirm={`¿Entregar el torneo a ${p.nickname || p.display_name}? Pasará a ser el dueño y tú quedarás como coorganizador.`}
                    onAction={async () => { const r = await transferOwnership(id, p.id); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "Torneo entregado"); await refresh(); } }}>Entregar torneo</ActionButton>
                )}
              </div>
            )}
          </li>
        ))}</ul>
        {isOwner && <p className="help">Solo se pueden nombrar jugadores que entraron con cuenta.</p>}
      </section>

      <section className="card space-y-3" aria-labelledby="act-h">
        <h3 id="act-h" className="font-bold">Acciones</h3>
        <div className="flex flex-wrap gap-2">
          <ActionButton className="btn-secondary" onAction={async () => { const r = await duplicateTournament(id, `${t.name} (copia)`); if (!r.ok) toast.show("error", r.error); else router.push(`/t/${r.data?.id}`); }}>Duplicar torneo</ActionButton>
          {isOwner && t.status === "registration" && snapshot.matches.length === 0 && <ActionButton className="btn-secondary" confirm="El link de invitación dejará de aceptar jugadores. ¿Volver a borrador?" onAction={async () => { const r = await setTournamentStatus(id, "draft"); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>Volver a borrador</ActionButton>}
          {isOwner && t.status === "draft" && <ActionButton className="btn-primary" onAction={async () => { const r = await setTournamentStatus(id, "registration"); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>Abrir inscripción</ActionButton>}
          {isOwner && t.status === "draft" && <ActionButton className="btn-danger" confirm="¿Eliminar este borrador para siempre?" onAction={async () => { const r = await deleteTournament(id); if (!r.ok) toast.show("error", r.error); else router.replace("/"); }}>Eliminar borrador</ActionButton>}
          {isOwner && ["registration", "draw", "in_progress"].includes(t.status) && <ActionButton className="btn-danger" confirm="¿Cancelar el torneo? No se puede deshacer." onAction={async () => { const r = await cancelTournament(id); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>Cancelar torneo</ActionButton>}
        </div>
      </section>
      {toast.node}
    </div>
  );
}
