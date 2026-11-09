"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/TournamentShell";
import { PlayerChip } from "@/components/MatchRow";
import { ActionButton, EmptyState, useToast } from "@/components/ui/primitives";
import { answerReport, clearResult, reportResult, saveOfficialResult, scheduleMatch, startMatch } from "@/app/actions/results";
import { resultInputSchema } from "@/lib/schemas";
import { stageLabel } from "@/lib/labels";
import { ResultCard, ShareButton } from "@/components/ShareCard";
import { MatchExtras } from "@/components/MatchExtras";
import { CaretLeft, HourglassMedium, Question, Star } from "@phosphor-icons/react";
import { DateTimeField } from "@/components/DateTimeField";
import { colombiaInputToIso, isoToColombiaInput } from "@/lib/datetime";

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-white/60">{label}</span>
      <button type="button" className="btn-secondary !min-h-14 w-16 text-2xl" aria-label={`Sumar gol a ${label}`} onClick={() => onChange(Math.min(99, value + 1))}>＋</button>
      <input aria-label={`Goles de ${label}`} inputMode="numeric" className="input w-16 text-center text-3xl font-black" value={value} onChange={(e) => onChange(Math.max(0, Math.min(99, Number(e.target.value.replace(/\D/g, "")) || 0)))} />
      <button type="button" className="btn-secondary !min-h-14 w-16 text-2xl" aria-label={`Restar gol a ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>－</button>
    </div>
  );
}

export default function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const { snapshot, viewer, derived, id, refresh } = useT();
  const toast = useToast();
  const match = snapshot.matches.find((m) => m.id === matchId);
  const existing = derived.resultOf.get(matchId);
  const [h, setH] = useState(existing?.home_score ?? 0);
  const [a, setA] = useState(existing?.away_score ?? 0);
  const [hp, setHp] = useState(existing?.home_pens ?? 0);
  const [ap, setAp] = useState(existing?.away_pens ?? 0);
  const [mvp, setMvp] = useState<string | null>(match?.mvp_id ?? null);
  const [comeback, setComeback] = useState<string | null>(existing?.comeback_by ?? null);
  const [correcting, setCorrecting] = useState(false);

  const knockout = match ? ["knockout", "winners", "losers", "grand_final", "third_place"].includes(match.stage) : false;
  const needsPens = h === a && knockout;
  const optionalPens = h === a && !knockout && false;
  const input = useMemo(() => ({ match_id: matchId, home_score: h, away_score: a, home_pens: needsPens || optionalPens ? hp : null, away_pens: needsPens || optionalPens ? ap : null, mvp_id: mvp, comeback_by: comeback }), [matchId, h, a, hp, ap, mvp, comeback, needsPens, optionalPens]);
  const validation = resultInputSchema.safeParse(input);

  if (!match) return <EmptyState icon={Question} title="Partido no encontrado" />;
  const total = snapshot.brackets.find((b) => ["knockout", "playoffs"].includes(b.kind))?.rounds;
  const isPlayer = viewer.participantId !== null && [match.home_id, match.away_id].includes(viewer.participantId);
  const status = existing?.status;
  const reportedByMe = existing?.reported_by === viewer.participantId;
  const canOfficial = viewer.isOrganizer && snapshot.tournament.status === "in_progress" && match.home_id && match.away_id;
  const canReport = !viewer.isOrganizer && isPlayer && snapshot.tournament.settings.player_reporting && !existing && snapshot.tournament.status === "in_progress";
  const locked = status === "confirmed" && !correcting;

  const done = async (r: { ok: boolean; error?: string }, msg: string) => {
    if (!r.ok) return toast.show("error", r.error ?? "Error");
    // Primero se recargan los datos: así Calendario y Tabla ya están al día cuando el usuario ve el aviso
    await refresh();
    setCorrecting(false);
    toast.show("success", msg);
  };

  const participantsOpt = [match.home_id, match.away_id].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <Link href={`/t/${id}/calendario`} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Calendario</Link>
      <h2 className="section-title">{stageLabel(match.stage, match.round, total, match.group_name)}</h2>
      <div className="card flex items-center gap-3"><PlayerChip participantId={match.home_id} /><span className="text-white/50">vs</span><PlayerChip participantId={match.away_id} align="right" /></div>

      {status === "confirmed" && locked && (
        <div className="card text-center" role="status">
          <p className="eyebrow">Resultado final</p>
          <p className="mt-1 font-display text-6xl tabular-nums drop-shadow-[0_0_18px_rgb(var(--accent)/.35)]">{existing?.home_score}<span className="mx-2 text-white/40">–</span>{existing?.away_score}</p>
          {existing?.home_pens != null && <p className="text-sm text-white/70">Penales: {existing.home_pens} - {existing.away_pens}</p>}
          {match.mvp_id ? <p className="mt-2 inline-flex items-center gap-1 text-sm"><Star size={16} weight="fill" className="text-amber-300" aria-hidden />MVP: {derived.participants.get(match.mvp_id)?.display_name}</p> : null}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ShareButton fileName="resultado-fifa-night" text={`${derived.participants.get(match.home_id ?? "")?.display_name ?? ""} ${existing?.home_score}-${existing?.away_score} ${derived.participants.get(match.away_id ?? "")?.display_name ?? ""} ⚽`} card={<ResultCard match={match} />} />
            {canOfficial && <button className="btn-secondary" onClick={() => setCorrecting(true)}>Corregir resultado</button>}
          </div>
        </div>
      )}

      {status === "reported" && (
        <div className="card space-y-3 border-amber-400/50" role="status">
          <p className="font-semibold text-amber-300">Resultado reportado: {existing?.home_score} - {existing?.away_score}{existing?.home_pens != null ? ` (pen. ${existing.home_pens}-${existing.away_pens})` : ""}</p>
          {isPlayer && !reportedByMe && !viewer.isOrganizer ? (
            <div className="flex gap-2">
              <ActionButton className="btn-primary flex-1" onAction={async () => done(await answerReport(matchId, "confirmed"), "Resultado confirmado")}>Confirmar</ActionButton>
              <ActionButton className="btn-danger flex-1" onAction={async () => done(await answerReport(matchId, "disputed"), "Resultado disputado")}>No es correcto</ActionButton>
            </div>
          ) : reportedByMe ? <p className="text-sm text-white/70">Esperando que tu rival lo confirme.</p> : null}
          {viewer.isOrganizer && <div className="flex gap-2"><ActionButton className="btn-primary flex-1" onAction={async () => done(await saveOfficialResult({ ...input, home_score: existing?.home_score ?? 0, away_score: existing?.away_score ?? 0, home_pens: existing?.home_pens ?? null, away_pens: existing?.away_pens ?? null }, true), "Resultado confirmado")}>Confirmar como organizador</ActionButton><ActionButton className="btn-ghost" onAction={async () => done(await clearResult(matchId), "Resultado anulado")}>Anular</ActionButton></div>}
        </div>
      )}

      {status === "disputed" && (
        <div className="card border-red-400/50" role="alert">
          <p className="font-semibold text-red-300">Resultado en disputa ({existing?.home_score} - {existing?.away_score})</p>
          <p className="text-sm text-white/70">El organizador debe resolverlo registrando el marcador oficial.</p>
          {viewer.isOrganizer && <ActionButton className="btn-secondary mt-3" onAction={async () => done(await clearResult(matchId), "Disputa reiniciada")}>Reabrir partido</ActionButton>}
        </div>
      )}

      {(canOfficial && (!existing || existing.status === "disputed" ? status !== "disputed" : correcting)) || canReport ? (
        <section className="card space-y-5" aria-labelledby="reg-h">
          <h3 id="reg-h" className="text-lg uppercase">{canReport ? "Reportar resultado" : correcting ? "Corregir resultado" : "Registrar resultado"}</h3>
          <div className="flex items-start justify-center gap-6">
            <Stepper label={derived.participants.get(match.home_id ?? "")?.display_name ?? "Local"} value={h} onChange={setH} />
            <span className="mt-16 text-2xl text-white/40">-</span>
            <Stepper label={derived.participants.get(match.away_id ?? "")?.display_name ?? "Visitante"} value={a} onChange={setA} />
          </div>
          {needsPens && (
            <div className="space-y-2 rounded-xl bg-white/5 p-3">
              <p className="text-sm font-semibold">Empate: define los penales</p>
              <div className="flex items-center justify-center gap-6"><Stepper label="Penales local" value={hp} onChange={setHp} /><Stepper label="Penales visitante" value={ap} onChange={setAp} /></div>
            </div>
          )}
          {!validation.success && <p role="alert" className="error-text">{validation.error.issues[0]?.message}</p>}
          {canOfficial && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">MVP del partido<select className="input mt-1" value={mvp ?? ""} onChange={(e) => setMvp(e.target.value || null)}><option value="">Sin MVP</option>{participantsOpt.map((pid) => <option key={pid} value={pid}>{derived.participants.get(pid)?.display_name}</option>)}</select></label>
              <label className="block text-sm">Remontada de<select className="input mt-1" value={comeback ?? ""} onChange={(e) => setComeback(e.target.value || null)}><option value="">Nadie</option>{participantsOpt.map((pid) => <option key={pid} value={pid}>{derived.participants.get(pid)?.display_name}</option>)}</select></label>
            </div>
          )}
          <div className="flex gap-2">
            {correcting && <button className="btn-ghost" onClick={() => setCorrecting(false)}>Cancelar</button>}
            <ActionButton className="btn-primary flex-1" disabled={!validation.success} confirm={correcting ? "Esto modifica un resultado finalizado y recalcula tabla y bracket. ¿Confirmas la corrección?" : undefined}
              onAction={async () => done(canReport ? await reportResult(input) : await saveOfficialResult(input, correcting), canReport ? "Resultado enviado a tu rival" : "Resultado guardado")}>
              {canReport ? "Enviar a mi rival" : correcting ? "Guardar corrección" : "Guardar resultado"}
            </ActionButton>
          </div>
        </section>
      ) : null}

      {viewer.isOrganizer && match.status === "pending" && !existing && snapshot.tournament.status === "in_progress" && match.home_id && match.away_id && (
        <div className="flex flex-wrap items-end gap-2">
          <ActionButton className="btn-secondary" onAction={async () => done(await startMatch(matchId), "Partido en juego")}>▶ Marcar en juego</ActionButton>
          <div className="text-sm"><span id="agendar-label">Agendar</span><div className="mt-1" role="group" aria-labelledby="agendar-label"><DateTimeField defaultValue={match.scheduled_at ? isoToColombiaInput(match.scheduled_at) : ""} onChange={async (value) => done(await scheduleMatch(matchId, value ? colombiaInputToIso(value) : null), "Horario actualizado")} /></div></div>
        </div>
      )}
      <MatchExtras match={match} />
      {!canOfficial && !canReport && !existing && <EmptyState icon={HourglassMedium} title="Aún sin resultado">{isPlayer && !snapshot.tournament.settings.player_reporting ? "El organizador registra los resultados de este torneo." : "Cuando se juegue, el resultado aparecerá aquí."}</EmptyState>}
      {toast.node}
    </div>
  );
}
