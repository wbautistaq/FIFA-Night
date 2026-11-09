"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ShareNetwork, Trophy } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";
import { TeamCrest } from "@/components/TeamCrest";
import { Avatar } from "@/components/ui/primitives";
import { teamStars } from "@/lib/teams";
import type { Match, StandingRow } from "@/lib/types";

/**
 * Botón que convierte una tarjeta (renderizada fuera de pantalla) en PNG 1080 px de ancho
 * y la comparte con el menú nativo del teléfono (WhatsApp, Instagram…); si no se puede, la descarga.
 */
export function ShareButton({ fileName, text, card, className = "btn-secondary", label = "Compartir" }: {
  fileName: string;
  text: string;
  card: ReactNode;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function share() {
    if (!ref.current) return;
    setBusy(true);
    setError("");
    try {
      const { toBlob } = await import("html-to-image");
      await document.fonts.ready;
      const blob = await toBlob(ref.current, { pixelRatio: 3, cacheBust: true, backgroundColor: `rgb(${getComputedStyle(document.documentElement).getPropertyValue("--s950").trim()})` });
      if (!blob) throw new Error("sin imagen");
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      // Cancelar el menú de compartir no es un error
      if (!(e instanceof DOMException && e.name === "AbortError")) setError("No se pudo crear la imagen. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={share} disabled={busy}>
        <ShareNetwork size={18} weight="bold" aria-hidden />{busy ? "Creando imagen…" : label}
      </button>
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      {typeof document !== "undefined"
        ? createPortal(<div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0"><div ref={ref}>{card}</div></div>, document.body)
        : null}
    </>
  );
}

/** Marco común de las tarjetas: 360×450 px (se exporta a 1080×1350, formato vertical de Instagram). */
function Frame({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  const { snapshot } = useT();
  return (
    <div className="relative flex h-[450px] w-[360px] flex-col overflow-hidden bg-pitch-950 p-6 font-sans text-white"
      style={{ backgroundImage: "radial-gradient(400px 260px at 0% 0%, rgb(var(--accent2)/.55), transparent 70%), radial-gradient(380px 260px at 100% 100%, rgb(var(--live)/.35), transparent 70%), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "auto, auto, 24px 24px, 24px 24px" }}>
      <p className="font-display text-[11px] uppercase tracking-[.25em] text-neon">Copa Parche</p>
      <p className="mt-1 truncate font-display text-lg uppercase leading-tight">{snapshot.tournament.name}</p>
      <p className="mt-4 font-display text-xs uppercase tracking-[.2em] text-white/60">{eyebrow}</p>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
      <p className="text-center text-[10px] uppercase tracking-[.3em] text-white/40">Organizado con Copa Parche</p>
    </div>
  );
}

function Side({ participantId }: { participantId: string | null }) {
  const { derived } = useT();
  const p = participantId ? derived.participants.get(participantId) : undefined;
  const team = derived.teamOf(participantId);
  return (
    <div className="flex w-[120px] flex-col items-center gap-2 text-center">
      {team ? <TeamCrest team={team} size={64} /> : <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color} url={p?.avatar_url} size={64} />}
      <div className="flex items-center gap-1.5">
        {team && p ? <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={20} /> : null}
        <p className="max-w-[96px] truncate font-display text-sm uppercase">{p ? p.nickname || p.display_name : "?"}</p>
      </div>
      {team ? <p className="max-w-[120px] truncate text-[10px] uppercase tracking-wide text-white/60">{team.name}</p> : null}
    </div>
  );
}

/** Resultado final de un partido. */
export function ResultCard({ match }: { match: Match }) {
  const { derived } = useT();
  const r = derived.resultOf.get(match.id);
  return (
    <Frame eyebrow="Resultado final">
      <div className="flex items-center justify-between">
        <Side participantId={match.home_id} />
        <div className="text-center">
          <p className="font-display text-5xl tabular-nums drop-shadow-[0_0_18px_rgb(var(--accent)/.5)]">{r?.home_score}<span className="mx-1 text-white/40">–</span>{r?.away_score}</p>
          {r?.home_pens != null ? <p className="mt-1 text-xs text-white/70">({r.home_pens}-{r.away_pens} pen.)</p> : null}
        </div>
        <Side participantId={match.away_id} />
      </div>
    </Frame>
  );
}

/** Tabla de posiciones (top 6). */
export function StandingsCard({ rows, title = "Tabla de posiciones" }: { rows: StandingRow[]; title?: string }) {
  const { derived } = useT();
  return (
    <Frame eyebrow={title}>
      <ol className="space-y-1.5">
        {rows.slice(0, 6).map((r) => {
          const p = derived.participants.get(r.participant_id);
          const team = derived.teamOf(r.participant_id);
          return (
            <li key={r.participant_id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.06] px-3 py-1.5">
              <span className={`grid h-6 w-6 place-items-center rounded-md font-display text-xs ${r.position === 1 ? "bg-[#fcd34d] text-[#111]" : r.position === 2 ? "bg-[#cbd5e1] text-[#111]" : r.position === 3 ? "bg-[#fb923c] text-[#111]" : "bg-white/10"}`}>{r.position}</span>
              {team ? <TeamCrest team={team} size={26} stars={false} /> : null}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{p?.nickname || p?.display_name}</span>
              <span className="text-[11px] text-white/60">{r.played} PJ</span>
              <span className="w-8 text-right font-display text-neon">{r.points}</span>
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}

/** Campeón del torneo. */
export function ChampionCard({ participantId }: { participantId: string }) {
  const { derived, snapshot } = useT();
  const p = derived.participants.get(participantId);
  const team = derived.teamOf(participantId);
  const stats = snapshot.stats.find((s) => s.participant_id === participantId);
  return (
    <Frame eyebrow="Campeón">
      <div className="flex flex-col items-center text-center">
        <Trophy size={72} weight="duotone" className="text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,.7)]" aria-hidden />
        <div className="mt-3"><Avatar name={p?.display_name ?? "?"} color={p?.avatar_color} url={p?.avatar_url} size={84} /></div>
        <p className="mt-3 font-display text-3xl uppercase">{p?.nickname || p?.display_name}</p>
        {team ? <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white/80">{team.name} · {teamStars(team)}★</p> : null}
        {stats ? <p className="mt-3 text-xs uppercase tracking-wider text-white/60">{stats.won} G · {stats.drawn} E · {stats.lost} P · {stats.goals_for} goles</p> : null}
      </div>
    </Frame>
  );
}
