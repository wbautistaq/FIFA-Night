import { describe, expect, it } from "vitest";
import { colombiaInputToIso, defaultStartInput, formatDate, formatDateTime, formatFullDateTime, formatTime, isoToColombiaInput } from "@/lib/datetime";

describe("hora de Colombia", () => {
  const iso = "2026-11-07T01:00:00.000Z"; // 20:00 del viernes 6 en Colombia

  it("converts what the user picks in Colombian time to UTC and back", () => {
    expect(colombiaInputToIso("2026-11-06T20:00")).toBe(iso);
    expect(isoToColombiaInput(iso)).toBe("2026-11-06T20:00");
  });

  it("formats in 12 hours regardless of where the code runs", () => {
    expect(formatTime(iso)).toBe("8:00 p. m.");
    expect(formatDate(iso)).toBe("vie 6 nov");
    expect(formatDateTime(iso)).toBe("vie 6 nov, 8:00 p. m.");
    expect(formatFullDateTime(iso)).toBe("6 nov 2026, 8:00 p. m.");
    expect(formatTime("2026-11-07T05:05:00.000Z")).toBe("12:05 a. m.");
    expect(formatTime("2026-11-06T17:30:00.000Z")).toBe("12:30 p. m.");
  });

  it("defaults to tomorrow at 20:00 in Colombia, even when UTC is already on the next day", () => {
    expect(defaultStartInput("2026-11-06T03:00:00.000Z")).toBe("2026-11-06T20:00");
  });
});
