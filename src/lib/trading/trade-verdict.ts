import type { TradeGuardrailCheck } from "./guardrails-types";
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
  guardrailChecks?: TradeGuardrailCheck[];
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export function evaluateTradeVerdict({
  result,
  accountType,
  challengeStatus,
  guardrailChecks = [],
}: EvaluateTradeVerdictInput): TradeVerdict {
  const blockedReasons: string[] = [];
  const cautionReasons: string[] = [];
  const infoReasons: string[] = [];

  if (challengeStatus === "FAILED" || challengeStatus === "CLOSED") {
    blockedReasons.push(`Selected challenge is ${challengeStatus.toLowerCase()}.`);
  }

  if (result.maxContracts < 1 || result.actualRisk <= 0) {
    blockedReasons.push("One contract does not fit inside the current effective risk budget.");
  }

  const personalRewardRiskCheck = guardrailChecks.some(
    (item) => item.code === "PERSONAL_MIN_RR" || item.code === "PERSONAL_MIN_RR_MISSING",
  );

  if (
    !personalRewardRiskCheck &&
    result.rewardRiskRatio != null &&
    result.rewardRiskRatio < 1
  ) {
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

  for (const guardrail of guardrailChecks) {
    if (guardrail.severity === "BLOCKED") blockedReasons.push(guardrail.reason);
    else if (guardrail.severity === "CAUTION") cautionReasons.push(guardrail.reason);
    else infoReasons.push(guardrail.reason);
  }

  if (blockedReasons.length > 0) {
    return {
      level: "BLOCKED",
      label: "DO NOT TAKE",
      reasons: unique([...blockedReasons, ...cautionReasons, ...infoReasons]),
    };
  }

  if (cautionReasons.length > 0) {
    return {
      level: "CAUTION",
      label: "TAKE WITH CAUTION",
      reasons: unique([...cautionReasons, ...infoReasons]),
    };
  }

  return {
    level: "SAFE",
    label: "YES — WITHIN RULES",
    reasons: unique(
      infoReasons.length > 0
        ? infoReasons
        : [
            `Planned risk is within the current ${accountType === "PROP" ? "prop and personal" : "personal"} risk limits.`,
          ],
    ),
  };
}
