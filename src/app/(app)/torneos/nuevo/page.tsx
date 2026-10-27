"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { createTournament } from "@/app/actions/tournaments";
import { TournamentForm, defaultTournamentInput } from "@/components/TournamentForm";

export default function NewTournament() {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white"><CaretLeft size={14} weight="bold" aria-hidden />Volver</Link>
      <h1 className="text-3xl uppercase">Nuevo torneo</h1>
      <p className="text-white/70">Lo básico ahora; todo se puede ajustar hasta el sorteo.</p>
      <div className="card">
        <TournamentForm
          initial={defaultTournamentInput()}
          submitLabel="Crear torneo"
          onSubmit={async (v) => {
            const res = await createTournament(v);
            if (!res.ok) return res.error;
            router.push(`/t/${res.data?.id}/invitar`);
            return null;
          }}
        />
      </div>
    </div>
  );
}
