import type { TradeApiModel } from "@/lib/journal/types";

export type TradingDeskAccountFilter = "ALL" | "NONE" | string;

export type TradingDaySummary = {
  trades: TradeApiModel[];
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  grossLoss: number;
};

export type DeskGuardrailStatus = "GO" | "CAUTION" | "STOP";

export type DeskGuardrails = {
  status: DeskGuardrailStatus;
  maxPlannedLoss: number;
  grossLossRemaining: number;
  remainingLossSlots: number;
  reasons: string[];
};

export function localDateKey(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function summarizeTradingDay(
  trades: TradeApiModel[],
  now: Date,
  accountFilter: TradingDeskAccountFilter,
): TradingDaySummary {
  const dayKey = localDateKey(now);
  const todayTrades = trades.filter((trade) => {
    if (localDateKey(trade.openedAt) !== dayKey) return false;
    if (accountFilter === "ALL") return true;
    if (accountFilter === "NONE") return trade.challengeId == null;
    return trade.challengeId === accountFilter;
  });

  const closed = todayTrades.filter((trade) => trade.status === "CLOSED");
  const wins = closed.filter((trade) => trade.outcome === "WIN" || (trade.outcome == null && (trade.netPnl ?? 0) > 0)).length;
  const losses = closed.filter((trade) => trade.outcome === "LOSS" || (trade.outcome == null && (trade.netPnl ?? 0) < 0)).length;
  const breakeven = closed.filter((trade) => trade.outcome === "BREAKEVEN" || (trade.outcome == null && (trade.netPnl ?? 0) === 0)).length;
  const netPnl = closed.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0);
  const grossLoss = closed.reduce(
    (sum, trade) => sum + Math.abs(Math.min(0, trade.netPnl ?? 0)),
    0,
  );

  return {
    trades: todayTrades,
    totalTrades: todayTrades.length,
    closedTrades: closed.length,
    openTrades: todayTrades.length - closed.length,
    wins,
    losses,
    breakeven,
    netPnl,
    grossLoss,
  };
}

export function calculateDeskGuardrails(input: {
  summary: TradingDaySummary;
  maxRiskPerTrade: number;
  maxLosingTrades: number;
  challengeRemainingDrawdown?: number | null;
  challengeRemainingDailyLoss?: number | null;
  challengeFailed?: boolean;
}): DeskGuardrails {
  const maxRiskPerTrade = Math.max(0, input.maxRiskPerTrade);
  const maxLosingTrades = Math.max(1, Math.floor(input.maxLosingTrades));
  const maxPlannedLoss = maxRiskPerTrade * maxLosingTrades;
  const grossLossRemaining = Math.max(0, maxPlannedLoss - input.summary.grossLoss);
  const remainingLossSlots = Math.max(0, maxLosingTrades - input.summary.losses);
  const stopReasons: string[] = [];
  const cautionReasons: string[] = [];

  if (input.challengeFailed) {
    stopReasons.push("Selected challenge is already marked failed.");
  }

  if (remainingLossSlots === 0) {
    stopReasons.push(`Daily losing-trade limit reached (${maxLosingTrades}).`);
  } else if (remainingLossSlots === 1) {
    cautionReasons.push("Only one planned losing-trade slot remains.");
  }

  if (maxPlannedLoss > 0 && grossLossRemaining <= 0) {
    stopReasons.push("Planned gross-loss budget is exhausted.");
  } else if (maxRiskPerTrade > 0 && grossLossRemaining <= maxRiskPerTrade) {
    cautionReasons.push("Less than one full-risk trade remains in the loss budget.");
  }

  if (input.challengeRemainingDrawdown != null) {
    if (input.challengeRemainingDrawdown <= 0) {
      stopReasons.push("No challenge drawdown buffer remains.");
    } else if (maxRiskPerTrade > 0 && input.challengeRemainingDrawdown <= maxRiskPerTrade) {
      stopReasons.push("Remaining drawdown is smaller than one planned full-risk trade.");
    } else if (maxRiskPerTrade > 0 && input.challengeRemainingDrawdown <= maxRiskPerTrade * 2) {
      cautionReasons.push("Challenge drawdown buffer is below two planned full-risk trades.");
    }
  }

  if (input.challengeRemainingDailyLoss != null) {
    if (input.challengeRemainingDailyLoss <= 0) {
      stopReasons.push("Challenge daily-loss buffer is exhausted.");
    } else if (maxRiskPerTrade > 0 && input.challengeRemainingDailyLoss <= maxRiskPerTrade) {
      cautionReasons.push("Challenge daily-loss buffer is below one planned full-risk trade.");
    }
  }

  if (stopReasons.length > 0) {
    return {
      status: "STOP",
      maxPlannedLoss,
      grossLossRemaining,
      remainingLossSlots,
      reasons: stopReasons,
    };
  }

  if (cautionReasons.length > 0) {
    return {
      status: "CAUTION",
      maxPlannedLoss,
      grossLossRemaining,
      remainingLossSlots,
      reasons: cautionReasons,
    };
  }

  return {
    status: "GO",
    maxPlannedLoss,
    grossLossRemaining,
    remainingLossSlots,
    reasons: ["Daily risk limits are inside the planned guardrails."],
  };
}
