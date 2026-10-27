"use client";

import { shareOrigin } from "@/lib/site";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useT } from "@/components/TournamentShell";
import { PlayerChip } from "@/components/MatchRow";
import { ActionButton, EmptyState, Field, RemoteImage, Spinner, useToast } from "@/components/ui/primitives";
import { currentInviteToken, regenerateInvitation, revokeInvitations } from "@/app/actions/invitations";
import { addParticipant, removeParticipant, replaceParticipant } from "@/app/actions/tournaments";
import { participantInputSchema } from "@/lib/schemas";
import { LockSimple, UsersThree } from "@phosphor-icons/react";

export default function Invite() {
  const { id, snapshot, viewer, refresh } = useT();
  const { tournament: t, participants } = snapshot;
  const qc = useQueryClient();
  const toast = useToast();
  const [qr, setQr] = useState("");
  const [form, setForm] = useState({ display_name: "", nickname: "", platform: "presencial" as const, gamer_id: "" });
  const [replacing, setReplacing] = useState<string | null>(null);
  const editable = ["draft", "registration", "draw"].includes(t.status) && !t.draw_confirmed;

  const tokenQ = useQuery({ queryKey: ["invite", id], queryFn: () => currentInviteToken(id), enabled: viewer.isOrganizer });
  const link = tokenQ.data ? `${shareOrigin()}/unirse/${tokenQ.data}` : "";

  useEffect(() => {
    if (!link) return setQr("");
    QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: "#04100a", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [link]);

  const nameCheck = participantInputSchema.safeParse(form);
  const message = `¡Te invito a "${t.name}" en FIFA Night! Únete aquí: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.show("success", "Link copiado");
    } catch {
      toast.show("error", "No se pudo copiar. Mantén presionado el link para copiarlo.");
    }
  }
  async function submitParticipant(e: React.FormEvent) {
    e.preventDefault();
    if (!nameCheck.success) return;
    const r = replacing ? await replaceParticipant(id, replacing, form) : await addParticipant(id, form);
    if (!r.ok) return toast.show("error", r.error);
    toast.show("success", replacing ? "Participante reemplazado" : "Participante agregado");
    setForm({ ...form, display_name: "", nickname: "", gamer_id: "" });
    setReplacing(null);
    await refresh();
  }

  if (!viewer.isOrganizer) return <EmptyState icon={LockSimple} title="Solo el organizador gestiona las invitaciones" />;

  return (
    <div className="space-y-6">
      <h2 className="section-title">Invitar jugadores</h2>
      <section className="card space-y-4" aria-labelledby="link-h">
        <h3 id="link-h" className="font-bold">Link y QR</h3>
        {tokenQ.isLoading ? <Spinner /> : !link ? (
          <div className="space-y-3"><p className="text-sm text-white/70">No hay un link activo.</p>
            <ActionButton onAction={async () => { const r = await regenerateInvitation(id); if (!r.ok) toast.show("error", r.error); else await qc.invalidateQueries({ queryKey: ["invite", id] }); }}>Generar link</ActionButton></div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {qr ? <RemoteImage src={qr} alt="Código QR de invitación" className="h-40 w-40 rounded-xl bg-white p-1" /> : null}
              <div className="w-full space-y-2">
                <input readOnly aria-label="Link de invitación" className="input text-sm" value={link} onFocus={(e) => e.currentTarget.select()} />
                <div className="grid grid-cols-3 gap-2">
                  <button className="btn-secondary !px-2" onClick={copy}>Copiar</button>
                  <a className="btn-secondary !px-2" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>WhatsApp</a>
                  <a className="btn-secondary !px-2" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Únete a "${t.name}" en FIFA Night`)}`}>Telegram</a>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton className="btn-ghost" confirm="El link anterior dejará de funcionar. ¿Generar uno nuevo?" onAction={async () => { const r = await regenerateInvitation(id); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "Link renovado"); await qc.invalidateQueries({ queryKey: ["invite", id] }); } }}>Renovar link</ActionButton>
              <ActionButton className="btn-ghost text-red-300" confirm="Nadie podrá unirse con el link actual. ¿Revocar?" onAction={async () => { const r = await revokeInvitations(id); if (!r.ok) toast.show("error", r.error); else { toast.show("success", "Link revocado"); await qc.invalidateQueries({ queryKey: ["invite", id] }); } }}>Revocar</ActionButton>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="players-h">
        <h3 id="players-h" className="font-bold">Participantes ({participants.length}/{t.max_players})</h3>
        {participants.length === 0 ? <EmptyState icon={UsersThree} title="Todavía no se ha unido nadie" /> : (
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.id} className="card flex items-center justify-between gap-2 !p-3">
                <div className="min-w-0 flex-1"><PlayerChip participantId={p.id} /></div>
                {editable && p.user_id !== viewer.userId ? (
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-ghost !min-h-10 !px-3" onClick={() => { setReplacing(p.id); setForm({ display_name: "", nickname: "", platform: "presencial", gamer_id: "" }); document.getElementById("pname")?.focus(); }}>Reemplazar</button>
                    <ActionButton className="btn-ghost !min-h-10 !px-3 text-red-300" confirm={`¿Eliminar a ${p.display_name}?`} onAction={async () => { const r = await removeParticipant(id, p.id); if (!r.ok) toast.show("error", r.error); else await refresh(); }}>Quitar</ActionButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable && (
        <form onSubmit={submitParticipant} className="card space-y-3" noValidate>
          <h3 className="font-bold">{replacing ? "Reemplazar participante" : "Agregar manualmente"}</h3>
          <Field label="Nombre" htmlFor="pname" error={form.display_name && !nameCheck.success ? nameCheck.error.issues[0]?.message : undefined}>
            <input id="pname" className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Apodo (opcional)" htmlFor="pnick"><input id="pnick" className="input" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
            <Field label="Gamertag / ID (opcional)" htmlFor="pgid"><input id="pgid" className="input" value={form.gamer_id} onChange={(e) => setForm({ ...form, gamer_id: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={!nameCheck.success || (!replacing && participants.length >= t.max_players)}>{replacing ? "Reemplazar" : "Agregar"}</button>{replacing ? <button type="button" className="btn-ghost" onClick={() => setReplacing(null)}>Cancelar</button> : null}</div>
          {participants.length >= t.max_players && !replacing ? <p className="help">Alcanzaste el máximo de jugadores. Súbelo en Ajustes si quieres más.</p> : null}
        </form>
      )}
      {toast.node}
    </div>
  );
}
