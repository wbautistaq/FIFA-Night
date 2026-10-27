import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { adminState } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from("profiles").select("id,display_name,nickname,avatar_url,platform,gamer_id").eq("id", auth.user.id).single();
  return (
    <div className="space-y-5">
      <h1 className="text-3xl uppercase">Mi perfil</h1>
      <p className="text-sm text-white/60">{auth.user.email}</p>
      <ProfileForm profile={data as Profile} userId={auth.user.id} />
      <PasswordForm />
      {(await adminState()).isAdmin && (
        <Link href="/admin" className="btn-secondary w-full border-neon/40 text-neon"><ShieldCheck size={20} weight="duotone" aria-hidden /> Administración</Link>
      )}
      <form action="/auth/signout" method="post"><button className="btn-secondary w-full">Cerrar sesión</button></form>
    </div>
  );
}
