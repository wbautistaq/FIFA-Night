import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TournamentCard } from "@/components/TournamentCard";
import { EmptyState } from "@/components/ui/primitives";
import type { Tournament } from "@/lib/types";
import { CaretDown, EnvelopeSimple, Lightning, Plus, Prohibit, Trophy } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name,nickname").eq("id", auth.user.id).maybeSingle();
  // El apodo es obligatorio: es como los amigos te encuentran para agregarte a sus torneos
  if (!profile?.nickname) redirect("/bienvenida");

  const { data } = await supabase
    .from("tournaments")
    .select("id,owner_id,name,status,format,platform,starts_at,tournament_participants(count)")
    .order("created_at", { ascending: false });
  type Row = Pick<Tournament, "id" | "owner_id" | "name" | "status" | "format" | "platform" | "starts_at"> & { tournament_participants: { count: number }[] };
  const rows = (data ?? []) as unknown as Row[];
  // Los cancelados van aparte, plegados al final: ya no cuentan para nada
  const active = rows.filter((t) => t.status !== "cancelled");
  const cancelled = rows.filter((t) => t.status === "cancelled");
  const mine = active.filter((t) => t.owner_id === auth.user.id);
  const invited = active.filter((t) => t.owner_id !== auth.user.id);

  return (
    <div className="space-y-8">
      <header className="card-glow relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blaze/30 blur-3xl" aria-hidden />
        <p className="eyebrow">FIFA Night · FC 27</p>
        <h1 className="mt-1 text-3xl uppercase leading-tight">Hola, <span className="bg-gradient-to-r from-neon to-volt-light bg-clip-text text-transparent">{profile?.nickname || profile?.display_name || "crack"}</span></h1>
        <p className="mt-1 text-sm text-white/70">Arma la noche de FIFA: sorteo, calendario y tabla en vivo.</p>
        <div className="mt-4 grid gap-2 sm:flex">
          <Link href="/torneos/rapido" className="btn-primary"><Lightning size={20} weight="fill" aria-hidden />Torneo relámpago</Link>
          <Link href="/torneos/nuevo" className="btn-secondary"><Plus size={20} weight="bold" aria-hidden />Torneo personalizado</Link>
        </div>
      </header>

      <section aria-labelledby="mine">
        <h2 id="mine" className="section-title mb-3">Mis torneos</h2>
        {mine.length === 0 ? (
          <EmptyState icon={<Trophy size={32} weight="duotone" />} title="Aún no organizas ningún torneo">
            Crea uno en menos de un minuto e invita a tus amigos con un link o un QR.
          </EmptyState>
        ) : (
          <div className="grid gap-3">{mine.map((t) => <TournamentCard key={t.id} t={t} players={t.tournament_participants[0]?.count} />)}</div>
        )}
      </section>

      <section aria-labelledby="invited">
        <h2 id="invited" className="section-title mb-3">Torneos a los que me invitaron</h2>
        {invited.length === 0 ? (
          <EmptyState icon={<EnvelopeSimple size={32} weight="duotone" />} title="Sin invitaciones por ahora">Cuando un amigo te invite aparecerá aquí.</EmptyState>
        ) : (
          <div className="grid gap-3">{invited.map((t) => <TournamentCard key={t.id} t={t} players={t.tournament_participants[0]?.count} />)}</div>
        )}
      </section>

      {cancelled.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-1 text-sm font-semibold uppercase tracking-wide text-white/55 hover:text-white">
            <span className="flex items-center gap-2"><Prohibit size={18} aria-hidden />Cancelados ({cancelled.length})</span>
            <CaretDown size={16} className="transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 grid gap-3 opacity-70">{cancelled.map((t) => <TournamentCard key={t.id} t={t} players={t.tournament_participants[0]?.count} />)}</div>
        </details>
      )}
    </div>
  );
}
