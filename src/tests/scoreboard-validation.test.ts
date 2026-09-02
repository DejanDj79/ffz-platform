import { describe, expect, it } from "vitest";
import { updateScoreboardSettingsSchema } from "@/lib/scoreboard/validation";

describe("scoreboard settings validation", () => {
  it("accepts Premiere creator settings", () => {
    const parsed = updateScoreboardSettingsSchema.parse({
      layout: "FULL",
      goalLabel: "FIRST REAL PAYOUT",
      tradingStyle: "SCALPING",
      instrumentsLabel: "MNQ / MES",
      seasonStartDate: "2026-09-01T00:00:00.000Z",
      scoreboardNotes: "Protect capital.\nFollow the plan.",
      refreshSeconds: 5,
    });

    expect(parsed.layout).toBe("FULL");
    expect(parsed.tradingStyle).toBe("SCALPING");
  });

  it("accepts null start date for challenge fallback", () => {
    const parsed = updateScoreboardSettingsSchema.parse({
      seasonStartDate: null,
    });

    expect(parsed.seasonStartDate).toBeNull();
  });

  it("rejects invalid refresh speed", () => {
    expect(() =>
      updateScoreboardSettingsSchema.parse({
        refreshSeconds: 1,
      }),
    ).toThrow();
  });
});
