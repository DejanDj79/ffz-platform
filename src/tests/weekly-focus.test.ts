import { describe, expect, it } from "vitest";
import { weeklyFocusSaveSchema } from "@/lib/weekly-focus/validation";
import { localDateKey, shiftWeekStartKey, weeklyFocusWeekStartKey } from "@/lib/weekly-focus/week";

describe("weekly focus", () => {
  it("uses local Monday as the stable week key", () => {
    expect(weeklyFocusWeekStartKey(new Date(2026, 8, 9, 14, 0))).toBe("2026-09-07");
    expect(weeklyFocusWeekStartKey(new Date(2026, 8, 13, 23, 30))).toBe("2026-09-07");
    expect(shiftWeekStartKey("2026-09-07", 1)).toBe("2026-09-14");
    expect(localDateKey(new Date(2026, 8, 14, 12, 0))).toBe("2026-09-14");
  });

  it("validates and normalizes a persisted weekly commitment", () => {
    const parsed = weeklyFocusSaveSchema.parse({
      weekStart: "2026-09-14",
      primaryFocus: "  Slow down after losses  ",
      rule: "  Wait 15 minutes before considering another entry.  ",
      whyItMatters: "  Rapid re-entry hurt execution this week.  ",
      sourceSignalKey: "RAPID_REENTRY",
    });

    expect(parsed.primaryFocus).toBe("Slow down after losses");
    expect(parsed.rule).toBe("Wait 15 minutes before considering another entry.");
    expect(parsed.whyItMatters).toBe("Rapid re-entry hurt execution this week.");
    expect(parsed.status).toBe("ACTIVE");
  });

  it("rejects unsupported status, signal and malformed week keys", () => {
    expect(() => weeklyFocusSaveSchema.parse({
      weekStart: "09/14/2026",
      primaryFocus: "Valid focus",
      rule: "Valid rule",
    })).toThrow();

    expect(() => weeklyFocusSaveSchema.parse({
      weekStart: "2026-09-14",
      primaryFocus: "Valid focus",
      rule: "Valid rule",
      status: "DONE",
      sourceSignalKey: "REVENGE_INFERRED",
    })).toThrow();
  });
});
