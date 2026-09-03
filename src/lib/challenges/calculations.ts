import type { Challenge, ChallengeHealth, ChallengeMetrics } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateChallengeHealth(
  remainingDrawdownPct: number,
  remainingDailyLossPct: number | null,
  status: Challenge["status"],
): ChallengeHealth {
  if (status === "FAILED") return "DANGER";

  const buffers = [remainingDrawdownPct];
  if (remainingDailyLossPct != null) buffers.push(remainingDailyLossPct);

  const tightestBuffer = Math.min(...buffers);
  if (tightestBuffer <= 25) return "DANGER";
  if (tightestBuffer <= 50) return "CAUTION";
  return "SAFE";
}

export function calculateDrawdownFloor(challenge: Challenge) {
  const maxDrawdown = finiteNonNegative(challenge.maxDrawdown);
  const startingBalance = finiteNonNegative(challenge.startingBalance);
  const mode = challenge.drawdownMode ?? "STATIC";

  if (maxDrawdown <= 0) return startingBalance;

  if (mode === "STATIC") {
    return startingBalance - maxDrawdown;
  }

  const referenceHigh = mode === "EOD_TRAILING"
    ? Math.max(startingBalance, challenge.highestEodBalance ?? startingBalance)
    : Math.max(startingBalance, challenge.currentBalance);

  const rawTrailingFloor = referenceHigh - maxDrawdown;
  const configuredLockOffset = challenge.drawdownLockFloorOffset ?? 0;

  // A negative offset is the internal representation of a trailing drawdown
  // that never locks during the current phase (for example Tradeify Select
  // Evaluation). In that case the floor keeps following the reference high.
  if (configuredLockOffset < 0) {
    return rawTrailingFloor;
  }

  const maximumLockedFloor = startingBalance + finiteNonNegative(configuredLockOffset);
  return Math.min(rawTrailingFloor, maximumLockedFloor);
}

/**
 * Firm-aware planning model.
 *
 * STATIC:
 *   floor = starting balance - max drawdown
 *
 * EOD_TRAILING:
 *   floor = highest EOD balance - max drawdown. If a non-negative lock offset
 *   is configured, the floor is capped at starting balance + that offset.
 *   A negative lock offset means the evaluation has no drawdown lock and the
 *   floor continues trailing upward.
 *
 * INTRADAY_TRAILING:
 *   uses currentBalance as the current high proxy until we add live equity.
 *
 * A dailyLossLimit of 0 means the rule does not exist, not that zero loss is
 * allowed.
 */
export function calculateChallengeMetrics(challenge: Challenge): ChallengeMetrics {
  const profitTarget = finiteNonNegative(challenge.profitTarget);
  const maxDrawdown = finiteNonNegative(challenge.maxDrawdown);
  const dailyLossLimit = finiteNonNegative(challenge.dailyLossLimit);

  const currentPnl = challenge.currentBalance - challenge.startingBalance;
  const profitTargetRemaining = Math.max(0, profitTarget - currentPnl);
  const targetProgressPct = profitTarget > 0
    ? clamp((currentPnl / profitTarget) * 100, 0, 100)
    : 0;

  const drawdownFloor = calculateDrawdownFloor(challenge);
  const remainingDrawdown = Math.max(0, challenge.currentBalance - drawdownFloor);
  const remainingDrawdownPct = maxDrawdown > 0
    ? Math.max(0, (remainingDrawdown / maxDrawdown) * 100)
    : 0;

  const remainingDailyLoss = dailyLossLimit > 0
    ? clamp(dailyLossLimit + Math.min(0, challenge.todayPnl), 0, dailyLossLimit)
    : null;
  const remainingDailyLossPct = remainingDailyLoss == null
    ? null
    : (remainingDailyLoss / dailyLossLimit) * 100;

  const realMoneyCost = Math.max(0, challenge.challengeFee)
    + Math.max(0, challenge.resetFee) * Math.max(0, Math.floor(challenge.resetsUsed));

  return {
    currentPnl,
    targetProgressPct,
    profitTargetRemaining,
    drawdownFloor,
    remainingDrawdown,
    remainingDrawdownPct,
    remainingDailyLoss,
    remainingDailyLossPct,
    realMoneyCost,
    health: calculateChallengeHealth(
      remainingDrawdownPct,
      remainingDailyLossPct,
      challenge.status,
    ),
  };
}
