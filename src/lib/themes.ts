/**
 * Paletas visuales del sitio. "pizarra" es la gratuita y predeterminada;
 * las demás solo se pueden activar con el plan premium (lo activa el administrador).
 * Los colores reales viven en globals.css bajo [data-theme="<id>"].
 */
export const THEME_IDS = ["pizarra", "estadio", "matchday", "bento", "brutal", "aurora", "tv", "pixel", "neon"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "pizarra";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  premium: boolean;
  /** Fondo, superficie y acento, solo para la muestra del selector. */
  swatch: [string, string, string];
  /** Color de la barra del navegador en el móvil. */
  browserColor: string;
}

export const THEMES: readonly ThemeInfo[] = [
  { id: "pizarra", name: "Pizarra táctica", description: "Cancha con líneas de tiza y acento amarillo.", premium: false, swatch: ["#1E6B3C", "#133D22", "#FFE45C"], browserColor: "#1B6337" },
  { id: "estadio", name: "Estadio nocturno", description: "Oscuro sobrio con acento verde lima.", premium: true, swatch: ["#0B1210", "#121B18", "#B8F25A"], browserColor: "#0B1210" },
  { id: "matchday", name: "Matchday claro", description: "Claro y editorial, como un diario deportivo.", premium: true, swatch: ["#F4F1EA", "#FFFFFF", "#E04A12"], browserColor: "#F4F1EA" },
  { id: "bento", name: "Bento arcade", description: "Bloques sólidos de color sobre negro.", premium: true, swatch: ["#0A0A0C", "#1A1A1F", "#C6FF3D"], browserColor: "#0A0A0C" },
  { id: "brutal", name: "Neo-brutalista", description: "Amarillo, bordes gruesos y sombras sólidas.", premium: true, swatch: ["#FFE14D", "#FFFFFF", "#D6006A"], browserColor: "#FFE14D" },
  { id: "aurora", name: "Vidrio aurora", description: "Luces de colores y tarjetas de vidrio.", premium: true, swatch: ["#0B1026", "#1B2244", "#2DE2C4"], browserColor: "#0B1026" },
  { id: "tv", name: "Transmisión TV", description: "Gráficos de transmisión deportiva en vivo.", premium: true, swatch: ["#0A1A3A", "#13285A", "#E8173A"], browserColor: "#0A1A3A" },
  { id: "pixel", name: "Pixel retro", description: "Videojuego arcade de 8 bits.", premium: true, swatch: ["#10121A", "#1C2030", "#3DFF8F"], browserColor: "#10121A" },
  { id: "neon", name: "Neón clásico", description: "El diseño original violeta y fucsia.", premium: true, swatch: ["#07061A", "#1E1A3D", "#8B5CF6"], browserColor: "#07061A" },
];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeInfo);
}

/** Tema que realmente se muestra: sin premium siempre es el gratuito. */
export function effectiveTheme(premium: boolean, theme: unknown): ThemeId {
  if (!isThemeId(theme)) return DEFAULT_THEME;
  if (themeInfo(theme).premium && !premium) return DEFAULT_THEME;
  return theme;
}
