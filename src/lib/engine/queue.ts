/**
 * Cola de la noche en vivo: reparte los partidos pendientes entre las consolas.
 * Prioriza la ronda más temprana y, dentro de ella, a quien lleva más tiempo descansando,
 * y nunca pone a un jugador en dos consolas a la vez.
 */

export interface QueueMatch {
  id: string;
  round: number;
  position: number;
  home_id: string | null;
  away_id: string | null;
  status: "pending" | "live" | "finished" | "disputed" | "cancelled";
  station: number | null;
  called_at: string | null;
  is_bye: boolean;
}

export interface QueueResult {
  match_id: string;
  played_at: string;
}

export interface StationSlot {
  station: number;
  /** Partido llamado o en juego en esta consola. */
  match: QueueMatch | null;
  /** Si está libre: el siguiente partido que conviene llamar. */
  suggestion: QueueMatch | null;
}

export interface LiveBoard {
  stations: StationSlot[];
  /** Partidos listos para jugar que esperan consola, en orden (sin los sugeridos). */
  queue: QueueMatch[];
  /** Partidos que aún esperan rival (p. ej. llaves por definir). */
  blocked: number;
  /** Duración típica de un partido en minutos (medida o 12 por defecto). */
  avgMinutes: number;
  /** Minutos estimados para terminar todo lo pendiente. */
  etaMinutes: number;
}

export const DEFAULT_MATCH_MINUTES = 12;

const players = (m: QueueMatch) => [m.home_id, m.away_id].filter((x): x is string => Boolean(x));
const occupies = (m: QueueMatch) => m.station !== null && (m.status === "pending" || m.status === "live");

/** Mediana de lo que tarda un partido desde que se llama hasta el resultado (3–60 min). */
export function typicalMinutes(matches: readonly QueueMatch[], results: readonly QueueResult[]): number {
  const playedAt = new Map(results.map((r) => [r.match_id, Date.parse(r.played_at)]));
  const mins = matches
    .filter((m) => m.called_at && playedAt.has(m.id))
    .map((m) => (playedAt.get(m.id)! - Date.parse(m.called_at!)) / 60000)
    .filter((x) => x >= 3 && x <= 60)
    .sort((a, b) => a - b);
  if (!mins.length) return DEFAULT_MATCH_MINUTES;
  const mid = Math.floor(mins.length / 2);
  return Math.round(mins.length % 2 ? mins[mid]! : (mins[mid - 1]! + mins[mid]!) / 2);
}

export function buildLiveBoard(matches: readonly QueueMatch[], results: readonly QueueResult[], stationCount: number, now = Date.now()): LiveBoard {
  const count = Math.max(1, Math.min(8, Math.floor(stationCount)));
  const active = matches.filter(occupies);
  const busy = new Set(active.flatMap(players));

  // Último partido jugado por cada uno, para dar prioridad a quien más ha descansado
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const lastPlayed = new Map<string, number>();
  for (const r of results) {
    const m = matchById.get(r.match_id);
    if (!m) continue;
    const at = Date.parse(r.played_at);
    for (const p of players(m)) lastPlayed.set(p, Math.max(lastPlayed.get(p) ?? 0, at));
  }
  const rest = (m: QueueMatch) => Math.min(...players(m).map((p) => (lastPlayed.has(p) ? now - lastPlayed.get(p)! : Number.POSITIVE_INFINITY)));

  const pending = matches.filter((m) => m.status === "pending" && !m.is_bye && m.station === null);
  const ready = pending.filter((m) => m.home_id && m.away_id)
    .sort((a, b) => a.round - b.round || rest(b) - rest(a) || a.position - b.position);
  const blocked = pending.length - ready.length;

  const used = new Set(busy);
  const suggested = new Set<string>();
  const stations: StationSlot[] = [];
  for (let s = 1; s <= count; s++) {
    const match = active.find((m) => m.station === s) ?? null;
    let suggestion: QueueMatch | null = null;
    if (!match) {
      suggestion = ready.find((m) => !suggested.has(m.id) && players(m).every((p) => !used.has(p))) ?? null;
      if (suggestion) {
        suggested.add(suggestion.id);
        players(suggestion).forEach((p) => used.add(p));
      }
    }
    stations.push({ station: s, match, suggestion });
  }

  const avgMinutes = typicalMinutes(matches, results);
  const remaining = ready.length + blocked + active.length;
  return {
    stations,
    queue: ready.filter((m) => !suggested.has(m.id)),
    blocked,
    avgMinutes,
    etaMinutes: Math.ceil(remaining / count) * avgMinutes,
  };
}

/** Dónde está un jugador en la noche: jugando, llamado, o cuántos partidos faltan para su turno. */
export type PlayerTurn =
  | { kind: "called"; station: number; match: QueueMatch }
  | { kind: "playing"; station: number; match: QueueMatch }
  | { kind: "next"; station: number; match: QueueMatch }
  | { kind: "queued"; ahead: number; match: QueueMatch }
  | { kind: "none" };

export function playerTurn(board: LiveBoard, participantId: string): PlayerTurn {
  const has = (m: QueueMatch) => m.home_id === participantId || m.away_id === participantId;
  for (const s of board.stations) {
    if (s.match && has(s.match)) return { kind: s.match.status === "live" ? "playing" : "called", station: s.station, match: s.match };
  }
  for (const s of board.stations) {
    if (s.suggestion && has(s.suggestion)) return { kind: "next", station: s.station, match: s.suggestion };
  }
  const idx = board.queue.findIndex(has);
  return idx >= 0 ? { kind: "queued", ahead: idx + board.stations.filter((s) => s.suggestion).length, match: board.queue[idx]! } : { kind: "none" };
}
