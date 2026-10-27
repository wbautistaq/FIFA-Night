"use client";

import { LinkSimple } from "@phosphor-icons/react";
import { ActionButton, useToast } from "@/components/ui/primitives";
import { claimGuestProfile } from "@/app/actions/players";

/** Quien jugó como invitado y ya inició sesión: un toque y sus partidos pasan a su cuenta. */
export function ClaimGuestBanner({ tournamentId, name, onDone }: { tournamentId: string; name: string; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  return (
    <section className="card-glow mb-5 space-y-3 !py-4" aria-labelledby="claim-h">
      <p id="claim-h" className="flex items-center gap-2 font-semibold"><LinkSimple size={20} weight="bold" className="text-neon" aria-hidden />Jugaste como invitado ({name})</p>
      <p className="text-sm text-white/70">Vincula este perfil a tu cuenta: tus partidos de este torneo pasarán a tu perfil e historial.</p>
      <ActionButton className="btn-primary w-full" onAction={async () => {
        const r = await claimGuestProfile(tournamentId);
        if (!r.ok) return toast.show("error", r.error);
        toast.show("success", "Listo: este perfil ahora es tuyo");
        await onDone();
      }}>Vincular a mi cuenta</ActionButton>
      {toast.node}
    </section>
  );
}
