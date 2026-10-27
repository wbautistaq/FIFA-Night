import type { ReactNode } from "react";
import { TournamentShell } from "@/components/TournamentShell";

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TournamentShell id={id}>{children}</TournamentShell>;
}
