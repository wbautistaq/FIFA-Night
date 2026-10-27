import { shuffle } from "./rng";
import type { Rng } from "./types";

export interface TeamLite {
  id: string;
  name: string;
  league: string;
  country: string;
  rating: number;
  kind: "club" | "national";
  banned?: boolean;
  favorite?: boolean;
}

export interface DrawOptions {
  avoidRepeats: boolean;
  allowNational: boolean;
  allowClubs: boolean;
  minRating?: number;
  maxRating?: number;
  leagues?: string[];
  countries?: string[];
  balanced: boolean;
}

export const DEFAULT_DRAW_OPTIONS: DrawOptions = {
  avoidRepeats: true,
  allowNational: true,
  allowClubs: true,
  balanced: false,
};

export class DrawError extends Error {}

export interface DrawAssignment {
  participantId: string;
  teamId: string;
}

/** Filtra el banco de equipos según las opciones del sorteo. */
export function filterPool(teams: readonly TeamLite[], opts: DrawOptions): TeamLite[] {
  return teams.filter((t) => {
    if (t.banned) return false;
    if (t.kind === "national" && !opts.allowNational) return false;
    if (t.kind === "club" && !opts.allowClubs) return false;
    if (opts.minRating !== undefined && t.rating < opts.minRating) return false;
    if (opts.maxRating !== undefined && t.rating > opts.maxRating) return false;
    if (opts.leagues?.length && t.kind === "club" && !opts.leagues.includes(t.league)) return false;
    if (opts.countries?.length && !opts.countries.includes(t.country)) return false;
    return true;
  });
}

/** Ventana contigua (por rating) de tamaño n con menor diferencia entre mejor y peor equipo. */
function tightestWindow(sorted: TeamLite[], n: number, rng: Rng): TeamLite[] {
  let best = Infinity;
  let candidates: number[] = [];
  for (let i = 0; i + n <= sorted.length; i++) {
    const spread = (sorted[i + n - 1] as TeamLite).rating - (sorted[i] as TeamLite).rating;
    if (spread < best) {
      best = spread;
      candidates = [i];
    } else if (spread === best) candidates.push(i);
  }
  const start = candidates[Math.floor(rng() * candidates.length)] ?? 0;
  return sorted.slice(start, start + n);
}

/**
 * Sorteo: devuelve una asignación por participante en el orden de revelado.
 * Los favoritos tienen prioridad: se sortean primero entre ellos y el resto completa.
 */
export function drawTeams(
  participantIds: readonly string[],
  teams: readonly TeamLite[],
  options: DrawOptions,
  rng: Rng,
): DrawAssignment[] {
  const pool = filterPool(teams, options);
  const n = participantIds.length;
  if (n === 0) return [];
  if (pool.length === 0) throw new DrawError("Ningún equipo cumple los filtros del sorteo");
  if (options.avoidRepeats && pool.length < n) {
    throw new DrawError(
      `Solo hay ${pool.length} equipos disponibles para ${n} jugadores. Amplía los filtros o permite repetidos.`,
    );
  }

  let chosen: TeamLite[];
  if (options.avoidRepeats) {
    if (options.balanced) {
      const favs = pool.filter((t) => t.favorite);
      const base = favs.length >= n ? favs : pool;
      chosen = tightestWindow([...base].sort((a, b) => a.rating - b.rating), n, rng);
    } else {
      const favs = shuffle(pool.filter((t) => t.favorite), rng);
      const rest = shuffle(pool.filter((t) => !t.favorite), rng);
      chosen = [...favs, ...rest].slice(0, n);
    }
    chosen = shuffle(chosen, rng);
  } else {
    const base = options.balanced
      ? tightestWindow([...pool].sort((a, b) => a.rating - b.rating), Math.min(pool.length, Math.max(3, Math.ceil(n / 2))), rng)
      : pool;
    const favs = base.filter((t) => t.favorite);
    const source = favs.length > 0 ? favs : base;
    chosen = participantIds.map(() => source[Math.floor(rng() * source.length)] as TeamLite);
  }

  const order = shuffle(participantIds, rng);
  return order.map((participantId, i) => ({ participantId, teamId: (chosen[i] as TeamLite).id }));
}

export function ratingSpread(assignments: DrawAssignment[], teams: readonly TeamLite[]): number {
  const byId = new Map(teams.map((t) => [t.id, t.rating]));
  const ratings = assignments.map((a) => byId.get(a.teamId) ?? 0);
  return ratings.length ? Math.max(...ratings) - Math.min(...ratings) : 0;
}
