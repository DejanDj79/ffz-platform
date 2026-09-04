import { readDisciplineReview } from "./discipline";
import { STARTED_FROM_PLAN_TAG } from "./planned";
import {
  calculateTradeReviewPerformance,
  tradeReviewPerformanceBounds,
  type FfzScore,
  type TradeReviewPerformancePoint,
} from "./trade-review-performance";
import type { TradeApiModel } from "./types";

export type WeeklyReviewBreakdownRow = {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRate: number | null;
};

export type WeeklyReviewHighlight = {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
};

export type WeeklyReviewPostLoss = {
  losses: number;
  followUps: number;
  averageNextPnl: number | null;
  followUpWinRate: number | null;
  averageMinutesToNextTrade: number | null;
  rapidReEntries: number;
  deviatedOrUnplanned: number;
};

export type WeeklyReviewFinding = {
  tone: "positive" | "warning" | "neutral";
  text: string;
};

export type WeeklyReview = {
  start: Date;
  end: Date;
  label: string;
  closedTrades: TradeApiModel[];
  netPnl: number;
  profitFactor: number | null;
  winRate: number | null;
  tradeCount: number;
  averageR: number | null;
  maxDrawdown: number;
  ffzScore: FfzScore;
  dailyPoints: TradeReviewPerformancePoint[];
  execution: WeeklyReviewBreakdownRow[];
  mindset: WeeklyReviewBreakdownRow[];
  origin: WeeklyReviewBreakdownRow[];
  postLoss: WeeklyReviewPostLoss;
  highlights: WeeklyReviewHighlight[];
  findings: WeeklyReviewFinding[];
};

const EXECUTION_LABELS: Record<string, string> = {
  ON_PLAN: "On plan",
  DEVIATED: "Deviated",
  UNPLANNED: "Unplanned",
  UNREVIEWED: "Not reviewed",
};

const MINDSET_LABELS: Record<string, string> = {
  CALM: "Calm",
  FOCUSED: "Focused",
  FOMO: "FOMO",
  REVENGE: "Revenge",
  FEAR: "Fear",
  FRUSTRATED: "Frustrated",
  TIRED: "Tired",
  UNREVIEWED: "Not reviewed",
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
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

function maxDrawdown(pnls: number[]) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }

  return round(drawdown);
}

function calculateRow(key: string, label: string, trades: TradeApiModel[]): WeeklyReviewBreakdownRow {
  const wins = trades.filter((trade) => trade.outcome === "WIN").length;
  const losses = trades.filter((trade) => trade.outcome === "LOSS").length;
  const netPnl = round(trades.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0));

  return {
    key,
    label,
    trades: trades.length,
    wins,
    losses,
    netPnl,
    winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null,
  };
}

function groupedRows(
  trades: TradeApiModel[],
  keyFor: (trade: TradeApiModel) => string,
  labels: Record<string, string>,
) {
  const groups = new Map<string, TradeApiModel[]>();

  for (const trade of trades) {
    const key = keyFor(trade);
    const group = groups.get(key) ?? [];
    group.push(trade);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => calculateRow(key, labels[key] ?? key, group))
    .sort((a, b) => b.trades - a.trades || b.netPnl - a.netPnl);
}

function calculatePostLoss(trades: TradeApiModel[]): WeeklyReviewPostLoss {
  let followUps = 0;
  let nextPnlTotal = 0;
  let nextWins = 0;
  let nextLosses = 0;
  let minutesTotal = 0;
  let rapidReEntries = 0;
  let deviatedOrUnplanned = 0;
  const losses = trades.filter((trade) => trade.outcome === "LOSS").length;

  for (let index = 0; index < trades.length - 1; index += 1) {
    const current = trades[index];
    if (current.outcome !== "LOSS") continue;

    const next = trades[index + 1];
    const currentClosed = tradeTimestamp(current);
    const nextOpened = new Date(next.openedAt);
    if (localDateKey(currentClosed) !== localDateKey(nextOpened)) continue;

    const minutes = Math.max(0, (nextOpened.getTime() - currentClosed.getTime()) / 60000);
    const review = readDisciplineReview(next.tags);

    followUps += 1;
    nextPnlTotal += next.netPnl ?? 0;
    minutesTotal += minutes;
    if (next.outcome === "WIN") nextWins += 1;
    if (next.outcome === "LOSS") nextLosses += 1;
    if (minutes <= 15) rapidReEntries += 1;
    if (review.execution === "DEVIATED" || review.execution === "UNPLANNED") {
      deviatedOrUnplanned += 1;
    }
  }

  return {
    losses,
    followUps,
    averageNextPnl: followUps > 0 ? round(nextPnlTotal / followUps) : null,
    followUpWinRate:
      nextWins + nextLosses > 0
        ? round((nextWins / (nextWins + nextLosses)) * 100, 1)
        : null,
    averageMinutesToNextTrade: followUps > 0 ? round(minutesTotal / followUps, 1) : null,
    rapidReEntries,
    deviatedOrUnplanned,
  };
}

