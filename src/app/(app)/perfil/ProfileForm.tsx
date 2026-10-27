"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Field, useToast } from "@/components/ui/primitives";
import { AvatarPicker } from "@/components/AvatarPicker";
import { updateAvatar, updateProfile } from "@/app/actions/social";
import { profileInputSchema } from "@/lib/schemas";
import { PLATFORM_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/browser";
import type { Platform, Profile } from "@/lib/types";

export function ProfileForm({ profile, userId }: { profile: Profile; userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ display_name: profile.display_name, nickname: profile.nickname ?? "", platform: profile.platform, gamer_id: profile.gamer_id ?? "" });
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const check = profileInputSchema.safeParse(v);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!check.success) return;
    setBusy(true);
    const r = await updateProfile(v);
    setBusy(false);
    if (!r.ok) return toast.show("error", r.error);
    toast.show("success", "Perfil actualizado");
    router.refresh();
  }

  async function choose(value: string | null) {
    const r = await updateAvatar(value);
    if (!r.ok) return toast.show("error", r.error);
    setAvatar(value);
    toast.show("success", value ? "Avatar actualizado" : "Avatar eliminado");
    router.refresh();
  }

  async function upload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) return toast.show("error", "Usa una imagen JPG, PNG o WebP de máximo 2 MB");
    setUploading(true);
    const sb = createClient();
    const path = `${userId}/avatar-${Date.now()}.${file.type.split("/")[1]}`;
    const up = await sb.storage.from("fifa-night").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (up.error) return toast.show("error", "No se pudo subir la imagen. Prueba con un avatar gamer.");
    await choose(sb.storage.from("fifa-night").getPublicUrl(path).data.publicUrl);
  }

  return (
    <form onSubmit={save} className="card space-y-4" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={v.display_name || "?"} url={avatar} size={84} color="#7c3aed" />
        <div className="min-w-0"><p className="font-display text-lg uppercase">{v.nickname || v.display_name || "Tu avatar"}</p><p className="help">Se verá en tu carta de jugador y en todos tus torneos.</p></div>
      </div>
      <AvatarPicker value={avatar} onChange={choose} onUpload={upload} busy={uploading} />
      <Field label="Nombre" htmlFor="pn" error={!check.success ? check.error.issues[0]?.message : undefined}><input id="pn" className="input" value={v.display_name} onChange={(e) => setV({ ...v, display_name: e.target.value })} /></Field>
      <Field label="Apodo" htmlFor="pk"><input id="pk" className="input" value={v.nickname} onChange={(e) => setV({ ...v, nickname: e.target.value })} /></Field>
      <Field label="Plataforma" htmlFor="pp"><select id="pp" className="input" value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value as Platform })}>{(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select></Field>
      <Field label="Gamertag / PSN ID / EA ID" htmlFor="pg"><input id="pg" className="input" value={v.gamer_id} onChange={(e) => setV({ ...v, gamer_id: e.target.value })} /></Field>
      <button className="btn-primary w-full" disabled={!check.success || busy}>{busy ? "Guardando…" : "Guardar perfil"}</button>
      {toast.node}
    </form>
  );
}
