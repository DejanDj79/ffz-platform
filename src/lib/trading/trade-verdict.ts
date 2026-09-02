import type { AccountType, PositionSizeResult } from "./types";

export type TradeVerdictLevel = "SAFE" | "CAUTION" | "BLOCKED";

export type TradeVerdict = {
  level: TradeVerdictLevel;
  label: string;
  reasons: string[];
};

type EvaluateTradeVerdictInput = {
  result: PositionSizeResult;
  accountType: AccountType;
  challengeStatus?: string | null;
};

export function evaluateTradeVerdict({
  result,
  accountType,
  challengeStatus,
}: EvaluateTradeVerdictInput): TradeVerdict {
  const blockedReasons: string[] = [];
  const cautionReasons: string[] = [];

  if (challengeStatus === "FAILED" || challengeStatus === "CLOSED") {
    blockedReasons.push(`Selected challenge is ${challengeStatus.toLowerCase()}.`);
  }

  if (result.maxContracts < 1 || result.actualRisk <= 0) {
    blockedReasons.push("One contract does not fit inside the current effective risk budget.");
  }

  if (blockedReasons.length > 0) {
    return {
      level: "BLOCKED",
      label: "DO NOT TAKE",
      reasons: blockedReasons,
    };
  }

  if (result.rewardRiskRatio != null && result.rewardRiskRatio < 1) {
    cautionReasons.push(`Planned reward is only ${result.rewardRiskRatio.toFixed(2)}R.`);
  }

  if (accountType === "PROP") {
    if (result.drawdownUsagePct != null && result.drawdownUsagePct > 5) {
      cautionReasons.push(
        `This setup uses ${result.drawdownUsagePct.toFixed(2)}% of remaining drawdown.`,
      );
    }

    if (result.dailyLossUsagePct != null && result.dailyLossUsagePct > 50) {
      cautionReasons.push(
        `This setup uses ${result.dailyLossUsagePct.toFixed(2)}% of the remaining daily loss allowance.`,
      );
    }
  }

  for (const warning of result.warnings) {
    if (!cautionReasons.includes(warning)) cautionReasons.push(warning);
  }

  if (cautionReasons.length > 0) {
    return {
      level: "CAUTION",
      label: "TAKE WITH CAUTION",
      reasons: cautionReasons,
    };
  }

  return {
    level: "SAFE",
    label: "YES — WITHIN RULES",
    reasons: [
      `Planned risk is within the current ${accountType === "PROP" ? "prop and personal" : "personal"} risk limits.`,
    ],
  };
}
