import { describe, expect, it } from "vitest";
import { generateFixtures, nextPow2, roundRobin, seedOrder } from "@/lib/engine/fixtures";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, display_name: `P${i + 1}` }));

describe("roundRobin", () => {
  it.each([4, 5, 6, 7, 8])("cada par se enfrenta una vez con %i jugadores", (n) => {
    const ids = people(n).map((p) => p.id);
    const rounds = roundRobin(ids);
    const seen = new Set<string>();
    for (const r of rounds) for (const [a, b] of r.pairs) {
      const key = [a, b].sort().join("-");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
  });

  it("con número impar descansa exactamente un jugador por jornada", () => {
    const rounds = roundRobin(people(5).map((p) => p.id));
    expect(rounds).toHaveLength(5);
    for (const r of rounds) {
      expect(r.pairs).toHaveLength(2);
      expect(r.resting).toBeDefined();
    }
    expect(new Set(rounds.map((r) => r.resting)).size).toBe(5);
  });

  it("ida y vuelta invierte la localía", () => {
    const rounds = roundRobin(["a", "b", "c", "d"], true);
    expect(rounds).toHaveLength(6);
    const first = new Set(rounds.slice(0, 3).flatMap((r) => r.pairs.map(([h, a]) => `${h}>${a}`)));
    const second = rounds.slice(3).flatMap((r) => r.pairs.map(([h, a]) => `${a}>${h}`));
    for (const s of second) expect(first.has(s)).toBe(true);
  });
});

describe("siembra", () => {
  it("nextPow2", () => {
    expect([1, 3, 4, 5, 8, 9, 17].map(nextPow2)).toEqual([1, 4, 4, 8, 8, 16, 32]);
  });
  it("seedOrder estándar", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("generateFixtures", () => {
  it("liga: n(n-1)/2 partidos y ida y vuelta duplica", () => {
    expect(generateFixtures("league", people(6), DEFAULT_SETTINGS).matches).toHaveLength(15);
    expect(generateFixtures("league_double", people(6), DEFAULT_SETTINGS).matches).toHaveLength(30);
  });

  it("copa de 8: 7 partidos enlazados hasta la final", () => {
    const plan = generateFixtures("cup", people(8), DEFAULT_SETTINGS);
    expect(plan.matches).toHaveLength(7);
    expect(plan.matches.filter((m) => !m.next_match_id)).toHaveLength(1);
  });

  it("copa de 6 marca byes y con tercer puesto agrega un partido", () => {
    const plan = generateFixtures("cup", people(6), { ...DEFAULT_SETTINGS, third_place: true });
    const byes = plan.matches.filter((m) => m.home_empty || m.away_empty);
    expect(byes).toHaveLength(2);
    expect(plan.matches.filter((m) => m.stage === "third_place")).toHaveLength(1);
    expect(plan.brackets[0]?.has_third_place).toBe(true);
  });

  it("doble eliminación de 8: 14 partidos + final, todos los perdedores tienen destino", () => {
    const plan = generateFixtures("double_elimination", people(8), DEFAULT_SETTINGS);
    expect(plan.matches.filter((m) => m.stage === "winners")).toHaveLength(7);
    expect(plan.matches.filter((m) => m.stage === "losers")).toHaveLength(6);
    expect(plan.matches.filter((m) => m.stage === "grand_final")).toHaveLength(1);
    for (const m of plan.matches.filter((x) => x.stage === "winners")) expect(m.loser_next_match_id).toBeDefined();
  });

  it("grupos + playoffs: 2 grupos de 4, 12 partidos de grupo y 3 de playoffs con siembra", () => {
    const plan = generateFixtures("groups_playoffs", people(8), DEFAULT_SETTINGS);
    expect(plan.matches.filter((m) => m.stage === "group")).toHaveLength(12);
    const ko = plan.matches.filter((m) => m.stage === "knockout");
    expect(ko).toHaveLength(3);
    expect(ko.filter((m) => m.round === 1).every((m) => m.home_seed && m.away_seed)).toBe(true);
    expect(new Set(Object.values(plan.groups))).toEqual(new Set(["A", "B"]));
  });

  it("rechaza menos de 4 jugadores y clasificados imposibles", () => {
    expect(() => generateFixtures("league", people(3), DEFAULT_SETTINGS)).toThrow();
    expect(() => generateFixtures("groups_playoffs", people(8), { ...DEFAULT_SETTINGS, qualifiers_per_group: 5 })).toThrow();
  });

  it("amistosos no generan calendario inicial", () => {
    expect(generateFixtures("friendlies", people(4), DEFAULT_SETTINGS).matches).toHaveLength(0);
  });
});
