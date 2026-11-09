import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { DEFAULT_THEME, effectiveTheme, isThemeId, type ThemeId } from "@/lib/themes";

export const APPEARANCE_TAG = "site-appearance";

export interface SiteAppearance {
  premium: boolean;
  /** Tema guardado por el administrador (puede ser premium aunque el plan esté apagado). */
  theme: ThemeId;
  /** Tema que se muestra a todos. */
  effective: ThemeId;
}

const FALLBACK: SiteAppearance = { premium: false, theme: DEFAULT_THEME, effective: DEFAULT_THEME };

async function read(): Promise<SiteAppearance> {
  try {
    const env = publicEnv();
    const db = createJsClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await db.from("site_settings").select("premium,theme").eq("id", 1).maybeSingle();
    // Si la tabla aún no existe (migración 21 sin aplicar) se usa el tema gratuito
    if (error || !data) return FALLBACK;
    const premium = data.premium === true;
    const theme = isThemeId(data.theme) ? data.theme : DEFAULT_THEME;
    return { premium, theme, effective: effectiveTheme(premium, theme) };
  } catch {
    return FALLBACK;
  }
}

/** Apariencia del sitio, en caché hasta que el administrador la cambie. */
export const getSiteAppearance = unstable_cache(read, ["site-appearance"], { tags: [APPEARANCE_TAG], revalidate: 600 });
