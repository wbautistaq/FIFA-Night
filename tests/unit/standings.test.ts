import { describe, expect, it } from "vitest";
import { computeStandings, winnerOf, type PlayedMatch } from "@/lib/engine/standings";
import { scorePrediction } from "@/lib/engine/scoring";

const players = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Beto" },
  { id: "c", name: "Carla" },
  { id: "d", name: "Dani" },
];
const m = (homeId: string, awayId: string, h: number, a: number): PlayedMatch => ({
  homeId, awayId, result: { home_score: h, away_score: a },
});

describe("computeStandings", () => {
  it("calcula puntos, diferencia y posiciones", () => {
    const rows = computeStandings(players, [m("a", "b", 3, 0), m("c", "d", 1, 1), m("a", "c", 2, 2)]);
    const a = rows.find((r) => r.participantId === "a");
    expect(a).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4, goalDifference: 3, position: 1 });
    expect(rows.map((r) => r.participantId)).toEqual(["a", "c", "d", "b"]);
  });

  it("desempata por diferencia de gol, luego goles a favor", () => {
    const rows = computeStandings(players, [m("a", "c", 1, 0), m("b", "d", 4, 0)]);
    expect(rows[0]?.participantId).toBe("b");
  });

  it("usa resultado directo cuando todo lo demás empata", () => {
    // Ana y Beto: 3 pts, DG 0 y GF 1 — Ana venció directo a Beto
    const rows = computeStandings(
      players,
      [m("a", "b", 1, 0), m("b", "c", 1, 0), m("c", "a", 1, 0), m("d", "a", 0, 0)].slice(0, 2).concat([m("c", "d", 0, 0)]),
      ["points", "head_to_head", "alphabetical"],
    );
    const pos = Object.fromEntries(rows.map((r) => [r.participantId, r.position]));
    expect(pos.a).toBeLessThan(pos.b as number);
  });

  it("último recurso: orden alfabético", () => {
    const rows = computeStandings(players, []);
    expect(rows.map((r) => r.participantId)).toEqual(["a", "b", "c", "d"]);
  });

  it("ordena dentro de cada grupo", () => {
    const grouped = players.map((p, i) => ({ ...p, group: i < 2 ? "A" : "B" }));
    const rows = computeStandings(grouped, [m("b", "a", 2, 0), m("d", "c", 1, 0)]);
    expect(rows.filter((r) => r.position === 1).map((r) => r.participantId).sort()).toEqual(["b", "d"]);
  });

  it("configurable: puntos primero pero gol a favor antes que diferencia", () => {
    const rows = computeStandings(players, [m("a", "b", 5, 4), m("c", "d", 1, 0)], ["points", "goals_for", "goal_difference"]);
    expect(rows[0]?.participantId).toBe("a");
  });
});

describe("winnerOf y predicciones", () => {
  it("penales deciden empates", () => {
    expect(winnerOf({ homeId: "a", awayId: "b", result: { home_score: 1, away_score: 1, home_pens: 3, away_pens: 5 } })).toBe("b");
    expect(winnerOf(m("a", "b", 1, 1))).toBeNull();
  });
  it("3 por ganador + 2 por marcador exacto", () => {
    const match = m("a", "b", 2, 1);
    expect(scorePrediction({ predictedWinnerId: "a", homeScore: 2, awayScore: 1 }, match, true)).toBe(5);
    expect(scorePrediction({ predictedWinnerId: "a", homeScore: 3, awayScore: 0 }, match, true)).toBe(3);
    expect(scorePrediction({ predictedWinnerId: "a", homeScore: 2, awayScore: 1 }, match, false)).toBe(3);
    expect(scorePrediction({ predictedWinnerId: "b", homeScore: 0, awayScore: 1 }, match, true)).toBe(0);
  });
});
