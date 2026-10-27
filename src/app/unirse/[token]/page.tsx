"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Prohibit } from "@phosphor-icons/react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { joinByToken, previewInvitation, type InvitePreview } from "@/app/actions/invitations";
import { Avatar, Field, Spinner } from "@/components/ui/primitives";
import { participantInputSchema } from "@/lib/schemas";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/labels";
import type { TournamentFormat } from "@/lib/engine/types";
import type { Platform } from "@/lib/types";

export default function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ display_name: "", nickname: "", platform: "presencial" as Platform, gamer_id: "", avatar: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    previewInvitation(token).then((r) => (r.ok && r.data ? setPreview(r.data) : setLoadError(r.ok ? "Invitación inválida" : r.error)));
  }, [token]);

  const check = participantInputSchema.safeParse(form);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!check.success) return;
    setBusy(true);
    const r = await joinByToken(token, form);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace(`/t/${r.data?.tournamentId}`);
  }

  if (loadError) return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Prohibit size={56} weight="duotone" className="text-blaze-light" aria-hidden /><h1 className="text-2xl uppercase">Invitación no válida</h1><p className="text-white/70">{loadError}</p>
      <Link href="/" className="btn-secondary">Ir al inicio</Link>
    </main>
  );
  if (!preview) return <main id="main" className="mx-auto max-w-md p-6"><Spinner label="Abriendo invitación" /></main>;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-8">
      <header className="text-center">
        <p className="text-sm text-neon">Te invitaron a</p>
        <h1 className="mt-1 text-3xl uppercase">{preview.name}</h1>
        <p className="mt-2 text-sm text-white/70">{FORMAT_LABEL[preview.format as TournamentFormat]} · {PLATFORM_LABEL[preview.platform as Platform]} · {preview.players}/{preview.maxPlayers} jugadores</p>
      </header>
      {preview.alreadyIn ? (
        <div className="card space-y-3 text-center"><p>Ya eres parte de este torneo.</p><Link href={`/t/${preview.tournamentId}`} className="btn-primary w-full">Abrir torneo</Link></div>
      ) : !preview.open ? (
        <div className="card text-center text-white/80">La inscripción está cerrada o el torneo ya está lleno.</div>
      ) : preview.me ? (
        <div className="card space-y-4 text-center">
          <div className="flex justify-center"><Avatar name={preview.me.name} url={preview.me.avatarUrl} size={64} /></div>
          <p className="text-white/80">Entrarás con tu cuenta como <b className="text-white">{preview.me.name}</b>. Tus resultados suman a tu historial y al ranking.</p>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy} onClick={async () => {
            setBusy(true);
            const r = await joinByToken(token, { display_name: preview.me!.name, platform: "presencial" });
            setBusy(false);
            if (!r.ok) return setError(r.error);
            router.replace(`/t/${r.data?.tournamentId}`);
          }}>{busy ? "Uniéndome…" : `Unirme como ${preview.me.name}`}</button>
        </div>
      ) : (
        <>
        <div className="card space-y-3 text-center">
          <p className="text-white/80">{preview.accountsOnly ? "Este torneo es solo para jugadores con cuenta." : "Con tu cuenta, tus partidos quedan guardados en tu perfil e historial."}</p>
          <Link href={`/login?next=${encodeURIComponent(`/unirse/${token}`)}`} className="btn-primary w-full">Entrar con mi cuenta</Link>
        </div>
        {!preview.accountsOnly && (
        <form onSubmit={join} className="card space-y-4" noValidate>
          <p className="text-sm text-white/70"><b className="text-white">¿Sin cuenta?</b> Entra como invitado: solo dinos cómo te llamas. Luego podrás vincular este perfil a una cuenta.</p>
          <AvatarPicker value={form.avatar || null} onChange={(v) => setForm({ ...form, avatar: v ?? "" })} />
          <Field label="Tu nombre" htmlFor="jn" error={form.display_name && !check.success ? check.error.issues[0]?.message : undefined}><input id="jn" className="input" autoFocus value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Apodo (opcional)" htmlFor="jk"><input id="jk" className="input" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
          <Field label="Plataforma" htmlFor="jp"><select id="jp" className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}>{(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select></Field>
          <Field label="Gamertag / PSN / EA ID (opcional)" htmlFor="jg"><input id="jg" className="input" value={form.gamer_id} onChange={(e) => setForm({ ...form, gamer_id: e.target.value })} /></Field>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <button className="btn-secondary w-full" disabled={!check.success || busy}>{busy ? "Uniéndome…" : "Unirme como invitado"}</button>
        </form>
        )}
        </>
      )}
    </main>
  );
}
