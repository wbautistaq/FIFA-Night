"use client";

import { useRef } from "react";
import clsx from "clsx";
import { Camera, Trash } from "@phosphor-icons/react";
import { AVATAR_GROUPS, GAMER_AVATARS, avatarEmoji, emojiAvatar } from "@/lib/avatars";

/**
 * Elige el avatar: foto propia (solo con cuenta) o uno de los emoticonos gamer.
 * `onUpload` recibe el archivo; si no se pasa, solo se ofrecen emoticonos (invitados).
 */
export function AvatarPicker({ value, onChange, onUpload, busy = false }: {
  value: string | null;
  onChange: (value: string | null) => void;
  onUpload?: (file: File) => void;
  busy?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = avatarEmoji(value);
  return (
    <div className="space-y-3">
      {onUpload || value ? (
        <div className="flex flex-wrap gap-2">
          {onUpload ? (
            <>
              <button type="button" className="btn-secondary !min-h-11 flex-1" disabled={busy} onClick={() => fileRef.current?.click()}><Camera size={18} aria-hidden />{busy ? "Subiendo…" : "Subir foto"}</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Subir foto de perfil" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            </>
          ) : null}
          {value ? <button type="button" className="btn-ghost !min-h-11" onClick={() => onChange(null)}><Trash size={18} aria-hidden />Quitar</button> : null}
        </div>
      ) : null}
      <fieldset>
        <legend className="label">{onUpload ? "O elige un avatar gamer" : "Elige tu avatar"}</legend>
        {/* Agrupados por tipo para encontrar rápido entre tantas opciones */}
        <div className="space-y-4">
          {AVATAR_GROUPS.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`avatar-group-${g.id}`}>
              <p id={`avatar-group-${g.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/55">{g.label}</p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {GAMER_AVATARS.filter((a) => a.group === g.id).map((a) => {
                  const on = selected === a.emoji;
                  return (
                    <button key={a.emoji} type="button" aria-pressed={on} aria-label={a.label} title={a.label} onClick={() => onChange(emojiAvatar(a.emoji))}
                      className={clsx("grid aspect-square min-h-12 place-items-center rounded-2xl border transition hover:scale-105 active:scale-95", on ? "border-neon bg-neon/15 shadow-glow-neon" : "border-white/10 bg-white/[.05] hover:border-volt-light/50")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.img} alt="" width={34} height={34} loading="lazy" decoding="async" className="drop-shadow-[0_2px_3px_rgba(0,0,0,.45)]" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
