import { describe, expect, it } from "vitest";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import { normalizeChallenge } from "@/lib/challenges/defaults";
import {
  BLUE_GUARDIAN_FUTURES_STANDARD_25K,
  TOPSTEP_TRADING_COMBINE_STANDARD_50K,
  TRADEIFY_SELECT_50K,
} from "@/lib/prop-firms/presets";
import type { Challenge } from "@/lib/challenges/types";

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: "test",
    propFirm: "Test Firm",
    name: "50K",
    accountSize: 50000,
    startingBalance: 50000,
    profitTarget: 3000,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
    challengeFee: 50,
    resetFee: 25,
    resetsUsed: 0,
    minimumTradingDays: 5,
    currentBalance: 50000,
    todayPnl: 0,
    daysTraded: 0,
    status: "IN_PROGRESS",
    phase: "EVALUATION",
    notes: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    rulesPresetId: "CUSTOM",
    drawdownMode: "STATIC",
    highestEodBalance: 50000,
    drawdownLockFloorOffset: 0,
    dailyLossBreachType: "HARD",
    maxMinis: null,
    maxMicros: null,
    ...overrides,
  };
}

describe("calculateChallengeMetrics", () => {
  it("calculates target progress and remaining target", () => {
    const result = calculateChallengeMetrics(challenge({ currentBalance: 51500 }));
    expect(result.currentPnl).toBe(1500);
    expect(result.targetProgressPct).toBe(50);
    expect(result.profitTargetRemaining).toBe(1500);
  });

  it("keeps a static drawdown floor fixed while profits increase the buffer", () => {
    const result = calculateChallengeMetrics(challenge({ currentBalance: 51500 }));
    expect(result.drawdownFloor).toBe(48000);
    expect(result.remainingDrawdown).toBe(3500);
  });

  it("reduces static remaining drawdown after losses", () => {
    const result = calculateChallengeMetrics(challenge({ currentBalance: 49250 }));
    expect(result.remainingDrawdown).toBe(1250);
    expect(result.remainingDrawdownPct).toBe(62.5);
  });

  it("consumes daily loss allowance only for negative daily P&L", () => {
    expect(calculateChallengeMetrics(challenge({ todayPnl: -400 })).remainingDailyLoss).toBe(600);
    expect(calculateChallengeMetrics(challenge({ todayPnl: 400 })).remainingDailyLoss).toBe(1000);
  });

  it("treats zero daily loss limit as no daily limit", () => {
    const result = calculateChallengeMetrics(challenge({ dailyLossLimit: 0 }));
    expect(result.remainingDailyLoss).toBeNull();
    expect(result.remainingDailyLossPct).toBeNull();
    expect(result.health).toBe("SAFE");
  });

  it("calculates an EOD trailing floor from the highest EOD balance", () => {
    const result = calculateChallengeMetrics(challenge({
      startingBalance: 25000,
      currentBalance: 25800,
      maxDrawdown: 1500,
      drawdownMode: "EOD_TRAILING",
      highestEodBalance: 26000,
      drawdownLockFloorOffset: 100,
      dailyLossLimit: 0,
    }));
    expect(result.drawdownFloor).toBe(24500);
    expect(result.remainingDrawdown).toBe(1300);
  });

  it("locks the Blue Guardian evaluation EOD floor at starting balance", () => {
    const result = calculateChallengeMetrics(challenge({
      startingBalance: 25000,
      currentBalance: 27000,
      maxDrawdown: 1500,
      drawdownMode: "EOD_TRAILING",
      highestEodBalance: 27000,
      drawdownLockFloorOffset: 0,
      dailyLossLimit: 0,
    }));
    expect(result.drawdownFloor).toBe(25000);
    expect(result.remainingDrawdown).toBe(2000);
  });

  it("keeps trailing above starting balance when the evaluation has no drawdown lock", () => {
    const result = calculateChallengeMetrics(challenge({
      startingBalance: 50000,
      currentBalance: 53000,
      maxDrawdown: 2000,
      drawdownMode: "EOD_TRAILING",
      highestEodBalance: 53000,
      drawdownLockFloorOffset: -1,
      dailyLossLimit: 0,
    }));
    expect(result.drawdownFloor).toBe(51000);
    expect(result.remainingDrawdown).toBe(2000);
  });

  it("supports the Blue Guardian post-payout +$100 funded floor when explicitly configured", () => {
    const result = calculateChallengeMetrics(challenge({
      startingBalance: 25000,
      currentBalance: 27000,
      maxDrawdown: 1500,
      drawdownMode: "EOD_TRAILING",
      highestEodBalance: 27000,
      drawdownLockFloorOffset: 100,
      dailyLossLimit: 0,
      phase: "FUNDED",
    }));
    expect(result.drawdownFloor).toBe(25100);
    expect(result.remainingDrawdown).toBe(1900);
  });

  it("includes reset costs in real money cost", () => {
    const result = calculateChallengeMetrics(challenge({ challengeFee: 65, resetFee: 40, resetsUsed: 2 }));
    expect(result.realMoneyCost).toBe(145);
  });

  it("migrates the old BG evaluation +$100 lock offset back to the correct evaluation offset", () => {
    const normalized = normalizeChallenge(challenge({
      rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
      startingBalance: 25000,
      currentBalance: 25000,
      highestEodBalance: 25000,
      phase: "EVALUATION",
      drawdownMode: "EOD_TRAILING",
      drawdownLockFloorOffset: 100,
      maxMinis: 1,
      maxMicros: 10,
    }));
    expect(normalized.drawdownLockFloorOffset).toBe(0);
  });

  it("contains the Blue Guardian Standard 25K preset used by the planner", () => {
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.accountSize).toBe(25000);
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.profitTarget).toBe(1500);
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.dailyLossLimit).toBeNull();
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.maxMinis).toBe(1);
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.maxMicros).toBe(10);
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.drawdownMode).toBe("EOD_TRAILING");
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.drawdownLockFloorOffset).toBe(0);
    expect(BLUE_GUARDIAN_FUTURES_STANDARD_25K.postPayoutDrawdownLockFloorOffset).toBe(100);
  });

  it("contains current Topstep and Tradeify 50K evaluation presets", () => {
    expect(TOPSTEP_TRADING_COMBINE_STANDARD_50K.profitTarget).toBe(3000);
    expect(TOPSTEP_TRADING_COMBINE_STANDARD_50K.maxDrawdown).toBe(2000);
    expect(TOPSTEP_TRADING_COMBINE_STANDARD_50K.maxMicros).toBe(50);
    expect(TOPSTEP_TRADING_COMBINE_STANDARD_50K.evaluationFee).toBe(49);

    expect(TRADEIFY_SELECT_50K.profitTarget).toBe(3000);
    expect(TRADEIFY_SELECT_50K.maxDrawdown).toBe(2000);
    expect(TRADEIFY_SELECT_50K.maxMicros).toBe(40);
    expect(TRADEIFY_SELECT_50K.evaluationConsistencyPct).toBe(40);
    expect(TRADEIFY_SELECT_50K.drawdownLockFloorOffset).toBe(-1);
    expect(TRADEIFY_SELECT_50K.evaluationFee).toBe(165);
  });
});
