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
  const lockOffset = finiteNonNegative(challenge.drawdownLockFloorOffset ?? 0);
  const maximumLockedFloor = startingBalance + lockOffset;

  return Math.min(rawTrailingFloor, maximumLockedFloor);
}

/**
 * Firm-aware planning model.
 *
 * STATIC:
 *   floor = starting balance - max drawdown
 *
 * EOD_TRAILING:
 *   floor = highest EOD balance - max drawdown, capped at the configured
 *   locked floor. highestEodBalance must be updated after an EOD close.
 *   For Blue Guardian Standard evaluation, the cap is starting balance.
 *   A +$100 cap is a post-payout funded rule and should only be applied after
 *   a payout event, not during evaluation.
 *
 * INTRADAY_TRAILING:
 *   uses currentBalance as the current high proxy until we add live equity.
 *
 * A dailyLossLimit of 0 means the rule does not exist, not that zero loss is
 * allowed. This matters for Blue Guardian Futures Standard 25K, which currently
 * publishes no daily loss limit.
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
