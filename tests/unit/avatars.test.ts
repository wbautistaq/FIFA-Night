import { describe, expect, it } from "vitest";
import { AVATAR_GROUPS, GAMER_AVATARS, emojiAvatar, isValidEmojiAvatar } from "@/lib/avatars";

describe("avatares gamer", () => {
  it("ofrece al menos 64 avatares sin repetir", () => {
    expect(GAMER_AVATARS.length).toBeGreaterThanOrEqual(64);
    expect(new Set(GAMER_AVATARS.map((a) => a.emoji)).size).toBe(GAMER_AVATARS.length);
    expect(new Set(GAMER_AVATARS.map((a) => a.img)).size).toBe(GAMER_AVATARS.length);
    expect(new Set(GAMER_AVATARS.map((a) => a.label)).size).toBe(GAMER_AVATARS.length);
  });

  it("asigna cada avatar a un grupo existente y los valida", () => {
    const groups = new Set<string>(AVATAR_GROUPS.map((g) => g.id));
    for (const a of GAMER_AVATARS) {
      expect(groups.has(a.group)).toBe(true);
      expect(isValidEmojiAvatar(emojiAvatar(a.emoji))).toBe(true);
    }
  });
});
