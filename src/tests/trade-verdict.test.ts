import { describe, expect, it } from "vitest";
import { evaluateTradeVerdict } from "@/lib/trading/trade-verdict";
import type { PositionSizeResult } from "@/lib/trading/types";

function result(overrides: Partial<PositionSizeResult> = {}): PositionSizeResult {
  return {
    direction: "LONG",
    stopDistancePoints: 10,
    stopDistanceTicks: 40,
    marketRiskPerContract: 20,
    commissionAndFeesPerContract: 0,
    slippageBufferTicks: 0,
    slippageBufferPerContract: 0,
    totalCostBufferPerContract: 0,
    riskPerContract: 20,
    effectiveRiskBudget: 100,
    maxContracts: 5,
    actualRisk: 100,
    unusedRiskBudget: 0,
    rewardDistancePoints: 20,
    rewardRiskRatio: 2,
    drawdownUsagePct: 5,
    dailyLossUsagePct: 25,
    riskLevel: "LOW",
    warnings: [],
    ...overrides,
  };
}

describe("evaluateTradeVerdict", () => {
  it("allows a setup that is inside risk limits", () => {
    const verdict = evaluateTradeVerdict({
      result: result(),
      accountType: "PROP",
      challengeStatus: "IN_PROGRESS",
    });

    expect(verdict.level).toBe("SAFE");
  });

  it("blocks a setup when even one contract does not fit", () => {
    const verdict = evaluateTradeVerdict({
      result: result({ maxContracts: 0, actualRisk: 0 }),
      accountType: "PROP",
    });

    expect(verdict.level).toBe("BLOCKED");
  });

  it("warns as soon as challenge health moves above the low-risk band", () => {
    const verdict = evaluateTradeVerdict({
      result: result({ drawdownUsagePct: 6, riskLevel: "MODERATE" }),
      accountType: "PROP",
    });

    expect(verdict.level).toBe("CAUTION");
    expect(verdict.reasons.join(" ")).toContain("remaining drawdown");
  });

  it("warns when the setup consumes too much daily loss allowance", () => {
    const verdict = evaluateTradeVerdict({
      result: result({ dailyLossUsagePct: 60 }),
      accountType: "PROP",
    });

    expect(verdict.level).toBe("CAUTION");
    expect(verdict.reasons.join(" ")).toContain("daily loss allowance");
  });

  it("warns on sub-1R planned reward", () => {
    const verdict = evaluateTradeVerdict({
      result: result({ rewardRiskRatio: 0.75 }),
      accountType: "PERSONAL",
    });

    expect(verdict.level).toBe("CAUTION");
  });
});
