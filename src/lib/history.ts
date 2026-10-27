/**
 * Historial competitivo entre amigos. Identidad de un jugador entre torneos:
 * su cuenta (user_id) y, si no tiene, su nombre normalizado (los invitados vuelven a usar el mismo nombre).
 */
export interface HParticipant { id: string; tournament_id: string; user_id: string | null; display_name: string; avatar_url?: string | null; avatar_color?: string }
export interface HMatch { id: string; tournament_id: string; home_id: string | null; away_id: string | null; mvp_id: string | null; played_at: string }
export interface HResult { match_id: string; home_score: number; away_score: number; home_pens: number | null; away_pens: number | null; fair_play_home: number; fair_play_away: number }
export interface HTournament { id: string; name: string; status: string; champion_participant_id: string | null }

export interface PlayerHistory {
  key: string;
  name: string;
  tournaments: number;
  titles: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  biggestWin: { diff: number; score: string; against: string } | null;
  biggestLoss: { diff: number; score: string; against: string } | null;
  mvps: number;
  fairPlay: number;
}

export interface HeadToHead {
  a: string;
  b: string;
  aWins: number;
  bWins: number;
  draws: number;
  aGoals: number;
  bGoals: number;
  last: { matchId: string; playedAt: string; aScore: number; bScore: number; tournament: string }[];
  biggest: { matchId: string; diff: number; aScore: number; bScore: number; winner: "a" | "b" } | null;
  streak: { who: "a" | "b" | null; length: number };
}

export const identityKey = (p: Pick<HParticipant, "user_id" | "display_name">) => (p.user_id ? `u:${p.user_id}` : `n:${p.display_name.trim().toLowerCase()}`);

interface Played { key: string; oppKey: string; oppName: string; gf: number; ga: number; at: string; matchId: string; tournamentId: string; pensWin: boolean | null; fair: number; mvp: boolean }

function flatten(participants: HParticipant[], matches: HMatch[], results: HResult[]): { played: Played[]; names: Map<string, string> } {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const resByMatch = new Map(results.map((r) => [r.match_id, r]));
  const names = new Map<string, string>();
  const played: Played[] = [];
  for (const m of matches) {
    const r = resByMatch.get(m.id);
    const h = m.home_id ? byId.get(m.home_id) : undefined;
    const a = m.away_id ? byId.get(m.away_id) : undefined;
    if (!r || !h || !a) continue;
    const hk = identityKey(h), ak = identityKey(a);
    names.set(hk, h.display_name);
    names.set(ak, a.display_name);
    const hp = r.home_pens, ap = r.away_pens;
    played.push({ key: hk, oppKey: ak, oppName: a.display_name, gf: r.home_score, ga: r.away_score, at: m.played_at, matchId: m.id, tournamentId: m.tournament_id, pensWin: hp !== null && ap !== null ? hp > ap : null, fair: r.fair_play_home, mvp: m.mvp_id === h.id });
    played.push({ key: ak, oppKey: hk, oppName: h.display_name, gf: r.away_score, ga: r.home_score, at: m.played_at, matchId: m.id, tournamentId: m.tournament_id, pensWin: hp !== null && ap !== null ? ap > hp : null, fair: r.fair_play_away, mvp: m.mvp_id === a.id });
  }
  return { played, names };
}

const outcome = (p: Played): "W" | "D" | "L" => (p.gf > p.ga ? "W" : p.gf < p.ga ? "L" : p.pensWin === null ? "D" : p.pensWin ? "W" : "L");

