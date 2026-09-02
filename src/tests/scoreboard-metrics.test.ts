import { describe, expect, it } from "vitest";
import {
  calculateScoreboardChallenge,
  selectScoreboardChallenge,
} from "@/lib/scoreboard/metrics";

const base = {
  id: "a",
  name: "25K",
  propFirm: "Test",
  status: "NOT_STARTED",
  phase: "EVALUATION",

  accountSize: 25000,
  startingBalance: 25000,
  currentBalance: 25000,

  profitTarget: 1500,
  maxDrawdown: 1500,
  dailyLossLimit: null,

  daysTraded: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("scoreboard challenge metrics", () => {
  it("uses explicitly selected challenge", () => {
    const selected = selectScoreboardChallenge(
      [
        base,
        { ...base, id: "b", status: "ACTIVE" },
      ],
      "a",
    );

    expect(selected?.id).toBe("a");
  });

  it("auto-selects an active challenge", () => {
    const selected = selectScoreboardChallenge(
      [
        base,
        { ...base, id: "b", status: "ACTIVE" },
      ],
      null,
    );

    expect(selected?.id).toBe("b");
  });

  it("calculates challenge percentages", () => {
    const result = calculateScoreboardChallenge({
      ...base,
      currentBalance: 25500,
      dailyLossLimit: 500,
    });

    expect(result?.pnl).toBe(500);
    expect(result?.targetRemaining).toBe(1000);
    expect(result?.profitTargetPct).toBe(6);
    expect(result?.maxDrawdownPct).toBe(6);
    expect(result?.dailyLossLimitPct).toBe(2);
  });
});
