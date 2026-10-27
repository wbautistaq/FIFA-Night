"use client";

import clsx from "clsx";
import { isValidElement, useEffect, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { avatarEmojiImage } from "@/lib/avatars";
import { ArrowClockwise, ArrowCounterClockwise, CheckCircle, Crown, Handshake, Medal, ShieldCheck, SoccerBall, Star, StarHalf, Target, Trophy, Wall, WarningOctagon, type Icon } from "@phosphor-icons/react";

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-10 text-white/75">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-neon shadow-[0_0_12px_rgba(46,230,255,.5)]" aria-hidden />
      <span className="font-semibold uppercase tracking-wider">{label}…</span>
    </div>
  );
}

/** `icon` es un componente Phosphor (desde componentes cliente) o un elemento ya renderizado (desde Server Components). */
export function EmptyState({ icon = SoccerBall, title, children }: { icon?: Icon | ReactElement; title: string; children?: ReactNode }) {
  const IconCmp = icon as Icon;
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-volt/40 bg-gradient-to-br from-volt/30 to-blaze/10 text-neon shadow-glow" aria-hidden>
        {isValidElement(icon) ? icon : <IconCmp size={32} weight="duotone" />}
      </span>
      <h3 className="text-lg uppercase">{title}</h3>
      {children ? <div className="max-w-sm text-sm text-white/75">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-2 border-blaze/50 text-center">
      <WarningOctagon size={36} weight="duotone" className="text-blaze-light" aria-hidden />
      <p className="font-display uppercase text-rose-200">Algo salió mal</p>
      <p className="text-sm text-rose-100/85">{message}</p>
      {onRetry ? <button className="btn-secondary mt-2" onClick={onRetry}><ArrowClockwise size={18} aria-hidden />Reintentar</button> : null}
    </div>
  );
}

export function Field({ label, error, help, children, htmlFor }: { label: string; error?: string; help?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {help && !error ? <p className="help">{help}</p> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange, help, id }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string; id: string }) {
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help ? <span className="help block">{help}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-white/20 transition checked:bg-neon relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Avatar({ name, color = "#7c3aed", url, size = 40 }: { name: string; color?: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const emoji = avatarEmojiImage(url);
  if (emoji) {
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-white/15" style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 60%), linear-gradient(140deg, ${color}, #1e1a3d)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={emoji.img} alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} loading="lazy" decoding="async" className="drop-shadow-[0_2px_3px_rgba(0,0,0,.45)]" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" aria-hidden width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white/15" style={{ width: size, height: size }} />;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-display text-white ring-2 ring-white/15" style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 55%), ${color}`, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

const ACHIEVEMENT_ICONS: Record<string, Icon> = {
  first_title: Trophy, top_scorer: SoccerBall, unbeaten: ShieldCheck, clasico_king: Crown,
  worst_defense: Wall, penalty_specialist: Target, comeback_kid: ArrowCounterClockwise, fair_play: Handshake,
};

/** Insignia de logro (icono vectorial en lugar de emoji). */
export function AchievementIcon({ code, size = 22 }: { code: string; size?: number }) {
  const AIcon = ACHIEVEMENT_ICONS[code] ?? Medal;
  return <AIcon size={size} weight="duotone" className={code === "worst_defense" ? "text-rose-300" : "text-amber-300"} aria-hidden />;
}

/** Estrellas de FC 26 (admite medias estrellas). */
export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-px text-amber-300" role="img" aria-label={`${value} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value >= i ? "full" : value >= i - 0.5 ? "half" : "empty";
        return fill === "full" ? <Star key={i} size={size} weight="fill" aria-hidden /> : fill === "half" ? <StarHalf key={i} size={size} weight="fill" aria-hidden /> : <Star key={i} size={size} weight="regular" className="text-white/25" aria-hidden />;
      })}
    </span>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black">
      Sin conexión — mostrando los últimos datos guardados
    </div>
  );
}

type ToastKind = "success" | "error";
export function useToast() {
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div role={toast.kind === "error" ? "alert" : "status"} className={clsx("fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md animate-slideUp items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-xl", toast.kind === "error" ? "border-blaze/60 bg-rose-950/90 text-rose-100" : "border-neon/60 bg-pitch-900/90 text-neon shadow-glow-neon")}>
      {toast.kind === "error" ? <WarningOctagon size={18} weight="fill" aria-hidden /> : <CheckCircle size={18} weight="fill" aria-hidden />}
      {toast.text}
    </div>
  ) : null;
  return { show: (kind: ToastKind, text: string) => setToast({ kind, text }), node };
}

export function ActionButton({ onAction, children, className = "btn-primary", confirm, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { onAction: () => Promise<void> | void; confirm?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      {...rest}
      className={className}
      disabled={busy || rest.disabled}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          await onAction();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}

/** Imagen remota (QR en data URL o imágenes del muro en Supabase Storage); no usa next/image por ser contenido dinámico. */
export function RemoteImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

/** Emoticono 3D (Fluent Emoji) decorativo, del mismo estilo que los avatares. */
export function Emoji3D({ src, size = 24 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async" className="shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,.45)]" />;
}
