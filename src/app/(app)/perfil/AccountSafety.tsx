"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Prohibit, Trash } from "@phosphor-icons/react";
import { ActionButton, useToast } from "@/components/ui/primitives";
import { listMyBlocks, unblockUser } from "@/app/actions/moderation";
import { accountDeletionPlan, deleteMyAccount, type DeletionPlan } from "@/app/actions/account";

/** Personas bloqueadas: sus publicaciones no se muestran en ningún torneo. */
export function BlockedUsers() {
  const toast = useToast();
  const [list, setList] = useState<{ userId: string; name: string }[] | null>(null);
  useEffect(() => { void listMyBlocks().then((r) => setList(r.ok ? r.data ?? [] : [])); }, []);
  if (!list || list.length === 0) return null;
  return (
    <section className="card space-y-3" aria-labelledby="blocked-h">
      <h2 id="blocked-h" className="flex items-center gap-2 font-bold"><Prohibit size={20} aria-hidden />Personas bloqueadas</h2>
      <ul className="space-y-2">
        {list.map((b) => (
          <li key={b.userId} className="flex items-center justify-between gap-2">
            <span className="truncate">{b.name}</span>
            <ActionButton className="btn-secondary !min-h-10 text-sm" onAction={async () => {
              const r = await unblockUser(b.userId);
              if (!r.ok) return toast.show("error", r.error);
              setList((l) => (l ?? []).filter((x) => x.userId !== b.userId));
              toast.show("success", "Desbloqueado");
            }}>Desbloquear</ActionButton>
          </li>
        ))}
      </ul>
      {toast.node}
    </section>
  );
}

/** Borrar la cuenta desde la app (requisito de Google Play). Muestra antes qué pasa con cada torneo. */
export function DeleteAccount() {
  const router = useRouter();
  const toast = useToast();
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setOpen(true);
    const r = await accountDeletionPlan();
    if (r.ok) setPlan(r.data ?? null); else toast.show("error", r.error);
  }

  async function confirm() {
    setBusy(true);
    const r = await deleteMyAccount(text);
    setBusy(false);
    if (!r.ok) return toast.show("error", r.error);
    router.replace("/eliminar-cuenta?hecho=1");
    router.refresh();
  }

  return (
    <section className="card space-y-3 border-rose-300/30" aria-labelledby="del-h">
      <h2 id="del-h" className="flex items-center gap-2 font-bold"><Trash size={20} aria-hidden />Eliminar mi cuenta</h2>
      {!open ? (
        <>
          <p className="text-sm text-white/70">Borra tu cuenta y tus datos personales. No se puede deshacer.</p>
          <button type="button" className="btn-secondary w-full" onClick={start}>Quiero eliminar mi cuenta</button>
        </>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-white/80">Esto es lo que va a pasar:</p>
          <ul className="list-disc space-y-1 pl-5 text-white/75">
            <li>Se borran tu perfil, tu foto, tus publicaciones del muro, tus avisos y tus bloqueos.</li>
            {plan?.transfer.map((t) => <li key={t.id}>«{t.name}» pasa a <b>{t.to}</b>, que es coorganizador.</li>)}
            {plan?.remove.map((t) => <li key={t.id} className="text-rose-200">«{t.name}» se borra completo (no tiene coorganizador con cuenta).</li>)}
            {plan && plan.playing > 0 && <li>En {plan.playing === 1 ? "1 torneo" : `${plan.playing} torneos`} de otras personas tus partidos se conservan como «Jugador eliminado».</li>}
            {!plan && <li>Revisando tus torneos…</li>}
          </ul>
          {plan && plan.remove.length > 0 && <p className="help !mt-0">Si quieres conservar un torneo, nombra un coorganizador o entrégalo en «Administrar torneo» antes de continuar.</p>}
          <label htmlFor="del-confirm" className="label">Escribe ELIMINAR para confirmar</label>
          <input id="del-confirm" className="input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setText(""); }}>Cancelar</button>
            <button type="button" className="btn-danger" disabled={busy || !plan || text.trim().toUpperCase() !== "ELIMINAR"} onClick={confirm}>{busy ? "Eliminando…" : "Eliminar cuenta"}</button>
          </div>
        </div>
      )}
      {toast.node}
    </section>
  );
}
