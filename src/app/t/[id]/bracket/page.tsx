"use client";

import { useT } from "@/components/TournamentShell";
import { BracketView } from "@/components/BracketView";
import { EmptyState } from "@/components/ui/primitives";
import Link from "next/link";
import { Television, TreeStructure } from "@phosphor-icons/react";

export default function BracketPage() {
  const { snapshot, id } = useT();
  const hasBracket = snapshot.matches.some((m) => ["knockout", "winners", "losers", "grand_final", "third_place"].includes(m.stage));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="section-title">Bracket</h2><Link href={`/t/${id}/tv`} className="btn-secondary !min-h-10"><Television size={18} aria-hidden />Pantalla grande</Link></div>
      {hasBracket ? <BracketView /> : (
        <EmptyState icon={TreeStructure} title="Sin bracket todavía">{["cup", "double_elimination", "groups_playoffs"].includes(snapshot.tournament.format) ? "Se genera cuando el organizador inicia el torneo." : "Este formato no usa llaves."}</EmptyState>
      )}
    </div>
  );
}
