"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CaretDown, CaretLeft, Crown, Flag, Prohibit, Question, SoccerBall, UserCircleGear } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";
import { MatchRow } from "@/components/MatchRow";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AchievementIcon, ActionButton, Avatar, EmptyState, useToast } from "@/components/ui/primitives";
import { ReportDialog } from "@/components/ReportDialog";
import { reportContent, setBlocked } from "@/app/actions/moderation";
import { TeamCrest } from "@/components/TeamCrest";
import { setParticipantAvatar, updateAvatar } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/browser";
import { ACHIEVEMENTS, PLATFORM_LABEL } from "@/lib/labels";

/** El propio jugador cambia su avatar: con cuenta, foto o emoticono (se guarda en su perfil); invitado, emoticono. */
function MyAvatar({ current }: { current: string | null }) {
  const { id, viewer, refresh } = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function choose(value: string | null) {
    const r = viewer.kind === "user" ? await updateAvatar(value) : await setParticipantAvatar(id, value);
    if (!r.ok) return toast.show("error", r.error);
    toast.show("success", "Avatar actualizado");
    await refresh();
  }

  async function upload(file: File) {
    if (!viewer.userId) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) return toast.show("error", "Usa una imagen JPG, PNG o WebP de máximo 2 MB");
    setUploading(true);
    const sb = createClient();
    const path = `${viewer.userId}/avatar-${Date.now()}.${file.type.split("/")[1]}`;
    const up = await sb.storage.from("fifa-night").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (up.error) return toast.show("error", "No se pudo subir la imagen. Prueba con un avatar gamer.");
    await choose(sb.storage.from("fifa-night").getPublicUrl(path).data.publicUrl);
  }

  return (
    <section className="card space-y-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 font-semibold"><UserCircleGear size={22} className="text-neon" aria-hidden />Cambiar mi avatar</span>
        <CaretDown size={18} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? <AvatarPicker value={current} onChange={choose} onUpload={viewer.kind === "user" ? upload : undefined} busy={uploading} /> : null}
      {open && viewer.kind === "guest" ? <p className="help">Sin cuenta puedes elegir un avatar gamer. Para subir una foto, inicia sesión.</p> : null}
      {toast.node}
    </section>
  );
}

