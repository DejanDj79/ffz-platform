import type { TradeApiModel } from "./types";

export type TradeReviewPerformancePeriod = "DAY" | "WEEK" | "MONTH";

export type TradeReviewPerformancePoint = {
  key: string;
  label: string;
  pnl: number;
  cumulativePnl: number;
  trades: number;
};

export type TradeReviewPerformance = {
  period: TradeReviewPerformancePeriod;
  start: Date;
  end: Date;
  label: string;
  tradeCount: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  points: TradeReviewPerformancePoint[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function tradeTimestamp(trade: TradeApiModel) {
  return new Date(trade.closedAt ?? trade.openedAt);
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tradeReviewPerformanceBounds(
  period: TradeReviewPerformancePeriod,
  anchor: Date,
) {
  if (period === "DAY") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }

  if (period === "WEEK") {
    const start = startOfDay(anchor);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return { start, end: addDays(start, 7) };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return { start, end };
}

export function shiftTradeReviewPerformanceAnchor(
  anchor: Date,
  period: TradeReviewPerformancePeriod,
  direction: -1 | 1,
) {
  if (period === "DAY") return addDays(anchor, direction);
  if (period === "WEEK") return addDays(anchor, direction * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function formatPeriodLabel(
  period: TradeReviewPerformancePeriod,
  start: Date,
  end: Date,
) {
  if (period === "DAY") {
    return start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (period === "MONTH") {
    return start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const inclusiveEnd = new Date(end.getTime() - 1);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = inclusiveEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function dayLabel(value: Date, period: TradeReviewPerformancePeriod) {
  if (period === "WEEK") {
    return value.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  }
  return String(value.getDate());
}

export function calculateTradeReviewPerformance(
  trades: TradeApiModel[],
  period: TradeReviewPerformancePeriod,
  anchor: Date,
): TradeReviewPerformance {
  const { start, end } = tradeReviewPerformanceBounds(period, anchor);
  const closedTrades = trades
    .filter((trade) => trade.status === "CLOSED")
    .filter((trade) => {
      const timestamp = tradeTimestamp(trade).getTime();
      return timestamp >= start.getTime() && timestamp < end.getTime();
    })
    .sort((a, b) => tradeTimestamp(a).getTime() - tradeTimestamp(b).getTime());

  const pnls = closedTrades.map((trade) => trade.netPnl ?? 0);
  const netPnl = round(pnls.reduce((sum, value) => sum + value, 0));
  const grossProfit = pnls
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
  );
  const wins = closedTrades.filter((trade) => trade.outcome === "WIN").length;
  const losses = closedTrades.filter((trade) => trade.outcome === "LOSS").length;

  let points: TradeReviewPerformancePoint[] = [];

  if (closedTrades.length > 0 && period === "DAY") {
    let cumulativePnl = 0;
    points = closedTrades.map((trade) => {
      const pnl = round(trade.netPnl ?? 0);
      cumulativePnl = round(cumulativePnl + pnl);
      return {
        key: trade.id,
        label: tradeTimestamp(trade).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        pnl,
        cumulativePnl,
        trades: 1,
      };
    });
  } else if (closedTrades.length > 0) {
    const daily = new Map<string, { pnl: number; trades: number }>();
    for (const trade of closedTrades) {
      const key = localDateKey(tradeTimestamp(trade));
      const current = daily.get(key) ?? { pnl: 0, trades: 0 };
      current.pnl += trade.netPnl ?? 0;
      current.trades += 1;
      daily.set(key, current);
    }

    let cursor = new Date(start);
    let cumulativePnl = 0;
    while (cursor.getTime() < end.getTime()) {
      const key = localDateKey(cursor);
      const value = daily.get(key) ?? { pnl: 0, trades: 0 };
      const pnl = round(value.pnl);
      cumulativePnl = round(cumulativePnl + pnl);
      points.push({
        key,
        label: dayLabel(cursor, period),
        pnl,
        cumulativePnl,
        trades: value.trades,
      });
      cursor = addDays(cursor, 1);
    }
  }

  return {
    period,
    start,
    end,
    label: formatPeriodLabel(period, start, end),
    tradeCount: closedTrades.length,
    wins,
    losses,
    netPnl,
    winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null,
    profitFactor:
      grossLoss > 0
        ? round(grossProfit / grossLoss, 2)
        : grossProfit > 0
          ? Infinity
          : null,
    points,
  };
}
