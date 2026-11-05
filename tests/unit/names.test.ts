import { describe, expect, it } from "vitest";
import { normName, playerName } from "@/lib/names";

describe("normName", () => {
  it("treats spelling variants of a name as the same person", () => {
    for (const v of ["Beto", "BETO", "Betó", " beto ", "BÉTO"]) expect(normName(v)).toBe("beto");
    expect(normName("Beto  Pérez")).toBe(normName("beto perez"));
    expect(normName("Ñandú")).toBe("nandu");
  });
  it("keeps different names apart", () => {
    expect(normName("Beto")).not.toBe(normName("Beto2"));
    expect(normName("Ana María")).not.toBe(normName("AnaMaria"));
  });
});

describe("playerName", () => {
  it("prefers the nickname and falls back to the name", () => {
    expect(playerName({ nickname: "Calvo", display_name: "William Bautista" })).toBe("Calvo");
    expect(playerName({ nickname: null, display_name: "Invitado" })).toBe("Invitado");
    expect(playerName({ nickname: "  ", display_name: "Invitado" })).toBe("Invitado");
  });
});
