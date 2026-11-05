"use client";

import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useT } from "@/components/TournamentShell";
import { ActionButton, Avatar, Emoji3D, EmptyState, RemoteImage, useToast } from "@/components/ui/primitives";
import { createPost, deletePost, toggleReaction } from "@/app/actions/social";
import { REACTION_EMOJI, postInputSchema } from "@/lib/schemas";
import { REACTION_IMAGES } from "@/lib/avatars";

const REACTION_LABEL: Record<string, string> = { fire: "fuego", laugh: "risa", celebrate: "celebración", cry: "llanto", surprise: "sorpresa" };
import { createClient } from "@/lib/supabase/browser";
import { Camera, ChatsCircle, SpeakerSlash } from "@phosphor-icons/react";

export default function Wall() {
  const { snapshot, viewer, id, refresh } = useT();
  const { posts, reactions, participants, tournament } = snapshot;
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const check = postInputSchema.safeParse({ body });

  if (!tournament.settings.wall) return <EmptyState icon={SpeakerSlash} title="El muro está desactivado" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!check.success) return;
    setBusy(true);
    let imageUrl: string | null = null;
    if (file) {
      if (viewer.kind !== "user" || !viewer.userId) {
        toast.show("error", "Para subir imágenes necesitas iniciar sesión");
        setBusy(false);
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
        toast.show("error", "La imagen debe ser JPG, PNG o WebP de máximo 2 MB");
        setBusy(false);
        return;
      }
      const sb = createClient();
      const path = `${viewer.userId}/${id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const up = await sb.storage.from("fifa-night").upload(path, file, { contentType: file.type });
      if (up.error) {
        toast.show("error", "No se pudo subir la imagen");
        setBusy(false);
        return;
      }
      imageUrl = sb.storage.from("fifa-night").getPublicUrl(path).data.publicUrl;
    }
    const r = await createPost(id, { body }, imageUrl);
    setBusy(false);
    if (!r.ok) return toast.show("error", r.error);
    setBody("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    await refresh();
  }

  return (
    <div className="space-y-5">
      <h2 className="section-title">Muro</h2>
      {viewer.participantId ? (
        <form onSubmit={submit} className="card space-y-3">
          <label htmlFor="post" className="label">Comparte algo con el grupo</label>
          <textarea id="post" rows={3} maxLength={500} className="input py-3" placeholder="¡Qué golazo! 🔥" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            <label className="btn-secondary !min-h-10 cursor-pointer"><Camera size={18} aria-hidden />Foto<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <span className="text-xs text-white/50">{file ? file.name : `${body.length}/500`}</span>
            <button className="btn-primary !min-h-10" disabled={!check.success || busy}>{busy ? "Publicando…" : "Publicar"}</button>
          </div>
        </form>
      ) : <p className="help">Solo los participantes pueden publicar.</p>}

      {posts.length === 0 ? <EmptyState icon={ChatsCircle} title="El muro está vacío">Sé el primero en comentar.</EmptyState> : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const author = participants.find((x) => x.id === p.author_participant_id);
            const mine = reactions.filter((r) => r.post_id === p.id && r.participant_id === viewer.participantId).map((r) => r.reaction);
            return (
              <li key={p.id} className="card space-y-3 animate-slideUp">
                <div className="flex items-center gap-2"><Avatar name={author?.display_name ?? "?"} color={author?.avatar_color} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{author?.nickname || author?.display_name}</p><p className="text-xs text-white/50">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: es })}</p></div>
                  {(viewer.isOrganizer || p.author_participant_id === viewer.participantId) && <ActionButton className="btn-ghost !min-h-9 !px-2 text-xs" confirm="¿Eliminar esta publicación?" onAction={async () => { const r = await deletePost(id, p.id); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>Eliminar</ActionButton>}
                </div>
                <p className="whitespace-pre-wrap break-words">{p.body}</p>
                {p.image_url ? <RemoteImage src={p.image_url} alt="Imagen compartida" className="max-h-80 w-full rounded-xl object-cover" /> : null}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(REACTION_EMOJI) as (keyof typeof REACTION_EMOJI)[]).map((k) => {
                    const count = reactions.filter((r) => r.post_id === p.id && r.reaction === k).length;
                    return <button key={k} aria-pressed={mine.includes(k)} aria-label={`Reaccionar ${REACTION_LABEL[k]}`} disabled={!viewer.participantId} onClick={async () => { const r = await toggleReaction(id, p.id, k); if (!r.ok) toast.show("error", r.error); else await refresh(); }} className={`inline-flex min-h-10 items-center gap-1 rounded-full border px-2.5 text-sm font-semibold transition active:scale-95 ${mine.includes(k) ? "border-neon bg-neon/15 text-neon" : "border-white/15 bg-white/5"}`}><Emoji3D src={REACTION_IMAGES[k]!} size={22} />{count ? count : ""}</button>;
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {toast.node}
    </div>
  );
}
