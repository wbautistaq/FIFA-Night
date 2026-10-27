import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/redirect";

describe("redirección segura tras el login", () => {
  it("acepta rutas internas", () => {
    expect(safeInternalPath("/t/abc/tabla")).toBe("/t/abc/tabla");
    expect(safeInternalPath("/historial?x=1")).toBe("/historial?x=1");
  });

  it("rechaza destinos externos y trucos de navegador", () => {
    for (const evil of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\tevil", "/a\\b", "", null]) {
      expect(safeInternalPath(evil)).toBe("/");
    }
  });
});
