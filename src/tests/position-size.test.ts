import { describe, expect, it } from "vitest";
import { calculatePositionSize } from "@/lib/trading/position-size";

function expectClose(actual: number | null, expected: number, precision = 6) {
  expect(actual).not.toBeNull();
  expect(actual as number).toBeCloseTo(expected, precision);
}

describe("calculatePositionSize", () => {
  it("sizes MNQ without exceeding max risk", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      entry: 19000,
      stop: 18980,
      maxRisk: 100,
    });

    expect(result.direction).toBe("LONG");
    expectClose(result.stopDistancePoints, 20);
    expectClose(result.stopDistanceTicks, 80);
    expectClose(result.marketRiskPerContract, 40);
    expect(result.maxContracts).toBe(2);
    expectClose(result.actualRisk, 80);
  });

  it("sizes MES correctly", () => {
    const result = calculatePositionSize({
      instrument: "MES",
      entry: 6000,
      stop: 5995,
      maxRisk: 100,
    });

    expectClose(result.marketRiskPerContract, 25);
    expect(result.maxContracts).toBe(4);
    expectClose(result.actualRisk, 100);
  });

  it("detects a short trade", () => {
    const result = calculatePositionSize({
      instrument: "NQ",
      entry: 20000,
      stop: 20005,
      maxRisk: 500,
    });

    expect(result.direction).toBe("SHORT");
    expectClose(result.marketRiskPerContract, 100);
    expect(result.maxContracts).toBe(5);
  });

  it("includes commission and slippage buffer in sizing", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      entry: 19000,
      stop: 18980,
      maxRisk: 100,
      commissionAndFeesPerContract: 2,
      slippageBufferTicks: 1,
    });

    expectClose(result.commissionAndFeesPerContract, 2);
    expectClose(result.slippageBufferTicks, 1);
    expectClose(result.slippageBufferPerContract, 0.5);
    expectClose(result.totalCostBufferPerContract, 2.5);
    expectClose(result.riskPerContract, 42.5);
    expect(result.maxContracts).toBe(2);
    expectClose(result.actualRisk, 85);
  });

  it("clamps prop sizing to remaining daily loss", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      entry: 19000,
      stop: 18980,
      maxRisk: 100,
      accountType: "PROP",
      remainingDrawdown: 1400,
      remainingDailyLoss: 70,
    });

    expectClose(result.effectiveRiskBudget, 70);
    expect(result.maxContracts).toBe(1);
    expectClose(result.actualRisk, 40);
  });

  it("rounds drawdown usage to one decimal for display", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      entry: 19000,
      stop: 18980,
      maxRisk: 100,
      accountType: "PROP",
      remainingDrawdown: 1450,
    });

    expect(result.actualRisk).toBe(80);
    expect(result.drawdownUsagePct).toBe(5.5);
  });

  it("calculates R:R from a valid target", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      entry: 19000,
      stop: 18980,
      target: 19040,
      maxRisk: 100,
    });

    expectClose(result.rewardRiskRatio, 2);
  });

  it("returns zero contracts when one contract is too large", () => {
    const result = calculatePositionSize({
      instrument: "ES",
      entry: 6000,
      stop: 5995,
      maxRisk: 100,
    });

    expect(result.maxContracts).toBe(0);
    expect(result.warnings[0]).toContain("One contract exceeds");
  });
});
