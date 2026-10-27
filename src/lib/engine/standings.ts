import type { ResultLike, Tiebreaker, TournamentSettings } from "./types";

export interface StandingPlayer {
  id: string;
  name: string;
  group?: string;
}

export interface PlayedMatch {
  homeId: string;
  awayId: string;
  result: ResultLike;
}

export interface StandingRow {
  participantId: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

export function winnerOf(match: PlayedMatch): string | null {
  const { result: r } = match;
  if (r.home_score > r.away_score) return match.homeId;
  if (r.home_score < r.away_score) return match.awayId;
  if (r.home_pens != null && r.away_pens != null) {
    if (r.home_pens > r.away_pens) return match.homeId;
    if (r.home_pens < r.away_pens) return match.awayId;
  }
  return null;
}

/**
 * Tabla de posiciones: misma semántica que `recompute_standings` en SQL.
 * Solo recibe partidos con resultado CONFIRMADO. El "resultado directo" suma los puntos
 * obtenidos entre los jugadores empatados a puntos dentro del mismo grupo.
 */
export function computeStandings(
  players: readonly StandingPlayer[],
  matches: readonly PlayedMatch[],
  tiebreakers: TournamentSettings["tiebreakers"] = [
    "points",
    "goal_difference",
    "goals_for",
    "head_to_head",
    "alphabetical",
  ],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    players.map((p) => [
      p.id,
      {
        participantId: p.id,
        group: p.group ?? "",
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        position: 0,
      },
    ]),
  );

  for (const m of matches) {
    const home = rows.get(m.homeId);
    const away = rows.get(m.awayId);
    if (!home || !away) continue;
    const { home_score: hs, away_score: as } = m.result;
    for (const [row, gf, ga] of [
      [home, hs, as],
      [away, as, hs],
    ] as const) {
      row.played += 1;
      row.goalsFor += gf;
      row.goalsAgainst += ga;
      if (gf > ga) {
        row.won += 1;
        row.points += 3;
      } else if (gf === ga) {
        row.drawn += 1;
        row.points += 1;
      } else row.lost += 1;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    }
  }

  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const h2h = (row: StandingRow): number => {
    const tied = new Set(
      [...rows.values()]
        .filter((o) => o.group === row.group && o.points === row.points && o.participantId !== row.participantId)
        .map((o) => o.participantId),
    );
    let pts = 0;
    for (const m of matches) {
      const involvesRow = m.homeId === row.participantId || m.awayId === row.participantId;
      const other = m.homeId === row.participantId ? m.awayId : m.homeId;
      if (!involvesRow || !tied.has(other)) continue;
      const { home_score: hs, away_score: as } = m.result;
      if (hs === as) pts += 1;
      else if ((m.homeId === row.participantId) === hs > as) pts += 3;
    }
    return pts;
  };

  const key = (row: StandingRow, c: Tiebreaker["id"]): number => {
    switch (c) {
      case "points":
        return row.points;
      case "goal_difference":
        return row.goalDifference;
      case "goals_for":
        return row.goalsFor;
      case "head_to_head":
        return h2h(row);
      default:
        return 0;
    }
  };

  const keys = new Map([...rows.values()].map((r) => [r.participantId, tiebreakers.map((c) => key(r, c))]));
  const groups = new Map<string, StandingRow[]>();
  for (const r of rows.values()) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);

  for (const list of groups.values()) {
    list.sort((a, b) => {
      const ka = keys.get(a.participantId) ?? [];
      const kb = keys.get(b.participantId) ?? [];
      for (let i = 0; i < ka.length; i++) {
        const d = (kb[i] ?? 0) - (ka[i] ?? 0);
        if (d !== 0) return d;
      }
      return (nameOf.get(a.participantId) ?? "").localeCompare(nameOf.get(b.participantId) ?? "", "es", {
        sensitivity: "base",
      });
    });
    list.forEach((r, i) => (r.position = i + 1));
  }

  return [...rows.values()].sort((a, b) => a.group.localeCompare(b.group) || a.position - b.position);
}