export default function PlayerPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const { snapshot, id, viewer, derived } = useT();
  const p = snapshot.participants.find((x) => x.id === pid);
  if (!p) return <EmptyState icon={Question} title="Jugador no encontrado" />;
  const s = snapshot.stats.find((x) => x.participant_id === pid);
  const team = derived.teamOf(pid);
  const ach = snapshot.achievements.filter((a) => a.participant_id === pid);
  const matches = snapshot.matches.filter((m) => [m.home_id, m.away_id].includes(pid) && m.home_id && m.away_id && m.status !== "cancelled");
  const isChampion = p.id === snapshot.tournament.champion_participant_id;
  // Atributos tipo carta: abreviatura + valor, como las cartas de jugador del videojuego
  const attrs: [string, string | number][] = s ? [["PJ", s.played], ["G", s.won], ["E", s.drawn], ["P", s.lost], ["GF", s.goals_for], ["GC", s.goals_against]] : [];
  const extra: [string, string | number][] = s ? [["Dif. de gol", s.goals_for - s.goals_against], ["% victorias", s.played ? `${Math.round((s.won / s.played) * 100)}%` : "–"], ["Mejor racha", s.best_streak], ["Valla invicta", s.clean_sheets], ["MVP", s.mvp_count], ["Fair play", s.fair_play_points === 0 ? "Limpio" : `${s.fair_play_points} pts`]] : [];
  const rating = s && snapshot.tournament.settings.fifa_points ? s.fifa_points : null;

  return (
    <div className="space-y-5">
      <Link href={`/t/${id}/estadisticas`} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Estadísticas</Link>

      <section aria-label={`Carta de ${p.display_name}`} className="relative mx-auto max-w-sm overflow-hidden rounded-[28px] border border-volt-light/40 p-5 shadow-glow" style={{ background: `linear-gradient(160deg, ${team?.color_primary ? `${team.color_primary}55` : "rgb(var(--accent2-deep) / .35)"} 0%, rgb(var(--s800)) 45%, rgb(var(--s950)) 100%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-neon/20 blur-3xl" aria-hidden />
        <div className="flex items-start justify-between">
          <div>
            {rating !== null ? <p className="font-display text-5xl leading-none text-white drop-shadow-[0_0_12px_rgb(var(--accent)/.6)]">{rating}</p> : null}
            {rating !== null ? <p className="text-[11px] font-semibold uppercase tracking-widest text-neon">FIFA Points</p> : null}
            {isChampion ? <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-bold uppercase text-amber-200"><Crown size={14} weight="fill" aria-hidden />Campeón</p> : null}
          </div>
          {team ? <TeamCrest team={team} size={60} /> : null}
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <Avatar name={p.display_name} color={p.avatar_color} url={p.avatar_url} size={88} />
          <h2 className="mt-3 text-2xl uppercase">{p.nickname || p.display_name}</h2>
          <p className="text-xs uppercase tracking-wide text-white/65">{PLATFORM_LABEL[p.platform]}{p.gamer_id ? ` · ${p.gamer_id}` : ""}{p.id === viewer.participantId ? " · Tú" : ""}</p>
          {team ? <p className="mt-1 text-sm font-semibold">{team.name}</p> : null}
        </div>
        {attrs.length > 0 && (
          <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-white/15 pt-4">
            {attrs.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-center gap-2">
                <dd className="font-display text-xl tabular-nums">{v}</dd>
                <dt className="text-xs font-semibold uppercase text-white/60">{k}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      {p.id === viewer.participantId ? <MyAvatar current={p.avatar_url} /> : viewer.participantId ? <ReportPlayer participantId={p.id} name={p.nickname || p.display_name} hasAccount={Boolean(p.user_id)} /> : null}

      {extra.length > 0 && <section aria-label="Más estadísticas" className="grid grid-cols-3 gap-2">{extra.map(([l, v]) => <div key={l} className="card !p-3 text-center"><p className="font-display text-xl tabular-nums">{v}</p><p className="text-[11px] uppercase tracking-wide text-white/60">{l}</p></div>)}</section>}
      {ach.length > 0 && <section className="space-y-2"><h3 className="section-title">Logros</h3><div className="flex flex-wrap gap-2">{ach.map((a) => <span key={a.id} className="chip !normal-case" title={ACHIEVEMENTS[a.code]?.description}><AchievementIcon code={a.code} size={16} />{ACHIEVEMENTS[a.code]?.title}</span>)}</div></section>}
      <section className="space-y-2"><h3 className="section-title">Partidos</h3>{matches.length ? matches.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState icon={SoccerBall} title="Sin partidos todavía" />}</section>
    </div>
  );
}

/** Reportar o bloquear a otro jugador del torneo. */
function ReportPlayer({ participantId, name, hasAccount }: { participantId: string; name: string; hasAccount: boolean }) {
  const { id, viewer } = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button type="button" className="btn-ghost !min-h-10 text-sm text-white/65" onClick={() => setOpen(true)}><Flag size={16} aria-hidden />Reportar jugador</button>
      {viewer.kind === "user" && hasAccount && (
        <ActionButton className="btn-ghost !min-h-10 text-sm text-white/65" confirm={`¿Bloquear a ${name}? Dejarás de ver sus publicaciones en todos los torneos.`}
          onAction={async () => { const r = await setBlocked(id, participantId, true); if (!r.ok) toast.show("error", r.error); else toast.show("success", "Bloqueado. Puedes deshacerlo desde tu perfil."); }}>
          <Prohibit size={16} aria-hidden />Bloquear
        </ActionButton>
      )}
      {open && (
        <ReportDialog title={`Reportar a ${name}`} onCancel={() => setOpen(false)}
          onSubmit={async (reason, details) => {
            const r = await reportContent(id, { kind: "user", participantId }, reason, details);
            if (!r.ok) { toast.show("error", r.error); return false; }
            toast.show("success", "Gracias. El equipo revisará el reporte.");
            return true;
          }} />
      )}
      {toast.node}
    </div>
  );
}
