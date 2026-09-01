import { describe, expect, it } from "vitest";
import { apiModelToChallenge, challengeToApiInput } from "@/lib/challenges/api-client";
import { createBlankChallenge } from "@/lib/challenges/defaults";

const apiModel = {
  id: "2d93e76b-71ac-4e13-931f-e81613658659",
  rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
  propFirm: "Blue Guardian Futures",
  name: "Standard 25K #1",
  status: "NOT_STARTED" as const,
  phase: "EVALUATION" as const,
  drawdownType: "EOD_TRAILING" as const,
  dailyLossBreachType: "NONE" as const,
  accountSize: 25000,
  startingBalance: 25000,
  currentBalance: 25000,
  highestEodBalance: 25000,
  todayPnl: -50,
  profitTarget: 1500,
  maxDrawdown: 1500,
  drawdownLockFloorOffset: 0,
  dailyLossLimit: null,
  challengeFee: 0,
  resetFee: 0,
  resetCount: 0,
  maxMiniContracts: 1,
  maxMicroContracts: 10,
  minimumTradingDays: null,
  daysTraded: 0,
  notes: "Development seed challenge.",
  createdAt: "2026-09-01T11:29:23.739Z",
  updatedAt: "2026-09-01T11:29:23.739Z",
};

describe("challenge API adapter", () => {
  it("maps nullable API rules into the planner model", () => {
    const challenge = apiModelToChallenge(apiModel);
    expect(challenge.dailyLossLimit).toBe(0);
    expect(challenge.maxMinis).toBe(1);
    expect(challenge.maxMicros).toBe(10);
    expect(challenge.todayPnl).toBe(-50);
    expect(challenge.drawdownMode).toBe("EOD_TRAILING");
  });

  it("maps planner model back to API input", () => {
    const challenge = {
      ...createBlankChallenge(),
      rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K" as const,
      propFirm: "Blue Guardian Futures",
      name: "Standard 25K #1",
      accountSize: 25000,
      startingBalance: 25000,
      currentBalance: 25000,
      highestEodBalance: 25000,
      profitTarget: 1500,
      maxDrawdown: 1500,
      dailyLossLimit: 0,
      maxMinis: 1,
      maxMicros: 10,
      dailyLossBreachType: "NONE" as const,
      drawdownMode: "EOD_TRAILING" as const,
    };
    const input = challengeToApiInput(challenge);
    expect(input.dailyLossLimit).toBeNull();
    expect(input.maxMiniContracts).toBe(1);
    expect(input.maxMicroContracts).toBe(10);
    expect(input.drawdownType).toBe("EOD_TRAILING");
  });
});
