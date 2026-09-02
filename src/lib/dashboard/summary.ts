import type { Challenge } from "@/lib/challenges/types";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import {
  calculateFundedPayoutSummary,
  effectiveChallengeAfterPayouts,
} from "@/lib/challenges/funded";
import type { TradeApiModel } from "@/lib/journal/types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { calculateJournalStats } from "@/lib/journal/stats";
import { calculateLedgerStats } from "@/lib/ledger/stats";

export type EquityPoint = {
  timestamp: string;
  value: number;
};

export type DashboardChallengeSummary = {
  challenge: Challenge | null;
  pnl: number;
  targetRemaining: number;
  targetProgressPct: number;
  remainingDrawdown: number;
  remainingDrawdownPct: number;
  drawdownFloor: number;
  remainingDailyLoss: number | null;
  health: "SAFE" | "CAUTION" | "DANGER" | null;
  isFunded: boolean;
  payoutEligible: boolean;
  payoutReadinessPct: number;
  payoutAvailable: number;
  estimatedPayout: number;
  payoutDays: number;
  payoutDaysRequired: number | null;
  consistencyPct: number | null;
  consistencyLimitPct: number | null;
};

export type DashboardPerformanceSummary = {
  todayPnl: number;
  monthPnl: number;
  averageWin: number | null;
  averageLoss: number | null;
  expectancy: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  equityCurve: EquityPoint[];
};

export type DashboardSummary = {
  challenge: DashboardChallengeSummary;
  journal: ReturnType<typeof calculateJournalStats>;
  ledger: ReturnType<typeof calculateLedgerStats>;
  performance: DashboardPerformanceSummary;
};

const ACTIVE_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "PASSED",
  "FUNDED",
]);

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameLocalMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function selectPrimaryChallenge(
  challenges: Challenge[],
): Challenge | null {
  return (
    challenges.find((challenge) => challenge.status === "IN_PROGRESS") ??
    challenges.find((challenge) => challenge.status === "FUNDED") ??
    challenges.find((challenge) => challenge.status === "NOT_STARTED") ??
    challenges.find((challenge) => ACTIVE_STATUSES.has(challenge.status)) ??
    challenges[0] ??
    null
  );
}

export function calculatePerformanceSummary(
  trades: TradeApiModel[],
  now = new Date(),
): DashboardPerformanceSummary {
  const closed = trades
    .filter((trade) => trade.status === "CLOSED")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.closedAt ?? a.openedAt).getTime() -
        new Date(b.closedAt ?? b.openedAt).getTime(),
    );

  const pnlTrades = closed.filter(
    (trade): trade is TradeApiModel & { netPnl: number } => trade.netPnl != null,
  );

  const todayPnl = round(
    pnlTrades.reduce((sum, trade) => {
      const timestamp = new Date(trade.closedAt ?? trade.openedAt);
      return sameLocalDay(timestamp, now) ? sum + trade.netPnl : sum;
    }, 0),
  );

  const monthPnl = round(
    pnlTrades.reduce((sum, trade) => {
      const timestamp = new Date(trade.closedAt ?? trade.openedAt);
      return sameLocalMonth(timestamp, now) ? sum + trade.netPnl : sum;
    }, 0),
  );

  const wins = pnlTrades.filter((trade) => trade.netPnl > 0);
  const losses = pnlTrades.filter((trade) => trade.netPnl < 0);

  const averageWin =
    wins.length > 0
      ? round(wins.reduce((sum, trade) => sum + trade.netPnl, 0) / wins.length)
      : null;

  const averageLoss =
    losses.length > 0
      ? round(losses.reduce((sum, trade) => sum + trade.netPnl, 0) / losses.length)
      : null;

  const expectancy =
    pnlTrades.length > 0
      ? round(
          pnlTrades.reduce((sum, trade) => sum + trade.netPnl, 0) /
            pnlTrades.length,
        )
      : null;

  const pnlValues = pnlTrades.map((trade) => trade.netPnl);
  const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : null;
  const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : null;

  let running = 0;
  const equityCurve = pnlTrades.map((trade) => {
    running = round(running + trade.netPnl);
    return {
      timestamp: trade.closedAt ?? trade.openedAt,
      value: running,
    };
  });

  return {
    todayPnl,
    monthPnl,
    averageWin,
    averageLoss,
    expectancy,
    bestTrade,
    worstTrade,
    equityCurve,
  };
}

export function calculateDashboardSummary(
  challenges: Challenge[],
  trades: TradeApiModel[],
  ledgerEntries: LedgerEntryApiModel[],
  now = new Date(),
): DashboardSummary {
  const challenge = selectPrimaryChallenge(challenges);

  let challengeSummary: DashboardChallengeSummary = {
    challenge,
    pnl: 0,
    targetRemaining: 0,
    targetProgressPct: 0,
    remainingDrawdown: 0,
    remainingDrawdownPct: 0,
    drawdownFloor: 0,
    remainingDailyLoss: null,
    health: null,
    isFunded: false,
    payoutEligible: false,
    payoutReadinessPct: 0,
    payoutAvailable: 0,
    estimatedPayout: 0,
    payoutDays: 0,
    payoutDaysRequired: null,
    consistencyPct: null,
    consistencyLimitPct: null,
  };

  if (challenge) {
    const effectiveChallenge = effectiveChallengeAfterPayouts(
      challenge,
      ledgerEntries,
    );
    const metrics = calculateChallengeMetrics(effectiveChallenge);
    const funded = calculateFundedPayoutSummary(
      challenge,
      trades,
      ledgerEntries,
    );

    challengeSummary = {
      challenge,
      pnl: metrics.currentPnl,
      targetRemaining: metrics.profitTargetRemaining,
      targetProgressPct: metrics.targetProgressPct,
      remainingDrawdown: metrics.remainingDrawdown,
      remainingDrawdownPct: metrics.remainingDrawdownPct,
      drawdownFloor: metrics.drawdownFloor,
      remainingDailyLoss: metrics.remainingDailyLoss,
      health: metrics.health,
      isFunded: funded.isFunded,
      payoutEligible: funded.eligible,
      payoutReadinessPct: funded.readinessPct,
      payoutAvailable: funded.grossPayoutAvailable,
      estimatedPayout: funded.estimatedTraderPayout,
      payoutDays: funded.tradingDays,
      payoutDaysRequired: funded.payoutDaysRequired,
      consistencyPct: funded.consistencyPct,
      consistencyLimitPct: funded.consistencyLimitPct,
    };
  }

  return {
    challenge: challengeSummary,
    journal: calculateJournalStats(trades),
    ledger: calculateLedgerStats(ledgerEntries),
    performance: calculatePerformanceSummary(trades, now),
  };
}
