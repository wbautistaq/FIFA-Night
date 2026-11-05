"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowCounterClockwise, Clock, GameController, Megaphone, Minus, Play, Plus, Robot, Television } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";
import { PlayerChip } from "@/components/MatchRow";
import { PushToggle } from "@/components/PushToggle";
import { ActionButton, EmptyState, Toggle, useToast } from "@/components/ui/primitives";
import { buildLiveBoard, playerTurn, type QueueMatch } from "@/lib/engine/queue";
import { callMatch, setStations, uncallMatch } from "@/app/actions/live";
import { startMatch } from "@/app/actions/results";
import { formatTime } from "@/lib/datetime";

const AUTO_KEY = (id: string) => `fn_autopilot_${id}`;
const minutesAgo = (iso: string | null) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : 0);
const clock = (minutes: number) => formatTime(Date.now() + minutes * 60000);

function Versus({ m }: { m: QueueMatch }) {
  return (
    <div className="flex items-center gap-2">
      <PlayerChip participantId={m.home_id} />
      <span className="font-display text-xs text-white/40">VS</span>
      <PlayerChip participantId={m.away_id} align="right" />
    </div>
  );
}

/** Noche en vivo: varias consolas a la vez, cola de partidos y llamado "te toca jugar". */
export default function LiveNight() {
  const { id, snapshot, viewer, refresh } = useT();
  const { tournament: t, matches, results } = snapshot;
  const toast = useToast();
  const [, tick] = useState(0);
  const [autopilot, setAutopilot] = useState(false);
  const calling = useRef(new Set<string>());

  const board = useMemo(() => buildLiveBoard(matches, results, t.stations ?? 1), [matches, results, t.stations]);
  const turn = viewer.participantId ? playerTurn(board, viewer.participantId) : { kind: "none" as const };
  const running = t.status === "in_progress";
  const busyStations = board.stations.filter((s) => s.match).length;

  // Refresca los "hace N min" y las horas estimadas
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { try { setAutopilot(localStorage.getItem(AUTO_KEY(id)) === "1"); } catch { /* sin almacenamiento */ } }, [id]);

  async function call(matchId: string, station: number, quiet = false) {
    if (calling.current.has(matchId)) return;
    calling.current.add(matchId);
    const r = await callMatch(matchId, station);
    calling.current.delete(matchId);
    if (!r.ok) { if (!quiet) toast.show("error", r.error); return; }
    if (!quiet) toast.show("success", `Llamados a la consola ${station}`);
    await refresh();
  }

  // Piloto automático: en cuanto una consola queda libre, el organizador llama al siguiente partido
  useEffect(() => {
    if (!autopilot || !viewer.isOrganizer || !running) return;
    for (const s of board.stations) if (!s.match && s.suggestion) void call(s.suggestion.id, s.station, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- call usa refresh/toast estables; reaccionar al tablero basta
  }, [autopilot, board, viewer.isOrganizer, running]);

  async function act(p: Promise<{ ok: boolean; error?: string }>, success: string) {
    const r = await p;
    if (!r.ok) return toast.show("error", r.error ?? "Error");
    toast.show("success", success);
    await refresh();
  }

  if (!running) {
    return <EmptyState icon={GameController} title="La noche aún no empieza">Cuando el torneo esté en curso, aquí verás qué se juega en cada consola y quién sigue.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Noche en vivo</p>
        <h2 className="section-title">Consolas y turnos</h2>
      </div>

      {viewer.participantId && turn.kind !== "none" && (
        <section aria-live="polite" className={clsx("card-glow !py-4 text-center", (turn.kind === "called" || turn.kind === "playing") && "border-neon/60 shadow-glow-neon")}>
          {turn.kind === "called" && <p className="font-display text-2xl uppercase text-neon">¡Te toca! Ve a la consola {turn.station}</p>}
          {turn.kind === "playing" && <p className="font-display text-2xl uppercase text-neon">Estás jugando en la consola {turn.station}</p>}
          {turn.kind === "next" && <p className="font-display text-xl uppercase">Eres el siguiente en la consola {turn.station}</p>}
          {turn.kind === "queued" && <p className="font-display text-xl uppercase">{turn.ahead === 1 ? "Falta 1 partido" : `Faltan ${turn.ahead} partidos`} para tu turno</p>}
          {turn.kind === "queued" && <p className="mt-1 text-sm text-white/65">Más o menos a las {clock(Math.ceil(turn.ahead / board.stations.length) * board.avgMinutes)}</p>}
        </section>
      )}

      {viewer.participantId ? <PushToggle tournamentId={id} /> : null}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card !p-3"><p className="font-display text-2xl text-neon">{busyStations}/{board.stations.length}</p><p className="text-[11px] uppercase tracking-wide text-white/60">Consolas en uso</p></div>
        <div className="card !p-3"><p className="font-display text-2xl">{board.queue.length + board.stations.filter((s) => s.suggestion).length}</p><p className="text-[11px] uppercase tracking-wide text-white/60">En cola</p></div>
        <div className="card !p-3"><p className="font-display text-2xl">{board.etaMinutes ? clock(board.etaMinutes) : "—"}</p><p className="text-[11px] uppercase tracking-wide text-white/60">Fin estimado</p></div>
      </div>

      {viewer.isOrganizer && (
        <section className="card space-y-3" aria-labelledby="cfg-h">
          <h3 id="cfg-h" className="text-lg uppercase">Organizar</h3>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold"><Television size={22} weight="duotone" className="text-neon" aria-hidden />Consolas</span>
            <div className="flex items-center gap-2">
              <ActionButton className="btn-secondary !min-h-11 !w-11 !px-0" aria-label="Quitar una consola" disabled={t.stations <= 1} onAction={() => act(setStations(id, t.stations - 1), "Consola quitada")}><Minus size={18} weight="bold" aria-hidden /></ActionButton>
              <span className="w-8 text-center font-display text-2xl" aria-live="polite">{t.stations}</span>
              <ActionButton className="btn-secondary !min-h-11 !w-11 !px-0" aria-label="Agregar una consola" disabled={t.stations >= 8} onAction={() => act(setStations(id, t.stations + 1), "Consola agregada")}><Plus size={18} weight="bold" aria-hidden /></ActionButton>
            </div>
          </div>
          <Toggle id="autopilot" label="Piloto automático" help="Llama al siguiente partido en cuanto se libera una consola (con esta pantalla abierta)" checked={autopilot}
            onChange={(v) => { setAutopilot(v); try { localStorage.setItem(AUTO_KEY(id), v ? "1" : "0"); } catch { /* sin almacenamiento */ } }} />
        </section>
      )}

      <section className="space-y-3" aria-labelledby="st-h">
        <h3 id="st-h" className="text-lg uppercase">Consolas</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {board.stations.map((s) => (
            <li key={s.station} className={clsx("card space-y-3", s.match?.status === "live" && "border-blaze/60 shadow-[0_0_24px_-6px_rgba(244,63,94,.6)]", s.match?.status === "pending" && "border-neon/50")}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display text-lg uppercase"><GameController size={22} weight="duotone" className="text-volt-light" aria-hidden />Consola {s.station}</span>
                {s.match ? (
                  s.match.status === "live"
                    ? <span className="chip-live"><span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-blaze" aria-hidden />En juego</span>
                    : <span className="chip border-neon/50 text-neon"><Megaphone size={12} weight="fill" aria-hidden />Llamados hace {minutesAgo(s.match.called_at)} min</span>
                ) : <span className="chip">Libre</span>}
              </div>
              {s.match ? (
                <>
                  <Versus m={s.match} />
                  {viewer.isOrganizer && (
                    <div className="grid grid-cols-2 gap-2">
                      {s.match.status === "pending" ? (
                        <>
                          <ActionButton className="btn-primary !min-h-11 text-sm" onAction={() => act(startMatch(s.match!.id), "¡Partido en juego!")}><Play size={16} weight="fill" aria-hidden />Empezar</ActionButton>
                          <ActionButton className="btn-ghost !min-h-11 text-sm" confirm="¿Devolver este partido a la cola?" onAction={() => act(uncallMatch(s.match!.id), "Devuelto a la cola")}><ArrowCounterClockwise size={16} aria-hidden />A la cola</ActionButton>
                        </>
                      ) : (
                        <Link href={`/t/${id}/partido/${s.match.id}`} className="btn-primary col-span-2 !min-h-11 text-sm">Cargar resultado</Link>
                      )}
                    </div>
                  )}
                </>
              ) : s.suggestion ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-white/55">Siguiente</p>
                  <Versus m={s.suggestion} />
                  {viewer.isOrganizer && <ActionButton className="btn-primary w-full !min-h-11 text-sm" onAction={() => call(s.suggestion!.id, s.station)}><Megaphone size={18} weight="fill" aria-hidden />Llamar a jugar</ActionButton>}
                </>
              ) : (
                <p className="text-sm text-white/55">{board.blocked ? "Esperando que se definan los rivales." : "Sin partidos pendientes."}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {board.queue.length > 0 && (
        <section className="space-y-2" aria-labelledby="q-h">
          <div className="flex items-end justify-between">
            <h3 id="q-h" className="text-lg uppercase">En cola</h3>
            <span className="flex items-center gap-1 text-xs text-white/60"><Clock size={14} aria-hidden />~{board.avgMinutes} min por partido</span>
          </div>
          <ol className="space-y-2">
            {board.queue.map((m, i) => (
              <li key={m.id} className={clsx("card flex items-center gap-2 !p-3", viewer.participantId && (m.home_id === viewer.participantId || m.away_id === viewer.participantId) && "border-volt-light/60")}>
                <span className="w-6 shrink-0 text-center font-display text-sm text-white/50">{i + 1}</span>
                <div className="min-w-0 flex-1"><Versus m={m} /></div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {board.blocked > 0 && <p className="help text-center">{board.blocked} partido(s) esperan que se definan los rivales.</p>}
      {viewer.isOrganizer && !autopilot && board.stations.some((s) => s.suggestion) && (
        <p className="help flex items-center justify-center gap-1 text-center"><Robot size={16} aria-hidden />Activa el piloto automático para no tener que llamar cada partido.</p>
      )}
      {toast.node}
    </div>
  );
}
