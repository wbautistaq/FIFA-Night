import { notFound } from "next/navigation";
import { adminState } from "@/lib/admin";
import { loadAdminOverview } from "@/app/actions/admin";
import { MfaGate } from "./MfaGate";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración", robots: { index: false } };

export default async function AdminPage() {
  const state = await adminState();
  // Para cualquier otra persona la ruta no existe
  if (!state.isStaff || !state.role || !state.userId) notFound();
  if (state.aal !== "aal2") return <MfaGate />;
  return <AdminPanel data={await loadAdminOverview()} selfId={state.userId} />;
}
