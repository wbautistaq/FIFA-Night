"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Image as ImageIcon, Star } from "@phosphor-icons/react";
import { useT } from "@/components/TournamentShell";
import { Avatar, useToast } from "@/components/ui/primitives";
import { uploadResultProof, voteMvp } from "@/app/actions/match-extras";
import type { Match } from "@/lib/types";

/** Reduce la foto en el teléfono (máx. 1600 px, JPEG) para que suba rápido incluso con datos móviles. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob ? new File([blob], "marcador.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Foto del marcador (prueba del resultado) y votación del MVP del partido. */
export function MatchExtras({ match }: { match: Match }) {
  const { snapshot, viewer, derived, refresh } = useT();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [voting, setVoting] = useState(false);
  const proof = snapshot.proofs.find((p) => p.match_id === match.id);
  const isPlayer = viewer.participantId !== null && [match.home_id, match.away_id].includes(viewer.participantId);
  const canUpload = (viewer.isOrganizer || isPlayer) && Boolean(match.home_id && match.away_id) && snapshot.tournament.status !== "cancelled";
  const votes = snapshot.mvpVotes.filter((v) => v.match_id === match.id);
  const myVote = votes.find((v) => v.voter_participant_id === viewer.participantId)?.candidate_participant_id ?? null;
  const finished = match.status === "finished" && !match.is_bye;
  const candidates = [match.home_id, match.away_id].filter(Boolean) as string[];

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", await shrink(file));
    const r = await uploadResultProof(match.id, form);
    setUploading(false);
    if (!r.ok) return toast.show("error", r.error);
    toast.show("success", "Foto del marcador guardada");
    await refresh();
  }

  async function vote(candidate: string) {
    setVoting(true);
    const r = await voteMvp(match.id, myVote === candidate ? null : candidate);
    setVoting(false);
    if (!r.ok) return toast.show("error", r.error);
    await refresh();
  }

  if (!proof && !canUpload && !finished) return null;
  return (
    <>
      {proof || canUpload ? (
        <section className="card space-y-3" aria-labelledby={`proof-${match.id}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`proof-${match.id}`} className="flex items-center gap-2 text-lg uppercase"><ImageIcon size={20} weight="duotone" className="text-neon" aria-hidden />Foto del marcador</h3>
            {canUpload ? (
              <>
                <button type="button" className="btn-secondary !min-h-10 !px-3 text-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Camera size={18} aria-hidden />{uploading ? "Subiendo…" : proof ? "Cambiar" : "Subir foto"}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Foto del marcador" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              </>
            ) : null}
          </div>
          {proof ? (
            <a href={proof.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.url} alt="Foto del marcador del partido" className="max-h-80 w-full object-cover" loading="lazy" />
            </a>
          ) : (
            <p className="help !mt-0">Sube una foto de la pantalla con el resultado final: sirve de prueba si hay dudas.</p>
          )}
          {proof?.uploaded_by ? <p className="text-xs text-white/55">Subida por {derived.participants.get(proof.uploaded_by)?.display_name ?? "un jugador"}</p> : null}
        </section>
      ) : null}

      {finished ? (
        <section className="card space-y-3" aria-labelledby={`mvp-${match.id}`}>
          <h3 id={`mvp-${match.id}`} className="flex items-center gap-2 text-lg uppercase"><Star size={20} weight="fill" className="text-amber-300" aria-hidden />MVP del partido</h3>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((c) => {
              const p = derived.participants.get(c);
              const count = votes.filter((v) => v.candidate_participant_id === c).length;
              const isMvp = match.mvp_id === c;
              const mine = myVote === c;
              const canVote = viewer.participantId !== null && viewer.participantId !== c;
              return (
                <button key={c} type="button" disabled={!canVote || voting} aria-pressed={mine} onClick={() => vote(c)}
                  className={clsx("flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition active:scale-95 disabled:cursor-default disabled:active:scale-100", isMvp ? "border-amber-300/70 bg-amber-300/10 shadow-[0_0_20px_-6px_rgba(251,191,36,.6)]" : "border-white/15 bg-white/[.04]", mine && "ring-2 ring-neon")}>
                  <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color} url={p?.avatar_url} size={40} />
                  <span className="w-full truncate text-sm font-bold">{p?.nickname || p?.display_name}</span>
                  <span className="flex items-center gap-1 text-xs text-white/70">{isMvp ? <Star size={12} weight="fill" className="text-amber-300" aria-label="MVP" /> : null}{count} {count === 1 ? "voto" : "votos"}</span>
                </button>
              );
            })}
          </div>
          <p className="help !mt-0">{viewer.participantId ? (myVote ? "Toca de nuevo para quitar tu voto." : "Vota al mejor del partido (no puedes votarte a ti mismo).") : "Solo los participantes del torneo pueden votar."} El más votado se lleva el MVP y +3 Puntos del Parche.</p>
        </section>
      ) : null}
      {toast.node}
    </>
  );
}
