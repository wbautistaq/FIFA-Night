import { nextPow2 } from "./fixtures";
import { recommendedSwissRounds } from "./swiss";
import type { TournamentFormat, TournamentSettings } from "./types";

/** Una forma concreta de armar los cruces para N jugadores, con lo que implica. */
export interface FormatOption {
  id: string;
  format: TournamentFormat;
  /** Ajustes que hay que aplicar junto con el formato (grupos, rondas del suizo…). */
  settings: Partial<TournamentSettings>;
  title: string;
  summary: string;
  points: string[];
  matches: number;
  /** Partidos que juega como mínimo cada jugador. */
  minPerPlayer: number;
  minutes: number;
  recommended: boolean;
}

export interface FormatAdvice {
  players: number;
  odd: boolean;
  options: FormatOption[];
  /** Cuántos jugadores más dejarían el cuadro "redondo" (sin descansos ni pases libres). */
  tip: string | null;
}

/** Duración razonable de una noche de torneo. */
export const NIGHT_MINUTES = 180;

const pairs = (n: number) => (n * (n - 1)) / 2;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Reparto en grupos igual al del generador (serpiente): tamaños de cada grupo. */
export function groupSizes(players: number, groupSize: number): number[] {
  const count = Math.max(2, Math.ceil(players / groupSize));
  return Array.from({ length: count }, (_, i) => Math.floor(players / count) + (i < players % count ? 1 : 0));
}

/** Mejor configuración de grupos: grupos parejos y clasificados que formen un cuadro exacto (4, 8…). */
export function bestGroups(players: number): { groupSize: number; qualifiers: number; sizes: number[] } | null {
  let best: { groupSize: number; qualifiers: number; sizes: number[]; score: number } | null = null;
  for (let gs = 3; gs <= 8; gs++) {
    const sizes = groupSizes(players, gs);
    const smallest = Math.min(...sizes);
    if (smallest < 3) continue;
    for (let q = 1; q <= Math.min(4, smallest - 1); q++) {
      const total = sizes.length * q;
      if (total < 4 || total !== nextPow2(total)) continue;
      // Preferimos grupos de 4, pocas diferencias de tamaño y que no clasifique casi todo el grupo
      const score = Math.abs(smallest - 4) * 2 + (Math.max(...sizes) - smallest) + (q / smallest > 0.6 ? 3 : 0) + (total > 8 ? 1 : 0);
      if (!best || score < best.score) best = { groupSize: gs, qualifiers: q, sizes, score };
    }
  }
  return best && { groupSize: best.groupSize, qualifiers: best.qualifiers, sizes: best.sizes };
}

/**
 * Opciones de formato para N jugadores, pensadas sobre todo para cantidades impares o que no
 * llenan un cuadro: cuántos partidos son, quién descansa o pasa directo y cuánto dura la noche.
 */
