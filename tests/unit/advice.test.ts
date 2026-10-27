import { describe, expect, it } from "vitest";
import { bestGroups, formatAdvice, groupSizes } from "@/lib/engine/advice";
import { generateFixtures } from "@/lib/engine/fixtures";
import { DEFAULT_SETTINGS } from "@/lib/engine/types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, display_name: `P${i}` }));

describe("groupSizes", () => {
  it("matches the snake distribution of the fixture generator", () => {
    for (const [n, gs] of [[7, 4], [9, 3], [11, 4], [13, 5]] as const) {
      const plan = generateFixtures("groups_playoffs", ids(n), { ...DEFAULT_SETTINGS, group_size: gs, qualifiers_per_group: 1 });
      const counts = Object.values(plan.groups).reduce<Record<string, number>>((acc, g) => ({ ...acc, [g]: (acc[g] ?? 0) + 1 }), {});
      expect(Object.values(counts).sort()).toEqual(groupSizes(n, gs).sort());
    }
  });
});

describe("bestGroups", () => {
  it("builds even-ish groups whose qualifiers fill an exact bracket", () => {
    expect(bestGroups(7)).toMatchObject({ sizes: [4, 3], qualifiers: 2 });
    expect(bestGroups(9)?.sizes.length).toBeGreaterThanOrEqual(2);
    for (let n = 6; n <= 32; n++) {
      const g = bestGroups(n);
      if (!g) continue;
      const q = g.sizes.length * g.qualifiers;
      expect(q & (q - 1)).toBe(0);
      expect(g.qualifiers).toBeLessThan(Math.min(...g.sizes));
      // La configuración sugerida tiene que ser válida para el generador
      expect(() => generateFixtures("groups_playoffs", ids(n), { ...DEFAULT_SETTINGS, group_size: g.groupSize, qualifiers_per_group: g.qualifiers })).not.toThrow();
    }
  });
});

describe("formatAdvice", () => {
  it("explains rests and byes for an odd number of players", () => {
    const a = formatAdvice(5);
    expect(a.odd).toBe(true);
    const league = a.options.find((o) => o.id === "league")!;
    expect(league.matches).toBe(10);
    expect(league.recommended).toBe(true);
    expect(league.points[0]).toMatch(/descansa 1/);
    const cup = a.options.find((o) => o.id === "cup")!;
    expect(cup.summary).toMatch(/3 jugadores pasan directo/);
    expect(a.tip).toMatch(/1 jugador más \(6\)/);
  });

  it("recommends what fits in a night, taking the consoles into account", () => {
    expect(formatAdvice(7).options.find((o) => o.recommended)?.id).toBe("groups");
    expect(formatAdvice(7, { stations: 2 }).options.find((o) => o.recommended)?.id).toBe("league");
    // Nada cabe en 3 h con una consola: se recomienda la opción más corta que no deja a nadie con 1 partido
    expect(formatAdvice(13).options.find((o) => o.recommended)?.id).toBe("groups");
    expect(formatAdvice(5).options.find((o) => o.recommended)?.id).toBe("league");
  });

  it("respects the allowed formats", () => {
    const quick = formatAdvice(9, { formats: ["league", "cup", "swiss"] });
    expect(quick.options.map((o) => o.id)).toEqual(["league", "cup", "swiss"]);
    expect(quick.options.filter((o) => o.recommended)).toHaveLength(1);
  });

  it("estimates the night length with several consoles", () => {
    const one = formatAdvice(8, { stations: 1 }).options.find((o) => o.id === "league")!;
    const two = formatAdvice(8, { stations: 2 }).options.find((o) => o.id === "league")!;
    expect(two.minutes).toBeLessThan(one.minutes);
  });
});