function setupRows(trades: TradeApiModel[]) {
  const groups = new Map<string, TradeApiModel[]>();

  for (const trade of trades) {
    const key = trade.setup?.trim() || "No setup";
    const group = groups.get(key) ?? [];
    group.push(trade);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => calculateRow(key, key, group))
    .sort((a, b) => b.netPnl - a.netPnl || b.trades - a.trades);
}

function moneyLabel(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function buildHighlights(
  dailyPoints: TradeReviewPerformancePoint[],
  setups: WeeklyReviewBreakdownRow[],
  origin: WeeklyReviewBreakdownRow[],
): WeeklyReviewHighlight[] {
  const tradedDays = dailyPoints.filter((point) => point.trades > 0);
  const bestDay = [...tradedDays].sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay = [...tradedDays].sort((a, b) => a.pnl - b.pnl)[0];
  const bestSetup = setups[0];
  const planned = origin.find((row) => row.key === "PLANNED");

  return [
    {
      label: "BEST DAY",
      value: bestDay ? bestDay.label : "—",
      detail: bestDay ? moneyLabel(bestDay.pnl) : "No trades",
      tone: bestDay && bestDay.pnl > 0 ? "positive" : "neutral",
    },
    {
      label: "WORST DAY",
      value: worstDay ? worstDay.label : "—",
      detail: worstDay ? moneyLabel(worstDay.pnl) : "No trades",
      tone: worstDay && worstDay.pnl < 0 ? "negative" : "neutral",
    },
    {
      label: "BEST SETUP",
      value: bestSetup ? bestSetup.label : "—",
      detail: bestSetup ? `${moneyLabel(bestSetup.netPnl)} · ${bestSetup.trades} trades` : "No setup data",
      tone: bestSetup && bestSetup.netPnl > 0 ? "positive" : "neutral",
    },
    {
      label: "PLANNED ORIGIN",
      value: planned ? `${planned.trades} trades` : "0 trades",
      detail: planned ? moneyLabel(planned.netPnl) : "No FFZ-planned trades",
      tone: planned && planned.netPnl > 0 ? "positive" : planned && planned.netPnl < 0 ? "negative" : "neutral",
    },
  ];
}

function buildFindings(
  trades: TradeApiModel[],
  execution: WeeklyReviewBreakdownRow[],
  mindset: WeeklyReviewBreakdownRow[],
  origin: WeeklyReviewBreakdownRow[],
  postLoss: WeeklyReviewPostLoss,
  setups: WeeklyReviewBreakdownRow[],
): WeeklyReviewFinding[] {
  if (trades.length === 0) {
    return [{ tone: "neutral", text: "No closed trades in this week yet." }];
  }

  const findings: WeeklyReviewFinding[] = [];
  const planned = origin.find((row) => row.key === "PLANNED");
  const other = origin.find((row) => row.key === "OTHER");
  const deviated = execution.find((row) => row.key === "DEVIATED");
  const unplanned = execution.find((row) => row.key === "UNPLANNED");
  const pressureMindsets = mindset
    .filter((row) => ["FOMO", "REVENGE", "FRUSTRATED"].includes(row.key))
    .reduce((sum, row) => sum + row.trades, 0);
  const bestSetup = setups.find((row) => row.trades >= 2) ?? setups[0];

  if (planned && other) {
    const difference = round(planned.netPnl - other.netPnl);
    findings.push({
      tone: difference >= 0 ? "positive" : "warning",
      text: `FFZ-planned trades finished ${moneyLabel(planned.netPnl)} versus ${moneyLabel(other.netPnl)} from other trade origins.`,
    });
  } else if (planned) {
    findings.push({
      tone: planned.netPnl >= 0 ? "positive" : "warning",
      text: `FFZ-planned trades produced ${moneyLabel(planned.netPnl)} across ${planned.trades} trades.`,
    });
  }

  const executionIssues = (deviated?.trades ?? 0) + (unplanned?.trades ?? 0);
  if (executionIssues > 0) {
    const issuePnl = round((deviated?.netPnl ?? 0) + (unplanned?.netPnl ?? 0));
    findings.push({
      tone: issuePnl < 0 ? "warning" : "neutral",
      text: `${executionIssues} trades were marked Deviated or Unplanned and together produced ${moneyLabel(issuePnl)}.`,
    });
  }

  if (postLoss.followUps > 0) {
    findings.push({
      tone: (postLoss.averageNextPnl ?? 0) < 0 || postLoss.rapidReEntries > 0 ? "warning" : "positive",
      text: `After a loss, the next same-day trade averaged ${moneyLabel(postLoss.averageNextPnl ?? 0)}; ${postLoss.rapidReEntries} of ${postLoss.followUps} follow-ups were opened within 15 minutes.`,
    });
  }

  if (pressureMindsets > 0) {
    findings.push({
      tone: "warning",
      text: `${pressureMindsets} reviewed trades were explicitly tagged FOMO, Revenge or Frustrated.`,
    });
  }

  if (bestSetup) {
    findings.push({
      tone: bestSetup.netPnl > 0 ? "positive" : "neutral",
      text: `${bestSetup.label} was the strongest setup in the week at ${moneyLabel(bestSetup.netPnl)} across ${bestSetup.trades} trades.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ tone: "neutral", text: "More reviewed trade data will unlock stronger weekly findings." });
  }

  return findings.slice(0, 5);
}

export function shiftWeeklyReviewAnchor(anchor: Date, direction: -1 | 1) {
  const next = new Date(anchor);
  next.setDate(next.getDate() + direction * 7);
  return next;
}

export function calculateWeeklyReview(trades: TradeApiModel[], anchor: Date): WeeklyReview {
  const performance = calculateTradeReviewPerformance(trades, "WEEK", anchor);
  const { start, end } = tradeReviewPerformanceBounds("WEEK", anchor);
  const closedTrades = trades
    .filter((trade) => trade.status === "CLOSED")
    .filter((trade) => {
      const timestamp = tradeTimestamp(trade).getTime();
      return timestamp >= start.getTime() && timestamp < end.getTime();
    })
    .sort((a, b) => tradeTimestamp(a).getTime() - tradeTimestamp(b).getTime());

  const rValues = closedTrades
    .map((trade) => trade.rMultiple)
    .filter((value): value is number => value != null);
  const averageR = rValues.length > 0
    ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length, 2)
    : null;
  const pnls = closedTrades.map((trade) => trade.netPnl ?? 0);

  const execution = groupedRows(
    closedTrades,
    (trade) => readDisciplineReview(trade.tags).execution ?? "UNREVIEWED",
    EXECUTION_LABELS,
  );
  const mindset = groupedRows(
    closedTrades,
    (trade) => readDisciplineReview(trade.tags).mindset ?? "UNREVIEWED",
    MINDSET_LABELS,
  );
  const origin = groupedRows(
    closedTrades,
    (trade) => trade.tags.includes(STARTED_FROM_PLAN_TAG) ? "PLANNED" : "OTHER",
    { PLANNED: "FFZ planned", OTHER: "Other origin" },
  );
  const setups = setupRows(closedTrades);
  const postLoss = calculatePostLoss(closedTrades);

  return {
    start,
    end,
    label: performance.label,
    closedTrades,
    netPnl: performance.netPnl,
    profitFactor: performance.profitFactor,
    winRate: performance.winRate,
    tradeCount: performance.tradeCount,
    averageR,
    maxDrawdown: maxDrawdown(pnls),
    ffzScore: performance.ffzScore,
    dailyPoints: performance.points,
    execution,
    mindset,
    origin,
    postLoss,
    highlights: buildHighlights(performance.points, setups, origin),
    findings: buildFindings(closedTrades, execution, mindset, origin, postLoss, setups),
  };
}
