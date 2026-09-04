import type { Challenge } from "@/lib/challenges/types";
import type { InstrumentCode, PositionSizeResult, RiskLevel } from "@/lib/trading/types";

const MICRO_INSTRUMENTS = new Set<InstrumentCode>(["MNQ", "MES"]);

export function getChallengeContractLimit(
  challenge: Challenge | null | undefined,
  instrument: InstrumentCode,
): number | null {
  if (!challenge) return null;
  const value = MICRO_INSTRUMENTS.has(instrument)
    ? challenge.maxMicros
    : challenge.maxMinis;
  return value == null || value <= 0 ? null : value;
}

function riskLevelFromUsage(drawdownUsagePct: number | null): RiskLevel {
  if (drawdownUsagePct == null) return "N/A";
  if (drawdownUsagePct <= 5) return "LOW";
  if (drawdownUsagePct <= 10) return "MODERATE";
  return "HIGH";
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function applyChallengeContractLimit(
  result: PositionSizeResult,
  contractLimit: number | null,
  remainingDrawdown: number | null,
  remainingDailyLoss: number | null,
): PositionSizeResult {
  if (contractLimit == null || result.maxContracts <= contractLimit) return result;

  const maxContracts = contractLimit;
  const actualRisk = result.riskPerContract * maxContracts;
  const drawdownUsagePct = remainingDrawdown && remainingDrawdown > 0
    ? (actualRisk / remainingDrawdown) * 100
    : result.drawdownUsagePct;
  const dailyLossUsagePct = remainingDailyLoss && remainingDailyLoss > 0
    ? (actualRisk / remainingDailyLoss) * 100
    : result.dailyLossUsagePct;

  return {
    ...result,
    maxContracts,
    actualRisk,
    unusedRiskBudget: Math.max(0, result.effectiveRiskBudget - actualRisk),
    drawdownUsagePct: drawdownUsagePct == null ? null : roundPercent(drawdownUsagePct),
    dailyLossUsagePct,
    riskLevel: riskLevelFromUsage(drawdownUsagePct),
    warnings: [
      ...result.warnings,
      `Position size capped by the selected challenge rule at ${contractLimit} contract${contractLimit === 1 ? "" : "s"}.`,
    ],
  };
}
