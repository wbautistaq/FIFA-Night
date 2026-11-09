import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, effectiveTheme, THEMES } from "@/lib/themes";

describe("themes", () => {
  it("usa Pizarra táctica como único tema gratuito y predeterminado", () => {
    expect(DEFAULT_THEME).toBe("pizarra");
    expect(THEMES.filter((t) => !t.premium).map((t) => t.id)).toEqual(["pizarra"]);
  });

  it("solo muestra paletas premium con el plan activo", () => {
    expect(effectiveTheme(false, "tv")).toBe("pizarra");
    expect(effectiveTheme(true, "tv")).toBe("tv");
    expect(effectiveTheme(true, "neon")).toBe("neon");
    expect(effectiveTheme(true, "pastel")).toBe("pizarra");
    expect(effectiveTheme(false, null)).toBe("pizarra");
  });
});
