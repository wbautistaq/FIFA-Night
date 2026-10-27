import { describe, expect, it } from "vitest";
import { buildLiveBoard, playerTurn, typicalMinutes, DEFAULT_MATCH_MINUTES, type QueueMatch } from "@/lib/engine/queue";

let n = 0;
const m = (home: string | null, away: string | null, extra: Partial<QueueMatch> = {}): QueueMatch => ({
  id: `m${++n}`, round: 1, position: n, home_id: home, away_id: away, status: "pending", station: null, called_at: null, is_bye: false, ...extra,
});
const NOW = Date.parse("2026-10-27T20:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

describe("buildLiveBoard", () => {
  it("fills every free console without double-booking a player", () => {
    const ms = [m("A", "B"), m("A", "C"), m("C", "D"), m("B", "D")];
    const board = buildLiveBoard(ms, [], 3, NOW);
    const picks = board.stations.map((s) => s.suggestion).filter(Boolean) as QueueMatch[];
    expect(picks.map((x) => x.id)).toEqual([ms[0]!.id, ms[2]!.id]);
    expect(board.stations[2]!.suggestion).toBeNull();
    expect(board.queue.map((x) => x.id)).toEqual([ms[1]!.id, ms[3]!.id]);
  });

  it("keeps called and live matches on their console and blocks their players", () => {
    const live = m("A", "B", { station: 1, status: "live", called_at: ago(5) });
    const ms = [live, m("A", "C"), m("C", "D")];
    const board = buildLiveBoard(ms, [], 2, NOW);
    expect(board.stations[0]!.match?.id).toBe(live.id);
    expect(board.stations[1]!.suggestion?.id).toBe(ms[2]!.id);
  });

  it("prefers earlier rounds, then the most rested players", () => {
    const played = m("A", "B", { status: "finished" });
    const tired = m("A", "C", { round: 2 });
    const fresh = m("D", "E", { round: 2 });
    const later = m("F", "G", { round: 3 });
    const board = buildLiveBoard([played, later, tired, fresh], [{ match_id: played.id, played_at: ago(1) }], 1, NOW);
    expect(board.stations[0]!.suggestion?.id).toBe(fresh.id);
    expect(board.queue.map((x) => x.id)).toEqual([tired.id, later.id]);
  });

  it("counts matches still waiting for a rival and ignores byes", () => {
    const board = buildLiveBoard([m("A", null), m("A", "B", { is_bye: true }), m("C", "D")], [], 1, NOW);
    expect(board.blocked).toBe(1);
    expect(board.etaMinutes).toBe(2 * DEFAULT_MATCH_MINUTES);
  });

  it("frees the console once the match is finished", () => {
    const done = m("A", "B", { station: 1, status: "finished", called_at: ago(20) });
    const board = buildLiveBoard([done, m("A", "B")], [{ match_id: done.id, played_at: ago(5) }], 1, NOW);
    expect(board.stations[0]!.match).toBeNull();
    expect(board.stations[0]!.suggestion).not.toBeNull();
  });
});

describe("typicalMinutes", () => {
  it("uses the median call-to-result time and ignores outliers", () => {
    const a = m("A", "B", { called_at: ago(30) });
    const b = m("C", "D", { called_at: ago(30) });
    const c = m("E", "F", { called_at: ago(200) });
    const results = [{ match_id: a.id, played_at: ago(20) }, { match_id: b.id, played_at: ago(16) }, { match_id: c.id, played_at: ago(0) }];
    expect(typicalMinutes([a, b, c], results)).toBe(12);
  });
});

describe("playerTurn", () => {
  it("tells each player where they stand", () => {
    const called = m("A", "B", { station: 1, called_at: ago(1) });
    const ms = [called, m("C", "D"), m("E", "F"), m("A", "C")];
    const board = buildLiveBoard(ms, [], 2, NOW);
    expect(playerTurn(board, "A")).toMatchObject({ kind: "called", station: 1 });
    expect(playerTurn(board, "D")).toMatchObject({ kind: "next", station: 2 });
    expect(playerTurn(board, "E")).toMatchObject({ kind: "queued", ahead: 1 });
    expect(playerTurn(board, "Z")).toEqual({ kind: "none" });
  });
});
