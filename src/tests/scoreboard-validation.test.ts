import { describe, expect, it } from "vitest";
import { updateScoreboardSettingsSchema } from "@/lib/scoreboard/validation";

describe("scoreboard settings validation", () => {
  it("accepts normal scoreboard settings", () => {
    const parsed = updateScoreboardSettingsSchema.parse({
      layout: "COMPACT",
      goalLabel: "FIRST REAL PAYOUT",
      refreshSeconds: 5,
      isEnabled: true,
      showBalance: true,
      showWinRate: false,
    });

    expect(parsed.layout).toBe("COMPACT");
    expect(parsed.refreshSeconds).toBe(5);
  });

  it("rejects refresh faster than two seconds", () => {
    expect(() =>
      updateScoreboardSettingsSchema.parse({
        refreshSeconds: 1,
      }),
    ).toThrow();
  });

  it("rejects an empty goal label", () => {
    expect(() =>
      updateScoreboardSettingsSchema.parse({
        goalLabel: "   ",
      }),
    ).toThrow();
  });
});