export function formatAdvice(players: number, opts: { stations?: number; matchMinutes?: number; formats?: readonly TournamentFormat[]; thirdPlace?: boolean } = {}): FormatAdvice {
  const n = Math.floor(players);
  const stations = Math.max(1, opts.stations ?? 1);
  const per = opts.matchMinutes ?? 12;
  const allowed = (f: TournamentFormat) => !opts.formats || opts.formats.includes(f);
  const time = (matches: number) => Math.ceil(matches / stations) * per;
  const odd = n % 2 === 1;
  const options: FormatOption[] = [];
  if (n < 4) return { players: n, odd, options, tip: null };

  if (allowed("league")) {
    const m = pairs(n);
    options.push({
      id: "league", format: "league", settings: {}, title: "Liga (todos contra todos)",
      summary: `${n - 1} partidos cada uno, ${odd ? n : n - 1} jornadas`,
      points: odd
        ? [`En cada jornada descansa 1 jugador; cada uno descansa una sola vez`, "Nadie queda eliminado: la tabla decide"]
        : ["Todos juegan todas las jornadas", "Nadie queda eliminado: la tabla decide"],
      matches: m, minPerPlayer: n - 1, minutes: time(m), recommended: false,
    });
  }

  if (allowed("league_double") && n <= 8) {
    const m = pairs(n) * 2;
    options.push({
      id: "league_double", format: "league_double", settings: {}, title: "Liga ida y vuelta",
      summary: `${2 * (n - 1)} partidos cada uno`,
      points: [odd ? "Descansa 1 por jornada, igual que en la liga" : "Todos juegan todas las jornadas", "La más justa, pero la más larga"],
      matches: m, minPerPlayer: 2 * (n - 1), minutes: time(m), recommended: false,
    });
  }

  if (allowed("groups_playoffs") && n >= 6) {
    const g = bestGroups(n);
    if (g) {
      const qual = g.sizes.length * g.qualifiers;
      const m = g.sizes.reduce((acc, s) => acc + pairs(s), 0) + qual - 1 + (opts.thirdPlace && qual >= 4 ? 1 : 0);
      const sizesText = [...new Set(g.sizes)].sort((a, b) => b - a).join(" y ");
      options.push({
        id: "groups", format: "groups_playoffs", settings: { group_size: g.groupSize, qualifiers_per_group: g.qualifiers },
        title: "Grupos + eliminatoria",
        summary: `${plural(g.sizes.length, "grupo", "grupos")} de ${sizesText}; pasan ${g.qualifiers} por grupo`,
        points: [
          `${qual === 4 ? "Semifinales" : qual === 8 ? "Cuartos de final" : `Cuadro de ${qual}`} con los ${qual} clasificados`,
          g.sizes.some((s) => s % 2 === 1) ? "En los grupos impares descansa 1 por fecha" : "Grupos parejos, sin descansos",
          `Todos juegan al menos ${Math.min(...g.sizes) - 1} partidos`,
        ],
        matches: m, minPerPlayer: Math.min(...g.sizes) - 1, minutes: time(m), recommended: false,
      });
    }
  }

  if (allowed("cup")) {
    const size = Math.max(4, nextPow2(n));
    const byes = size - n;
    const cupMatches = n - 1 + (opts.thirdPlace ? 1 : 0);
    options.push({
      id: "cup", format: "cup", settings: {}, title: "Copa (eliminación directa)",
      summary: byes ? `${plural(byes, "jugador pasa", "jugadores pasan")} directo a la 2ª ronda` : `Cuadro exacto de ${size}`,
      points: [
        byes ? `${plural(byes, "pase libre", "pases libres")} por sorteo` : "Sin pases libres",
        "El que pierde queda fuera: la noche más corta",
        byes > n / 3 ? "Muchos pases libres: varios jugarán solo 1 partido" : "Cada eliminado juega al menos 1 partido",
      ],
      matches: cupMatches, minPerPlayer: byes ? 0 : 1, minutes: time(cupMatches), recommended: false,
    });
  }

  if (allowed("double_elimination")) {
    const size = Math.max(4, nextPow2(n));
    const m = 2 * n - 1;
    options.push({
      id: "double", format: "double_elimination", settings: {}, title: "Doble eliminación",
      summary: "Hay que perder dos veces para quedar fuera",
      points: [size - n ? `${plural(size - n, "pase libre", "pases libres")} en la primera ronda` : "Sin pases libres", "Todos juegan al menos 2 partidos"],
      matches: m, minPerPlayer: 2, minutes: time(m), recommended: false,
    });
  }

  if (allowed("swiss") && n >= 6) {
    const rounds = recommendedSwissRounds(n);
    const m = rounds * Math.floor(n / 2);
    options.push({
      id: "swiss", format: "swiss", settings: { swiss_rounds: rounds }, title: "Sistema suizo",
      summary: `${rounds} rondas, cada una contra alguien de tu nivel`,
      points: [odd ? "En cada ronda descansa 1, nunca el mismo dos veces" : "Todos juegan todas las rondas", "Sin eliminados y mucho más corto que la liga"],
      matches: m, minPerPlayer: odd ? rounds - 1 : rounds, minutes: time(m), recommended: false,
    });
  }

  // Recomendación: lo que más partidos da a cada uno sin pasar de ~3 horas con las consolas que hay.
  // Copa y doble eliminación quedan como alternativas (dejan a gente con 1–2 partidos).
  const PREF = ["league", "groups", "swiss", "league_double"];
  const candidates = options.filter((o) => PREF.includes(o.id));
  const fits = candidates.filter((o) => o.minutes <= NIGHT_MINUTES);
  const choice = fits.length
    ? [...fits].sort((a, b) => b.minPerPlayer - a.minPerPlayer || PREF.indexOf(a.id) - PREF.indexOf(b.id))[0]
    : [...(candidates.length ? candidates : options)].sort((a, b) => a.minutes - b.minutes)[0];
  if (choice) choice.recommended = true;

  const toEven = odd ? 1 : 0;
  const toBracket = nextPow2(n) - n;
  const tip = odd
    ? `Con ${plural(toEven, "jugador", "jugadores")} más (${n + toEven}) nadie descansaría en la liga${toBracket === 1 ? " ni habría pases libres en la copa" : ""}.`
    : toBracket > 0 && toBracket <= 2
      ? `Con ${plural(toBracket, "jugador", "jugadores")} más (${n + toBracket}) la copa quedaría sin pases libres.`
      : null;

  return { players: n, odd, options, tip };
}
