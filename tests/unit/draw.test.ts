import { describe, expect, it } from "vitest";
import { DEFAULT_DRAW_OPTIONS, DrawError, drawTeams, filterPool, ratingSpread, type TeamLite } from "@/lib/engine/draw";
import { seededRng } from "@/lib/engine/rng";

const teams: TeamLite[] = Array.from({ length: 30 }, (_, i) => ({
  id: `t${i}`,
  name: `Equipo ${i}`,
  league: i % 2 ? "Liga A" : "Liga B",
  country: i % 3 ? "Colombia" : "Brasil",
  rating: 60 + i,
  kind: i < 6 ? "national" : "club",
}));
const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("sorteo", () => {
  it("evita repetidos y asigna uno por jugador", () => {
    const res = drawTeams(ids, teams, DEFAULT_DRAW_OPTIONS, seededRng(1));
    expect(res).toHaveLength(8);
    expect(new Set(res.map((r) => r.teamId)).size).toBe(8);
    expect(new Set(res.map((r) => r.participantId))).toEqual(new Set(ids));
  });

  it("es reproducible con la misma semilla y cambia con otra", () => {
    const a = drawTeams(ids, teams, DEFAULT_DRAW_OPTIONS, seededRng(7));
    const b = drawTeams(ids, teams, DEFAULT_DRAW_OPTIONS, seededRng(7));
    const c = drawTeams(ids, teams, DEFAULT_DRAW_OPTIONS, seededRng(8));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("respeta filtros: sin selecciones, rating mínimo y prohibidos", () => {
    const banned = teams.map((t) => (t.id === "t20" ? { ...t, banned: true } : t));
    const pool = filterPool(banned, { ...DEFAULT_DRAW_OPTIONS, allowNational: false, minRating: 70 });
    expect(pool.every((t) => t.kind === "club" && t.rating >= 70 && t.id !== "t20")).toBe(true);
  });

  it("modo equilibrado reduce la diferencia de rating", () => {
    const rng = seededRng(3);
    const balanced = drawTeams(ids, teams, { ...DEFAULT_DRAW_OPTIONS, balanced: true }, rng);
    expect(ratingSpread(balanced, teams)).toBe(7);
    const random = drawTeams(ids, teams, DEFAULT_DRAW_OPTIONS, seededRng(3));
    expect(ratingSpread(balanced, teams)).toBeLessThanOrEqual(ratingSpread(random, teams));
  });

  it("favoritos entran primero", () => {
    const favs = teams.map((t) => (["t10", "t11", "t12"].includes(t.id) ? { ...t, favorite: true } : t));
    const res = drawTeams(ids, favs, DEFAULT_DRAW_OPTIONS, seededRng(5));
    const got = new Set(res.map((r) => r.teamId));
    for (const f of ["t10", "t11", "t12"]) expect(got.has(f)).toBe(true);
  });

  it("falla con mensaje claro si no alcanzan los equipos", () => {
    expect(() => drawTeams(ids, teams.slice(0, 4), DEFAULT_DRAW_OPTIONS, seededRng(1))).toThrow(DrawError);
    const res = drawTeams(ids, teams.slice(0, 4), { ...DEFAULT_DRAW_OPTIONS, avoidRepeats: false }, seededRng(1));
    expect(res).toHaveLength(8);
  });
});
