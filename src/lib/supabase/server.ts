import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv, serviceKey } from "@/lib/env";

export async function createClient() {
  const env = publicEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Llamado desde un Server Component: el middleware refresca la sesión.
        }
      },
    },
  });
}

/** Cliente con service role. SOLO servidor; cada uso debe validar token/permiso antes. */
export function createAdminClient() {
  const env = publicEnv();
  return createJsClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });
}
