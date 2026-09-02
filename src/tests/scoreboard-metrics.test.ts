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
  startingBalance: 25000,
  currentBalance: 25000,
  profitTarget: 1500,
};

describe("scoreboard metrics", () => {
  it("uses explicitly selected challenge", () => {
    const selected = selectScoreboardChallenge(
      [
        base,
        { ...base, id: "b", status: "IN_PROGRESS" },
      ],
      "a",
    );

    expect(selected?.id).toBe("a");
  });

  it("auto-selects an in-progress challenge", () => {
    const selected = selectScoreboardChallenge(
      [
        base,
        { ...base, id: "b", status: "IN_PROGRESS" },
      ],
      null,
    );

    expect(selected?.id).toBe("b");
  });

  it("calculates challenge progress", () => {
    const result = calculateScoreboardChallenge({
      ...base,
      currentBalance: 25500,
    });

    expect(result?.pnl).toBe(500);
    expect(result?.targetRemaining).toBe(1000);
    expect(result?.targetProgressPct).toBeCloseTo(33.333, 2);
  });
});
