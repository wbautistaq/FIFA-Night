import { describe, expect, it } from "vitest";
import { buildHistory, headToHead, identityKey, rivalries, type HMatch, type HParticipant, type HResult, type HTournament } from "@/lib/history";

const P = (id: string, t: string, name: string, user: string | null = null): HParticipant => ({ id, tournament_id: t, user_id: user, display_name: name });
const parts = [P("a1", "t1", "Ana", "ua"), P("b1", "t1", "Beto"), P("a2", "t2", "Ana", "ua"), P("b2", "t2", "beto ")];
const M = (id: string, t: string, h: string, a: string, at: string, mvp: string | null = null): HMatch => ({ id, tournament_id: t, home_id: h, away_id: a, mvp_id: mvp, played_at: at });
const R = (match_id: string, hs: number, as: number, hp: number | null = null, ap: number | null = null): HResult => ({ match_id, home_score: hs, away_score: as, home_pens: hp, away_pens: ap, fair_play_home: 1, fair_play_away: 0 });
const matches = [M("m1", "t1", "a1", "b1", "2026-01-01", "a1"), M("m2", "t1", "b1", "a1", "2026-01-02"), M("m3", "t2", "a2", "b2", "2026-02-01"), M("m4", "t2", "b2", "a2", "2026-02-02")];
const results = [R("m1", 3, 0), R("m2", 1, 1, 4, 5), R("m3", 2, 2), R("m4", 0, 4)];
const tournaments: HTournament[] = [{ id: "t1", name: "Uno", status: "finished", champion_participant_id: "a1" }, { id: "t2", name: "Dos", status: "in_progress", champion_participant_id: null }];

describe("historial entre amigos", () => {
  it("la identidad une cuentas y nombres normalizados", () => {
    expect(identityKey(parts[1] as HParticipant)).toBe(identityKey(parts[3] as HParticipant));
  });

  it("agrega estadísticas globales, títulos, rachas y mayor goleada", () => {
    const h = buildHistory(tournaments, parts, matches, results);
    const ana = h.find((x) => x.name === "Ana");
    expect(ana).toMatchObject({ tournaments: 2, titles: 1, played: 4, won: 2, drawn: 2, lost: 0, goalsFor: 10, goalsAgainst: 3, goalDifference: 7, winRate: 50, mvps: 1 });
    expect(ana?.bestStreak).toBe(2);
    expect(ana?.currentStreak).toBe(1);
    expect(ana?.biggestWin).toMatchObject({ diff: 4, score: "4-0", against: "beto " });
    const beto = h.find((x) => x.name.trim().toLowerCase() === "beto");
    expect(beto).toMatchObject({ played: 4, lost: 2, drawn: 2, won: 0 });
    expect(beto?.currentStreak).toBe(-1);
  });

  it("head-to-head: récord, goleada, racha vigente y últimos enfrentamientos", () => {
    const ana = identityKey(parts[0] as HParticipant), beto = identityKey(parts[1] as HParticipant);
    const hh = headToHead(ana, beto, tournaments, parts, matches, results);
    expect(hh).toMatchObject({ aWins: 3, bWins: 0, draws: 1, aGoals: 10, bGoals: 3 });
    expect(hh.biggest).toMatchObject({ diff: 4, winner: "a" });
    expect(hh.streak).toEqual({ who: "a", length: 1 });
    expect(hh.last).toHaveLength(4);
    expect(hh.last[0]?.tournament).toBe("Dos");
  });

  it("sin partidos devuelve ceros", () => {
    const hh = headToHead("u:x", "u:y", tournaments, parts, matches, results);
    expect(hh).toMatchObject({ aWins: 0, bWins: 0, draws: 0, biggest: null, streak: { who: null, length: 0 } });
  });
});

describe("rivalidades", () => {
  // Ana gana siempre a Beto; Caro le gana a Ana dos veces
  const ps = [...parts, P("c2", "t2", "Caro")];
  const ms = [...matches, M("m5", "t2", "c2", "a2", "2026-02-03"), M("m6", "t2", "a2", "c2", "2026-02-04")];
  const rs = [...results, R("m5", 2, 0), R("m6", 0, 1)];

  it("lista cada rival con su récord y etiqueta némesis y víctima favorita", () => {
    const ana = identityKey(parts[0] as HParticipant);
    const rv = rivalries(ana, tournaments, ps, ms, rs);
    expect(rv.map((r) => r.opponentName.trim())).toEqual(["beto", "Caro"]);
    expect(rv[0]).toMatchObject({ games: 4, aWins: 3, bWins: 0, tag: "victim" });
    expect(rv[1]).toMatchObject({ games: 2, aWins: 0, bWins: 2, tag: "nemesis" });
  });

  it("sin partidos no hay rivalidades", () => {
    expect(rivalries("u:nadie", tournaments, ps, ms, rs)).toEqual([]);
  });
});
