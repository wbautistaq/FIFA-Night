import type { Team } from "./types";

/** Estrellas del equipo; los equipos propios sin estrellas las derivan del rating (misma escala que el banco FC 26). */
export function teamStars(team: Pick<Team, "stars" | "rating">): number {
  if (team.stars != null) return Number(team.stars);
  return Math.min(5, Math.max(0.5, Math.round(((team.rating - 66) / 4) * 2) / 2));
}

/** Banco efectivo: la copia del torneo (si existe) reemplaza al equipo global del mismo nombre. */
export function effectiveTeams(teams: readonly Team[], tournamentId: string): Team[] {
  const own = new Map(teams.filter((t) => t.tournament_id === tournamentId).map((t) => [t.name.toLowerCase(), t]));
  const globals = teams.filter((t) => t.tournament_id === null && !own.has(t.name.toLowerCase()));
  return [...own.values(), ...globals].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}
