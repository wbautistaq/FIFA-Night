import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { adminState } from "@/lib/admin";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // El rol viene del JWT verificado; la ruta /admin vuelve a exigir rol + verificación en dos pasos
  const { isAdmin } = await adminState();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32 pt-6">
      <main id="main">{children}</main>
      <AppNav isAdmin={isAdmin} />
    </div>
  );
}
