import { describe, expect, it } from "vitest";
import { pairKey, rankSwiss, recommendedSwissRounds, swissPairings, type SwissPlayer } from "@/lib/engine/swiss";
import { generateFixtures } from "@/lib/engine/fixtures";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";
import { seededRng } from "@/lib/engine/rng";

const players = (n: number): SwissPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, points: 0, goalDifference: 0, goalsFor: 0 }));

describe("sistema suizo", () => {
  it("rondas recomendadas: ⌈log₂ n⌉ con mínimo 3 y sin pasar de n − 1", () => {
    expect(recommendedSwissRounds(4)).toBe(3);
    expect(recommendedSwissRounds(8)).toBe(3);
    expect(recommendedSwissRounds(16)).toBe(4);
    expect(recommendedSwissRounds(3)).toBe(2);
  });

  it("empareja por clasificación y evita rivales repetidos", () => {
    const ranked = rankSwiss([
      { id: "a", points: 6, goalDifference: 4, goalsFor: 6 },
      { id: "b", points: 6, goalDifference: 2, goalsFor: 5 },
      { id: "c", points: 3, goalDifference: 0, goalsFor: 3 },
      { id: "d", points: 0, goalDifference: -6, goalsFor: 1 },
    ]);
    // a y b ya jugaron: a debe enfrentar al siguiente disponible
    const { pairs, bye } = swissPairings(ranked, new Set([pairKey("a", "b")]), new Set());
    expect(bye).toBeNull();
    expect(pairs).toEqual([["a", "c"], ["b", "d"]]);
  });

  it("con número impar descansa el peor clasificado que aún no descansó", () => {
    const ranked = players(5);
    const first = swissPairings(ranked, new Set(), new Set());
    expect(first.bye).toBe("p5");
    const second = swissPairings(ranked, new Set(), new Set(["p5"]));
    expect(second.bye).toBe("p4");
    expect(second.pairs.flat()).not.toContain("p4");
  });

  it("si no hay forma de evitar una repetición, la permite en lugar de dejar a alguien sin rival", () => {
    const ranked = players(2);
    const { pairs } = swissPairings(ranked, new Set([pairKey("p1", "p2")]), new Set());
    expect(pairs).toEqual([["p1", "p2"]]);
  });

  it("simulación: 8 jugadores, 3 rondas, nadie repite rival y todos juegan cada ronda", () => {
    const rng = seededRng(7);
    const table = new Map(players(8).map((p) => [p.id, { ...p }]));
    const played = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const { pairs, bye } = swissPairings(rankSwiss([...table.values()]), played, new Set());
      expect(bye).toBeNull();
      expect(new Set(pairs.flat()).size).toBe(8);
      for (const [h, a] of pairs) {
        expect(played.has(pairKey(h, a))).toBe(false);
        played.add(pairKey(h, a));
        const winner = rng() < 0.5 ? h : a;
        table.get(winner)!.points += 3;
      }
    }
    expect(played.size).toBe(12);
  });

  it("el motor de calendarios genera solo la primera ronda del suizo", () => {
    const plan = generateFixtures("swiss", players(6).map((p) => ({ id: p.id, display_name: p.id })), DEFAULT_SETTINGS);
    expect(plan.matches).toHaveLength(3);
    expect(plan.matches.every((m) => m.round === 1 && m.stage === "league")).toBe(true);
  });
});
