import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32 pt-6">
      <main id="main">{children}</main>
      <AppNav />
    </div>
  );
}
