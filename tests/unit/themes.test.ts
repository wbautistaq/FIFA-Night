import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, effectiveTheme, THEMES } from "@/lib/themes";

describe("themes", () => {
  it("usa Pizarra táctica como tema predeterminado", () => {
    expect(DEFAULT_THEME).toBe("pizarra");
    expect(THEMES[0]?.id).toBe("pizarra");
  });

  it("acepta cualquier paleta válida y descarta valores desconocidos", () => {
    expect(effectiveTheme("tv")).toBe("tv");
    expect(effectiveTheme("neon")).toBe("neon");
    expect(effectiveTheme("pastel")).toBe("pizarra");
    expect(effectiveTheme(null)).toBe("pizarra");
  });
});
