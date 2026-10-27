import { describe, expect, it } from "vitest";
import { nicknameSchema } from "@/lib/schemas";

describe("nicknameSchema", () => {
  it.each(["Calvo", "El Grinch", "jenn_99", "Ñandú", "Kike.10", "Pé-Rez"])("accepts %s", (n) => {
    expect(nicknameSchema.safeParse(n).success).toBe(true);
  });
  it.each(["ab", "   ", "_calvo", "a".repeat(21), "hola!", "<script>", "calvo@mail"])("rejects %s", (n) => {
    expect(nicknameSchema.safeParse(n).success).toBe(false);
  });
  it("trims surrounding spaces", () => {
    expect(nicknameSchema.parse("  Calvo  ")).toBe("Calvo");
  });
});
