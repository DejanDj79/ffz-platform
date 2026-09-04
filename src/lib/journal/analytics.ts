import {
  EXECUTION_REVIEW_OPTIONS,
  MINDSET_REVIEW_OPTIONS,
  readDisciplineReview,
} from "./discipline";
import type {
  JournalInstrument,
  TradeApiModel,
  TradeDirection,
} from "./types";

export type JournalAnalyticsPeriod = "ALL" | "30D" | "90D" | "YTD";

export type JournalAnalyticsFilters = {
  period: JournalAnalyticsPeriod;
  instrument: "ALL" | JournalInstrument;
  direction: "ALL" | TradeDirection;
  challengeId: "ALL" | "NONE" | string;
};

export type JournalBreakdownRow = {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
  averageR: number | null;
  profitFactor: number | null;
};

export type JournalEquityPoint = {
  date: string;
  pnl: number;
  cumulativePnl: number;
};

export type JournalDailyPnlPoint = {
  date: string;
  pnl: number;
  trades: number;
};

export type JournalAnalytics = {
  filteredTrades: TradeApiModel[];
  closedTrades: TradeApiModel[];
  totalTrades: number;
  closedCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  averageR: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  equityCurve: JournalEquityPoint[];
  dailyPnl: JournalDailyPnlPoint[];
  byInstrument: JournalBreakdownRow[];
  byDirection: JournalBreakdownRow[];
  byWeekday: JournalBreakdownRow[];
  bySetup: JournalBreakdownRow[];
  byTag: JournalBreakdownRow[];
  byExecution: JournalBreakdownRow[];
  byMindset: JournalBreakdownRow[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function tradeTimestamp(trade: TradeApiModel) {
  return new Date(trade.closedAt ?? trade.openedAt);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodStart(period: JournalAnalyticsPeriod, now: Date) {
  if (period === "ALL") return null;

  if (period === "YTD") {
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }

  const days = period === "30D" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start;
}

export function filterTradesForAnalytics(
  trades: TradeApiModel[],
  filters: JournalAnalyticsFilters,
  now = new Date(),
) {
  const start = periodStart(filters.period, now);

  return trades.filter((trade) => {
    if (start && tradeTimestamp(trade).getTime() < start.getTime()) {
      return false;
    }

    if (
      filters.instrument !== "ALL" &&
      trade.instrument !== filters.instrument
    ) {
      return false;
    }

    if (
      filters.direction !== "ALL" &&
      trade.direction !== filters.direction
    ) {
      return false;
    }

    if (filters.challengeId !== "ALL") {
      const target = filters.challengeId === "NONE" ? null : filters.challengeId;
      if (trade.challengeId !== target) return false;
    }

    return true;
  });
}

function calculateBreakdownRow(
  key: string,
  label: string,
  trades: TradeApiModel[],
): JournalBreakdownRow {
  const closed = trades.filter((trade) => trade.status === "CLOSED");
  const wins = closed.filter((trade) => trade.outcome === "WIN").length;
  const losses = closed.filter((trade) => trade.outcome === "LOSS").length;
  const breakeven = closed.filter((trade) => trade.outcome === "BREAKEVEN").length;
  const pnls = closed.map((trade) => trade.netPnl ?? 0);
  const netPnl = round(pnls.reduce((sum, value) => sum + value, 0));
  const grossProfit = pnls.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
  );
  const rValues = closed
    .map((trade) => trade.rMultiple)
    .filter((value): value is number => value != null);

  return {
    key,
    label,
    trades: closed.length,
    wins,
    losses,
    breakeven,
    winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null,
    netPnl,
    averagePnl: closed.length > 0 ? round(netPnl / closed.length) : null,
    averageR:
      rValues.length > 0
        ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length, 3)
        : null,
    profitFactor:
      grossLoss > 0
        ? round(grossProfit / grossLoss, 2)
        : grossProfit > 0
          ? Infinity
          : null,
  };
}

function breakdown(
  trades: TradeApiModel[],
  keyFor: (trade: TradeApiModel) => string | null,
  labelFor: (key: string) => string = (key) => key,
) {
  const groups = new Map<string, TradeApiModel[]>();

  for (const trade of trades) {
    const key = keyFor(trade);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(trade);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => calculateBreakdownRow(key, labelFor(key), group))
    .sort((a, b) => b.trades - a.trades || b.netPnl - a.netPnl);
}

function calculateStreaks(trades: TradeApiModel[]) {
  const ordered = [...trades]
    .filter((trade) => trade.status === "CLOSED")
    .sort((a, b) => tradeTimestamp(a).getTime() - tradeTimestamp(b).getTime());

  let winRun = 0;
  let lossRun = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  for (const trade of ordered) {
    if (trade.outcome === "WIN") {
      winRun += 1;
      lossRun = 0;
      maxWinStreak = Math.max(maxWinStreak, winRun);
    } else if (trade.outcome === "LOSS") {
      lossRun += 1;
      winRun = 0;
      maxLossStreak = Math.max(maxLossStreak, lossRun);
    } else {
      winRun = 0;
      lossRun = 0;
    }
  }

  return { maxWinStreak, maxLossStreak };
}

export function calculateJournalAnalytics(
  trades: TradeApiModel[],
  filters: JournalAnalyticsFilters,
  now = new Date(),
): JournalAnalytics {
  const filteredTrades = filterTradesForAnalytics(trades, filters, now);
  const closedTrades = filteredTrades
    .filter((trade) => trade.status === "CLOSED")
    .sort((a, b) => tradeTimestamp(a).getTime() - tradeTimestamp(b).getTime());

  const wins = closedTrades.filter((trade) => trade.outcome === "WIN").length;
  const losses = closedTrades.filter((trade) => trade.outcome === "LOSS").length;
  const breakeven = closedTrades.filter((trade) => trade.outcome === "BREAKEVEN").length;
  const pnls = closedTrades.map((trade) => trade.netPnl ?? 0);
  const netPnl = round(pnls.reduce((sum, value) => sum + value, 0));
  const winningPnls = pnls.filter((value) => value > 0);
  const losingPnls = pnls.filter((value) => value < 0);
  const grossProfit = winningPnls.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losingPnls.reduce((sum, value) => sum + value, 0));
  const rValues = closedTrades
    .map((trade) => trade.rMultiple)
    .filter((value): value is number => value != null);

  let cumulativePnl = 0;
  const tradeEquityPoints = closedTrades.map((trade) => {
    const pnl = trade.netPnl ?? 0;
    cumulativePnl = round(cumulativePnl + pnl);
    return {
      date: trade.closedAt ?? trade.openedAt,
      pnl: round(pnl),
      cumulativePnl,
    };
  });

  const equityCurve: JournalEquityPoint[] = closedTrades.length === 0
    ? []
    : [
        {
          date: closedTrades[0].openedAt,
          pnl: 0,
          cumulativePnl: 0,
        },
        ...tradeEquityPoints,
      ];

  const dailyMap = new Map<string, { pnl: number; trades: number }>();
  for (const trade of closedTrades) {
    const key = dateKey(tradeTimestamp(trade));
    const current = dailyMap.get(key) ?? { pnl: 0, trades: 0 };
    current.pnl += trade.netPnl ?? 0;
    current.trades += 1;
    dailyMap.set(key, current);
  }

  const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const executionLabels = new Map<string, string>(
    EXECUTION_REVIEW_OPTIONS.map((option) => [option.value, option.label]),
  );
  const mindsetLabels = new Map<string, string>(
    MINDSET_REVIEW_OPTIONS.map((option) => [option.value, option.label]),
  );
  const { maxWinStreak, maxLossStreak } = calculateStreaks(closedTrades);

  const tagTrades: TradeApiModel[] = [];
  for (const trade of closedTrades) {
    if (trade.tags.length === 0) continue;
    for (const tag of new Set(trade.tags.map((item) => item.trim()).filter(Boolean))) {
      if (tag.startsWith("FFZ:")) continue;
      tagTrades.push({ ...trade, setup: `__TAG__${tag}` });
    }
  }

  return {
    filteredTrades,
    closedTrades,
    totalTrades: filteredTrades.length,
    closedCount: closedTrades.length,
    wins,
    losses,
    breakeven,
    netPnl,
    winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null,
    profitFactor:
      grossLoss > 0
        ? round(grossProfit / grossLoss, 2)
        : grossProfit > 0
          ? Infinity
          : null,
    expectancy: closedTrades.length > 0 ? round(netPnl / closedTrades.length) : null,
    averageR:
      rValues.length > 0
        ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length, 3)
        : null,
    averageWin:
      winningPnls.length > 0
        ? round(winningPnls.reduce((sum, value) => sum + value, 0) / winningPnls.length)
        : null,
    averageLoss:
      losingPnls.length > 0
        ? round(losingPnls.reduce((sum, value) => sum + value, 0) / losingPnls.length)
        : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
    maxWinStreak,
    maxLossStreak,
    equityCurve,
    dailyPnl: Array.from(dailyMap.entries()).map(([date, value]) => ({
      date,
      pnl: round(value.pnl),
      trades: value.trades,
    })),
    byInstrument: breakdown(closedTrades, (trade) => trade.instrument),
    byDirection: breakdown(closedTrades, (trade) => trade.direction),
    byWeekday: breakdown(
      closedTrades,
      (trade) => String(tradeTimestamp(trade).getDay()),
      (key) => weekdayLabels[Number(key)] ?? key,
    ).sort((a, b) => Number(a.key) - Number(b.key)),
    bySetup: breakdown(closedTrades, (trade) => trade.setup?.trim() || "NO SETUP", (key) => key),
    byTag: breakdown(
      tagTrades,
      (trade) => trade.setup?.startsWith("__TAG__") ? trade.setup.slice(7) : null,
      (key) => key,
    ),
    byExecution: breakdown(
      closedTrades,
      (trade) => readDisciplineReview(trade.tags).execution,
      (key) => executionLabels.get(key) ?? key,
    ),
    byMindset: breakdown(
      closedTrades,
      (trade) => readDisciplineReview(trade.tags).mindset,
      (key) => mindsetLabels.get(key) ?? key,
    ),
  };
}
