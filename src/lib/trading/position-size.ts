import { INSTRUMENTS } from "./instruments";
import { classifyRiskLevel } from "./risk-level";
import type { Direction, PositionSizeInput, PositionSizeResult } from "./types";

function requirePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
}

function round(value: number, digits = 8) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const spec = INSTRUMENTS[input.instrument];

  if (!spec) throw new Error("Unsupported instrument.");
  requirePositive(input.entry, "Entry");
  requirePositive(input.stop, "Stop");
  requirePositive(input.maxRisk, "Max risk");

  if (input.entry === input.stop) {
    throw new Error("Entry and stop cannot be the same price.");
  }

  const direction: Direction = input.stop < input.entry ? "LONG" : "SHORT";
  const stopDistancePoints = Math.abs(input.entry - input.stop);
  const stopDistanceTicks = stopDistancePoints / spec.tickSize;
  const marketRiskPerContract = stopDistanceTicks * spec.tickValue;
  const commissionAndFeesPerContract = Math.max(0, input.commissionAndFeesPerContract ?? 0);
  const slippageBufferTicks = Math.max(0, input.slippageBufferTicks ?? 0);
  const slippageBufferPerContract = slippageBufferTicks * spec.tickValue;
  const totalCostBufferPerContract = commissionAndFeesPerContract + slippageBufferPerContract;
  const riskPerContract = marketRiskPerContract + totalCostBufferPerContract;

  const candidateBudgets = [input.maxRisk];
  if (input.accountType === "PROP") {
    if (input.remainingDrawdown != null) {
      requirePositive(input.remainingDrawdown, "Remaining drawdown");
      candidateBudgets.push(input.remainingDrawdown);
    }
    if (input.remainingDailyLoss != null) {
      requirePositive(input.remainingDailyLoss, "Remaining daily loss");
      candidateBudgets.push(input.remainingDailyLoss);
    }
  }

  const effectiveRiskBudget = Math.min(...candidateBudgets);
  const maxContracts = Math.max(0, Math.floor(effectiveRiskBudget / riskPerContract));
  const actualRisk = maxContracts * riskPerContract;
  const unusedRiskBudget = Math.max(0, effectiveRiskBudget - actualRisk);

  let rewardDistancePoints: number | null = null;
  let rewardRiskRatio: number | null = null;
  const warnings: string[] = [];

  if (maxContracts === 0) {
    warnings.push("One contract exceeds the current effective risk budget.");
  }

  if (input.target != null && Number.isFinite(input.target)) {
    requirePositive(input.target, "Target");
    const targetIsValid =
      direction === "LONG" ? input.target > input.entry : input.target < input.entry;

    if (!targetIsValid) {
      warnings.push(`Target is on the wrong side of entry for a ${direction.toLowerCase()} trade.`);
    } else {
      rewardDistancePoints = Math.abs(input.target - input.entry);
      rewardRiskRatio = rewardDistancePoints / stopDistancePoints;
    }
  }

  const drawdownUsagePct =
    input.accountType === "PROP" && input.remainingDrawdown
      ? (actualRisk / input.remainingDrawdown) * 100
      : null;

  const dailyLossUsagePct =
    input.accountType === "PROP" && input.remainingDailyLoss
      ? (actualRisk / input.remainingDailyLoss) * 100
      : null;

  if (input.accountType === "PROP" && input.remainingDailyLoss != null && actualRisk > input.remainingDailyLoss) {
    warnings.push("Planned risk exceeds the remaining daily loss allowance.");
  }

  return {
    direction,
    stopDistancePoints: round(stopDistancePoints),
    stopDistanceTicks: round(stopDistanceTicks),
    marketRiskPerContract: round(marketRiskPerContract),
    commissionAndFeesPerContract: round(commissionAndFeesPerContract),
    slippageBufferTicks: round(slippageBufferTicks),
    slippageBufferPerContract: round(slippageBufferPerContract),
    totalCostBufferPerContract: round(totalCostBufferPerContract),
    riskPerContract: round(riskPerContract),
    effectiveRiskBudget: round(effectiveRiskBudget),
    maxContracts,
    actualRisk: round(actualRisk),
    unusedRiskBudget: round(unusedRiskBudget),
    rewardDistancePoints: rewardDistancePoints == null ? null : round(rewardDistancePoints),
    rewardRiskRatio: rewardRiskRatio == null ? null : round(rewardRiskRatio, 4),
    drawdownUsagePct: drawdownUsagePct == null ? null : round(drawdownUsagePct, 2),
    dailyLossUsagePct: dailyLossUsagePct == null ? null : round(dailyLossUsagePct, 2),
    riskLevel: classifyRiskLevel(drawdownUsagePct == null ? null : round(drawdownUsagePct, 2)),
    warnings,
  };
}
