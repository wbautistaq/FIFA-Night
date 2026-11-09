import { describe, expect, it } from "vitest";
import { staffRole } from "@/lib/staff";

describe("roles del equipo", () => {
  it("reconoce solo administrador y moderador", () => {
    expect(staffRole({ role: "admin" })).toBe("admin");
    expect(staffRole({ role: "moderator" })).toBe("moderator");
    expect(staffRole({ role: null })).toBeNull();
    expect(staffRole({ role: "superadmin" })).toBeNull();
    expect(staffRole(undefined)).toBeNull();
  });
});
