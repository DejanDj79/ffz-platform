import { describe, expect, it } from "vitest";
import type { Challenge } from "@/lib/challenges/types";
import type { PositionSizeResult } from "@/lib/trading/types";
import {
  applyChallengeContractLimit,
  getChallengeContractLimit,
} from "@/lib/prop-firms/calculator-integration";

function bg25k(): Challenge {
  return {
    id: "bg-25k",
    propFirm: "Blue Guardian Futures",
    name: "Standard 25K #1",
    accountSize: 25000,
    startingBalance: 25000,
    profitTarget: 1500,
    maxDrawdown: 1500,
    dailyLossLimit: 0,
    challengeFee: 0,
    resetFee: 104,
    resetsUsed: 0,
    minimumTradingDays: 0,
    currentBalance: 25000,
    todayPnl: 0,
    daysTraded: 0,
    status: "IN_PROGRESS",
    phase: "EVALUATION",
    notes: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
    drawdownMode: "EOD_TRAILING",
    highestEodBalance: 25000,
    drawdownLockFloorOffset: 0,
    dailyLossBreachType: "NONE",
    maxMinis: 1,
    maxMicros: 10,
  };
}

function result(maxContracts: number, riskPerContract = 40): PositionSizeResult {
  const actualRisk = maxContracts * riskPerContract;
  return {
    direction: "LONG",
    stopDistancePoints: 20,
    stopDistanceTicks: 80,
    marketRiskPerContract: riskPerContract,
    commissionAndFeesPerContract: 0,
    slippageBufferTicks: 0,
    slippageBufferPerContract: 0,
    totalCostBufferPerContract: 0,
    riskPerContract,
    effectiveRiskBudget: 1000,
    maxContracts,
    actualRisk,
    unusedRiskBudget: Math.max(0, 1000 - actualRisk),
    rewardDistancePoints: 40,
    rewardRiskRatio: 2,
    drawdownUsagePct: 10,
    dailyLossUsagePct: null,
    riskLevel: "MODERATE",
    warnings: [],
  };
}

describe("Blue Guardian Standard 25K calculator integration", () => {
  it("uses the 10-micro limit for MNQ and MES", () => {
    const challenge = bg25k();
    expect(getChallengeContractLimit(challenge, "MNQ")).toBe(10);
    expect(getChallengeContractLimit(challenge, "MES")).toBe(10);
  });

  it("uses the 1-mini limit for NQ and ES", () => {
    const challenge = bg25k();
    expect(getChallengeContractLimit(challenge, "NQ")).toBe(1);
    expect(getChallengeContractLimit(challenge, "ES")).toBe(1);
  });

  it("does not change a risk-based MNQ size that is already under the challenge limit", () => {
    const original = result(2, 40);
    const adjusted = applyChallengeContractLimit(original, 10, 1500, null);
    expect(adjusted.maxContracts).toBe(2);
    expect(adjusted.actualRisk).toBe(80);
    expect(adjusted.warnings).toEqual([]);
  });

  it("caps MNQ at 10 micros when risk math would allow more", () => {
    const adjusted = applyChallengeContractLimit(result(14, 40), 10, 1500, null);
    expect(adjusted.maxContracts).toBe(10);
    expect(adjusted.actualRisk).toBe(400);
    expect(adjusted.drawdownUsagePct).toBe(26.7);
    expect(adjusted.warnings.some((warning) => warning.includes("capped"))).toBe(true);
  });

  it("caps NQ/ES-style mini sizing at one contract", () => {
    const adjusted = applyChallengeContractLimit(result(3, 100), 1, 1500, null);
    expect(adjusted.maxContracts).toBe(1);
    expect(adjusted.actualRisk).toBe(100);
  });
});