export function buildHistory(tournaments: HTournament[], participants: HParticipant[], matches: HMatch[], results: HResult[]): PlayerHistory[] {
  const { played, names } = flatten(participants, matches, results);
  const keys = new Set(participants.map(identityKey));
  const out: PlayerHistory[] = [];
  for (const key of keys) {
    const mine = played.filter((p) => p.key === key).sort((a, b) => a.at.localeCompare(b.at));
    const parts = participants.filter((p) => identityKey(p) === key);
    const titles = tournaments.filter((t) => t.status === "finished" && parts.some((p) => p.id === t.champion_participant_id)).length;
    let streak = 0, best = 0;
    for (const p of mine) {
      const o = outcome(p);
      streak = o === "W" ? Math.max(streak, 0) + 1 : o === "L" ? Math.min(streak, 0) - 1 : 0;
      best = Math.max(best, streak);
    }
    const won = mine.filter((p) => p.gf > p.ga).length;
    const lost = mine.filter((p) => p.gf < p.ga).length;
    const gf = mine.reduce((s, p) => s + p.gf, 0), ga = mine.reduce((s, p) => s + p.ga, 0);
    const bw = [...mine].filter((p) => p.gf > p.ga).sort((a, b) => b.gf - b.ga - (a.gf - a.ga))[0];
    const bl = [...mine].filter((p) => p.gf < p.ga).sort((a, b) => b.ga - b.gf - (a.ga - a.gf))[0];
    out.push({
      key, name: names.get(key) ?? parts[0]?.display_name ?? "?",
      tournaments: new Set(parts.map((p) => p.tournament_id)).size, titles,
      played: mine.length, won, drawn: mine.length - won - lost, lost,
      goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga,
      winRate: mine.length ? Math.round((won / mine.length) * 1000) / 10 : 0,
      currentStreak: streak, bestStreak: best,
      biggestWin: bw ? { diff: bw.gf - bw.ga, score: `${bw.gf}-${bw.ga}`, against: bw.oppName } : null,
      biggestLoss: bl ? { diff: bl.ga - bl.gf, score: `${bl.gf}-${bl.ga}`, against: bl.oppName } : null,
      mvps: mine.filter((p) => p.mvp).length, fairPlay: mine.reduce((s, p) => s + p.fair, 0),
    });
  }
  return out.sort((a, b) => b.titles - a.titles || b.winRate - a.winRate || a.name.localeCompare(b.name));
}

export function headToHead(a: string, b: string, tournaments: HTournament[], participants: HParticipant[], matches: HMatch[], results: HResult[]): HeadToHead {
  const { played } = flatten(participants, matches, results);
  const tName = new Map(tournaments.map((t) => [t.id, t.name]));
  const games = played.filter((p) => p.key === a && p.oppKey === b).sort((x, y) => x.at.localeCompare(y.at));
  let aWins = 0, bWins = 0, draws = 0, aGoals = 0, bGoals = 0;
  let biggest: HeadToHead["biggest"] = null;
  for (const g of games) {
    aGoals += g.gf; bGoals += g.ga;
    const o = outcome(g);
    if (o === "W") aWins++; else if (o === "L") bWins++; else draws++;
    const diff = Math.abs(g.gf - g.ga);
    if (diff > 0 && (!biggest || diff > biggest.diff)) biggest = { matchId: g.matchId, diff, aScore: g.gf, bScore: g.ga, winner: g.gf > g.ga ? "a" : "b" };
  }
  let who: "a" | "b" | null = null, length = 0;
  for (const g of [...games].reverse()) {
    const o = outcome(g);
    const w = o === "W" ? "a" : o === "L" ? "b" : null;
    if (!w) break;
    if (who === null) who = w;
    if (w !== who) break;
    length++;
  }
  return {
    a, b, aWins, bWins, draws, aGoals, bGoals, biggest, streak: { who, length },
    last: [...games].reverse().slice(0, 5).map((g) => ({ matchId: g.matchId, playedAt: g.at, aScore: g.gf, bScore: g.ga, tournament: tName.get(g.tournamentId) ?? "" })),
  };
}

export interface Rivalry extends HeadToHead {
  opponentName: string;
  games: number;
  /** "nemesis": el rival que más te gana; "victim": al que más le ganas; "even": rivalidad pareja con 3+ partidos. */
  tag: "nemesis" | "victim" | "even" | null;
}

