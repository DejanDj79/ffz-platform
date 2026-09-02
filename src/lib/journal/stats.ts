import type { TradeApiModel } from "./types";

export type JournalStats = {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  winRate: number | null;
  averageR: number | null;
  profitFactor: number | null;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateJournalStats(
  trades: TradeApiModel[],
): JournalStats {
  const closed = trades.filter((trade) => trade.status === "CLOSED");
  const wins = closed.filter((trade) => trade.outcome === "WIN").length;
  const losses = closed.filter((trade) => trade.outcome === "LOSS").length;
  const breakeven = closed.filter(
    (trade) => trade.outcome === "BREAKEVEN",
  ).length;

  const netPnl = round(
    closed.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0),
  );

  const rValues = closed
    .map((trade) => trade.rMultiple)
    .filter((value): value is number => value != null);

  const averageR =
    rValues.length > 0
      ? round(
          rValues.reduce((sum, value) => sum + value, 0) /
            rValues.length,
          3,
        )
      : null;

  const grossProfit = closed.reduce(
    (sum, trade) =>
      trade.netPnl != null && trade.netPnl > 0
        ? sum + trade.netPnl
        : sum,
    0,
  );

  const grossLoss = Math.abs(
    closed.reduce(
      (sum, trade) =>
        trade.netPnl != null && trade.netPnl < 0
          ? sum + trade.netPnl
          : sum,
      0,
    ),
  );

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins,
    losses,
    breakeven,
    netPnl,
    winRate:
      wins + losses > 0
        ? round((wins / (wins + losses)) * 100, 1)
        : null,
    averageR,
    profitFactor:
      grossLoss > 0
        ? round(grossProfit / grossLoss, 2)
        : grossProfit > 0
          ? Infinity
          : null,
  };
}
