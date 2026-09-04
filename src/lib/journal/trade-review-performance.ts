import { readDisciplineReview } from "./discipline";
import { STARTED_FROM_PLAN_TAG } from "./planned";
import type { TradeApiModel } from "./types";

export type TradeReviewPerformancePeriod = "DAY" | "WEEK" | "MONTH";

export type TradeReviewPerformancePoint = {
  key: string;
  label: string;
  pnl: number;
  cumulativePnl: number;
  trades: number;
};

export type FfzScoreBreakdown = {
  performance: number;
  risk: number;
  consistency: number;
  discipline: number;
};

export type FfzScore = {
  value: number | null;
  rawValue: number | null;
  confidence: number;
  status: "NO_DATA" | "PRELIMINARY" | "ESTABLISHED";
  breakdown: FfzScoreBreakdown | null;
  reviewedTrades: number;
  plannedTrades: number;
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
  ffzScore: FfzScore;
  points: TradeReviewPerformancePoint[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
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

function profitFactorScore(profitFactor: number | null) {
  if (profitFactor == null) return 50;
  if (profitFactor === Infinity) return 100;
  if (profitFactor <= 1) return clamp(profitFactor * 50);
  return clamp(50 + (profitFactor - 1) * 30);
}

function maxDrawdown(pnls: number[]) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }

  return drawdown;
}

function executionScore(value: ReturnType<typeof readDisciplineReview>["execution"]) {
  if (value === "ON_PLAN") return 100;
  if (value === "DEVIATED") return 55;
  if (value === "UNPLANNED") return 20;
  return 50;
}

function mindsetScore(value: ReturnType<typeof readDisciplineReview>["mindset"]) {
  if (value === "CALM" || value === "FOCUSED") return 100;
  if (value === "FEAR" || value === "TIRED") return 65;
  if (value === "FOMO" || value === "FRUSTRATED") return 40;
  if (value === "REVENGE") return 10;
  return 50;
}

function calculateFfzScore(
  closedTrades: TradeApiModel[],
  pnls: number[],
  grossProfit: number,
  grossLoss: number,
  profitFactor: number | null,
  winRate: number | null,
): FfzScore {
  if (closedTrades.length === 0) {
    return {
      value: null,
      rawValue: null,
      confidence: 0,
      status: "NO_DATA",
      breakdown: null,
      reviewedTrades: 0,
      plannedTrades: 0,
    };
  }

  const performance = round(
    profitFactorScore(profitFactor) * 0.65 + (winRate ?? 50) * 0.35,
    1,
  );

  const drawdown = maxDrawdown(pnls);
  const riskBase = grossProfit > 0
    ? 100 * (1 - clamp(drawdown / grossProfit, 0, 1))
    : grossLoss > 0
      ? 0
      : 50;
  const risk = round(clamp(riskBase), 1);

  const absolutePnls = pnls.map((value) => Math.abs(value));
  const absoluteTotal = absolutePnls.reduce((sum, value) => sum + value, 0);
  const concentration = absoluteTotal > 0
    ? Math.max(...absolutePnls) / absoluteTotal
    : 1;
  const consistency = round(
    clamp(((1 - concentration) / 0.65) * 100),
    1,
  );

  let executionTotal = 0;
  let mindsetTotal = 0;
  let reviewedTrades = 0;
  let plannedTrades = 0;

  for (const trade of closedTrades) {
    const review = readDisciplineReview(trade.tags);
    executionTotal += executionScore(review.execution);
    mindsetTotal += mindsetScore(review.mindset);
    if (review.execution || review.mindset) reviewedTrades += 1;
    if (trade.tags.includes(STARTED_FROM_PLAN_TAG)) plannedTrades += 1;
  }

  const executionAverage = executionTotal / closedTrades.length;
  const mindsetAverage = mindsetTotal / closedTrades.length;
  const plannedScore = plannedTrades > 0
    ? (plannedTrades / closedTrades.length) * 100
    : 50;
  const discipline = round(
    executionAverage * 0.5 + mindsetAverage * 0.25 + plannedScore * 0.25,
    1,
  );

  const breakdown = { performance, risk, consistency, discipline };
  const rawValue = round(
    performance * 0.35 + risk * 0.2 + consistency * 0.2 + discipline * 0.25,
    1,
  );
  const confidence = round(Math.min(1, closedTrades.length / 10), 2);
  const value = Math.round(50 + (rawValue - 50) * confidence);

  return {
    value: clamp(value),
    rawValue,
    confidence,
    status: closedTrades.length < 10 ? "PRELIMINARY" : "ESTABLISHED",
    breakdown,
    reviewedTrades,
    plannedTrades,
  };
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
  const winRate = wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null;
  const profitFactor = grossLoss > 0
    ? round(grossProfit / grossLoss, 2)
    : grossProfit > 0
      ? Infinity
      : null;

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
    winRate,
    profitFactor,
    ffzScore: calculateFfzScore(
      closedTrades,
      pnls,
      grossProfit,
      grossLoss,
      profitFactor,
      winRate,
    ),
    points,
  };
}