/** Todas las rivalidades de un jugador (`a`) contra cada rival al que se ha enfrentado, la más jugada primero. */
export function rivalries(a: string, tournaments: HTournament[], participants: HParticipant[], matches: HMatch[], results: HResult[]): Rivalry[] {
  const { played, names } = flatten(participants, matches, results);
  const opponents = [...new Set(played.filter((p) => p.key === a).map((p) => p.oppKey))];
  const list = opponents.map((b) => {
    const h = headToHead(a, b, tournaments, participants, matches, results);
    return { ...h, opponentName: names.get(b) ?? "?", games: h.aWins + h.bWins + h.draws, tag: null as Rivalry["tag"] };
  });
  // Etiquetas: con al menos 2 partidos y una diferencia real de victorias
  const margin = (r: Rivalry) => r.aWins - r.bWins;
  const eligible = list.filter((r) => r.games >= 2);
  const nemesis = [...eligible].sort((x, y) => margin(x) - margin(y) || y.games - x.games)[0];
  const victim = [...eligible].sort((x, y) => margin(y) - margin(x) || y.games - x.games)[0];
  if (nemesis && margin(nemesis) < 0) nemesis.tag = "nemesis";
  if (victim && margin(victim) > 0 && victim !== nemesis) victim.tag = "victim";
  for (const r of list) if (!r.tag && r.games >= 3 && Math.abs(margin(r)) <= 1) r.tag = "even";
  return list.sort((x, y) => y.games - x.games || x.opponentName.localeCompare(y.opponentName));
}

export interface EloEntry {
  key: string;
  rating: number;
  /** Variación en el último partido (positivo = ganó puntos). */
  lastChange: number;
  peak: number;
  played: number;
}

export const ELO_START = 1000;
const ELO_K = 32;

/** Multiplicador por diferencia de goles (Elo de selecciones de fútbol): las goleadas mueven más el ranking. */
const goalFactor = (gd: number) => (gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8);

/**
 * Ranking Elo del grupo: recorre todos los partidos confirmados en orden cronológico.
 * Victoria por penales cuenta como victoria (sin multiplicador de goles).
 */
export function eloRatings(participants: HParticipant[], matches: HMatch[], results: HResult[]): Map<string, EloEntry> {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const resByMatch = new Map(results.map((r) => [r.match_id, r]));
  const table = new Map<string, EloEntry>();
  const entry = (key: string) => {
    let e = table.get(key);
    if (!e) table.set(key, (e = { key, rating: ELO_START, lastChange: 0, peak: ELO_START, played: 0 }));
    return e;
  };
  const ordered = [...matches].sort((a, b) => a.played_at.localeCompare(b.played_at) || a.id.localeCompare(b.id));
  for (const m of ordered) {
    const r = resByMatch.get(m.id);
    const h = m.home_id ? byId.get(m.home_id) : undefined;
    const a = m.away_id ? byId.get(m.away_id) : undefined;
    if (!r || !h || !a) continue;
    const eh = entry(identityKey(h)), ea = entry(identityKey(a));
    if (eh === ea) continue;
    let score = r.home_score > r.away_score ? 1 : r.home_score < r.away_score ? 0 : 0.5;
    if (score === 0.5 && r.home_pens !== null && r.away_pens !== null && r.home_pens !== r.away_pens) score = r.home_pens > r.away_pens ? 1 : 0;
    const expected = 1 / (1 + 10 ** ((ea.rating - eh.rating) / 400));
    const delta = Math.round(ELO_K * goalFactor(Math.abs(r.home_score - r.away_score)) * (score - expected));
    eh.rating += delta;
    ea.rating -= delta;
    eh.lastChange = delta;
    ea.lastChange = -delta;
    eh.peak = Math.max(eh.peak, eh.rating);
    ea.peak = Math.max(ea.peak, ea.rating);
    eh.played++;
    ea.played++;
  }
  return table;
}
