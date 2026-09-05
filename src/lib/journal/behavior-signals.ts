import { readDisciplineReview } from "./discipline";
import type { TradeApiModel } from "./types";
import type { TradingGuardrailSettings } from "@/lib/trading/guardrails-types";

export type WeeklyBehaviorSignalKey =
  | "RAPID_REENTRY"
  | "POST_LOSS_ACTIVITY"
  | "LOSS_STREAK"
  | "OVERTRADING"
  | "DAILY_LOSS_COUNT"
  | "PLAN_BREAKDOWN"
  | "MINDSET_SHIFT"
  | "RISK_ESCALATION";

export type WeeklyBehaviorSignalTone = "clear" | "watch" | "warning" | "unavailable";

export type WeeklyBehaviorTradeRef = {
  id: string;
  instrument: string;
  openedAt: string;
  outcome: TradeApiModel["outcome"];
  netPnl: number;
  execution: string | null;
  mindset: string | null;
};

export type WeeklyBehaviorSignalEvent = {
  id: string;
  title: string;
  detail: string;
  trades: WeeklyBehaviorTradeRef[];
};

export type WeeklyBehaviorSignal = {
  key: WeeklyBehaviorSignalKey;
  label: string;
  value: string;
  caption: string;
  tone: WeeklyBehaviorSignalTone;
  summary: string;
  events: WeeklyBehaviorSignalEvent[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(value);
}

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function tradeRef(trade: TradeApiModel): WeeklyBehaviorTradeRef {
  const review = readDisciplineReview(trade.tags);
  return {
    id: trade.id,
    instrument: trade.instrument,
    openedAt: trade.openedAt,
    outcome: trade.outcome,
    netPnl: trade.netPnl ?? 0,
    execution: review.execution,
    mindset: review.mindset,
  };
}

function sortedClosedTrades(trades: TradeApiModel[]) {
  return trades
    .filter((trade) => trade.status === "CLOSED")
    .slice()
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
}

function groupByOpenedDay(trades: TradeApiModel[]) {
  const groups = new Map<string, TradeApiModel[]>();
  for (const trade of trades) {
    const key = localDateKey(new Date(trade.openedAt));
    const group = groups.get(key) ?? [];
    group.push(trade);
    groups.set(key, group);
  }
  return groups;
}

function minutesAfterLoss(loss: TradeApiModel, next: TradeApiModel) {
  const lossClose = new Date(loss.closedAt ?? loss.openedAt);
  const nextOpen = new Date(next.openedAt);
  if (localDateKey(lossClose) !== localDateKey(nextOpen)) return null;
  const minutes = (nextOpen.getTime() - lossClose.getTime()) / 60000;
  return minutes >= 0 ? minutes : null;
}

function nextTradeAfterLossPairs(trades: TradeApiModel[]) {
  const pairs: Array<{ loss: TradeApiModel; next: TradeApiModel; minutes: number }> = [];
  for (let index = 0; index < trades.length - 1; index += 1) {
    const loss = trades[index];
    if (loss.outcome !== "LOSS") continue;
    const next = trades[index + 1];
    const minutes = minutesAfterLoss(loss, next);
    if (minutes == null) continue;
    pairs.push({ loss, next, minutes });
  }
  return pairs;
}

function rapidReentrySignal(pairs: ReturnType<typeof nextTradeAfterLossPairs>): WeeklyBehaviorSignal {
  const rapid = pairs.filter((pair) => pair.minutes <= 15);
  const netPnl = round(rapid.reduce((sum, pair) => sum + (pair.next.netPnl ?? 0), 0));

  return {
    key: "RAPID_REENTRY",
    label: "RAPID RE-ENTRY",
    value: String(rapid.length),
    caption: "Next trade within 15m of a loss",
    tone: rapid.length > 0 ? "warning" : "clear",
    summary: rapid.length > 0
      ? `${rapid.length} same-day follow-up ${rapid.length === 1 ? "trade was" : "trades were"} opened within 15 minutes of a loss and produced ${money(netPnl)}.`
      : "No same-day follow-up trade was opened within 15 minutes of a loss.",
    events: rapid.map((pair, index) => ({
      id: `rapid-${pair.loss.id}-${pair.next.id}-${index}`,
      title: `${pair.next.instrument} · ${round(pair.minutes, 1)}m after loss`,
      detail: `Follow-up result ${money(pair.next.netPnl ?? 0)}.`,
      trades: [tradeRef(pair.loss), tradeRef(pair.next)],
    })),
  };
}

function postLossActivitySignal(trades: TradeApiModel[]): WeeklyBehaviorSignal {
  const events: WeeklyBehaviorSignalEvent[] = [];
  let followUpTrades = 0;
  let followUpPnl = 0;

  for (const group of groupByOpenedDay(trades).values()) {
    const firstLossIndex = group.findIndex((trade) => trade.outcome === "LOSS");
    if (firstLossIndex < 0) continue;
    const afterLoss = group.slice(firstLossIndex + 1);
    if (afterLoss.length < 2) continue;

    followUpTrades += afterLoss.length;
    const pnl = round(afterLoss.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0));
    followUpPnl += pnl;
    const day = new Date(group[firstLossIndex].openedAt);
    events.push({
      id: `post-loss-${localDateKey(day)}`,
      title: `${dayLabel(day)} · ${afterLoss.length} trades after first loss`,
      detail: `Those post-loss trades produced ${money(pnl)}.`,
      trades: [tradeRef(group[firstLossIndex]), ...afterLoss.map(tradeRef)],
    });
  }

  followUpPnl = round(followUpPnl);
  return {
    key: "POST_LOSS_ACTIVITY",
    label: "POST-LOSS ACTIVITY",
    value: String(events.length),
    caption: "Days with 2+ trades after first loss",
    tone: events.length > 0 ? "watch" : "clear",
    summary: events.length > 0
      ? `${events.length} ${events.length === 1 ? "day had" : "days had"} two or more additional trades after the first loss; ${followUpTrades} trades produced ${money(followUpPnl)}.`
      : "No day contained two or more additional trades after the first loss.",
    events,
  };
}

function lossStreakSignal(trades: TradeApiModel[]): WeeklyBehaviorSignal {
  const streaks: TradeApiModel[][] = [];
  let current: TradeApiModel[] = [];

  for (const trade of trades) {
    if (trade.outcome === "LOSS") {
      current.push(trade);
      continue;
    }
    if (current.length >= 2) streaks.push(current);
    current = [];
  }
  if (current.length >= 2) streaks.push(current);

  const maxStreak = streaks.reduce((max, streak) => Math.max(max, streak.length), 0);
  return {
    key: "LOSS_STREAK",
    label: "LOSS STREAK",
    value: String(maxStreak),
    caption: "Maximum consecutive losses",
    tone: maxStreak >= 3 ? "warning" : maxStreak === 2 ? "watch" : "clear",
    summary: maxStreak >= 2
      ? `The longest run was ${maxStreak} consecutive losing trades; ${streaks.length} loss ${streaks.length === 1 ? "streak" : "streaks"} reached at least two trades.`
      : "No consecutive loss streak of two or more trades occurred.",
    events: streaks.map((streak, index) => ({
      id: `loss-streak-${streak[0].id}-${index}`,
      title: `${streak.length} consecutive losses`,
      detail: `Combined result ${money(streak.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0))}.`,
      trades: streak.map(tradeRef),
    })),
  };
}

function overtradingSignal(
  trades: TradeApiModel[],
  settings: TradingGuardrailSettings | null,
): WeeklyBehaviorSignal {
  const rule = settings?.maxTradesPerDay;
  if (!rule?.enabled) {
    return {
      key: "OVERTRADING",
      label: "OVERTRADING DAYS",
      value: "—",
      caption: "Compared with Max Trades / Day",
      tone: "unavailable",
      summary: "Max Trades / Day guardrail is not enabled, so FFZ does not infer an overtrading breach.",
      events: [],
    };
  }

  const limit = Math.max(1, Math.trunc(rule.value));
  const events: WeeklyBehaviorSignalEvent[] = [];
  for (const group of groupByOpenedDay(trades).values()) {
    if (group.length <= limit) continue;
    const day = new Date(group[0].openedAt);
    events.push({
      id: `overtrading-${localDateKey(day)}`,
      title: `${dayLabel(day)} · ${group.length} trades`,
      detail: `Max Trades / Day guardrail: ${limit}.`,
      trades: group.map(tradeRef),
    });
  }

  return {
    key: "OVERTRADING",
    label: "OVERTRADING DAYS",
    value: String(events.length),
    caption: `Guardrail limit ${limit} trades/day`,
    tone: events.length > 0 ? "warning" : "clear",
    summary: events.length > 0
      ? `${events.length} ${events.length === 1 ? "day exceeded" : "days exceeded"} the configured Max Trades / Day guardrail.`
      : `No day exceeded the configured ${limit}-trade daily limit.`,
    events,
  };
}

function dailyLossCountSignal(
  trades: TradeApiModel[],
  settings: TradingGuardrailSettings | null,
): WeeklyBehaviorSignal {
  const rule = settings?.maxDailyLosses;
  if (!rule?.enabled) {
    return {
      key: "DAILY_LOSS_COUNT",
      label: "DAILY LOSS COUNT",
      value: "—",
      caption: "Compared with Max Daily Losses",
      tone: "unavailable",
      summary: "Max Daily Losses guardrail is not enabled, so FFZ does not infer a daily loss-count breach.",
      events: [],
    };
  }

  const limit = Math.max(1, Math.trunc(rule.value));
  const reached: WeeklyBehaviorSignalEvent[] = [];
  let nearLimitDays = 0;

  for (const group of groupByOpenedDay(trades).values()) {
    const losses = group.filter((trade) => trade.outcome === "LOSS");
    if (losses.length >= limit) {
      const day = new Date(group[0].openedAt);
      reached.push({
        id: `daily-loss-${localDateKey(day)}`,
        title: `${dayLabel(day)} · ${losses.length} losses`,
        detail: losses.length > limit
          ? `Exceeded the Max Daily Losses guardrail of ${limit}.`
          : `Reached the Max Daily Losses guardrail of ${limit}.`,
        trades: losses.map(tradeRef),
      });
    } else if (limit > 1 && losses.length === limit - 1) {
      nearLimitDays += 1;
    }
  }

  return {
    key: "DAILY_LOSS_COUNT",
    label: "DAILY LOSS COUNT",
    value: String(reached.length),
    caption: `Days at/over ${limit} losses`,
    tone: reached.length > 0 ? "warning" : nearLimitDays > 0 ? "watch" : "clear",
    summary: reached.length > 0
      ? `${reached.length} ${reached.length === 1 ? "day reached or exceeded" : "days reached or exceeded"} the configured Max Daily Losses guardrail.${nearLimitDays > 0 ? ` ${nearLimitDays} additional ${nearLimitDays === 1 ? "day finished" : "days finished"} one loss below the limit.` : ""}`
      : nearLimitDays > 0
        ? `${nearLimitDays} ${nearLimitDays === 1 ? "day finished" : "days finished"} one loss below the configured limit of ${limit}.`
        : `No day approached or reached the configured limit of ${limit} losses.`,
    events: reached,
  };
}

function planBreakdownSignal(pairs: ReturnType<typeof nextTradeAfterLossPairs>): WeeklyBehaviorSignal {
  const events = pairs.flatMap((pair, index) => {
    const review = readDisciplineReview(pair.next.tags);
    if (review.execution !== "DEVIATED" && review.execution !== "UNPLANNED") return [];
    return [{
      id: `plan-breakdown-${pair.loss.id}-${pair.next.id}-${index}`,
      title: `${pair.next.instrument} · ${review.execution === "DEVIATED" ? "Deviated" : "Unplanned"} after loss`,
      detail: `${round(pair.minutes, 1)}m after the prior loss · result ${money(pair.next.netPnl ?? 0)}.`,
      trades: [tradeRef(pair.loss), tradeRef(pair.next)],
    } satisfies WeeklyBehaviorSignalEvent];
  });

  return {
    key: "PLAN_BREAKDOWN",
    label: "PLAN BREAKDOWN",
    value: String(events.length),
    caption: "Deviated / Unplanned after loss",
    tone: events.length > 0 ? "warning" : "clear",
    summary: events.length > 0
      ? `${events.length} immediate same-day post-loss ${events.length === 1 ? "trade was" : "trades were"} explicitly marked Deviated or Unplanned.`
      : "No immediate same-day post-loss trade was marked Deviated or Unplanned.",
    events,
  };
}

function mindsetShiftSignal(pairs: ReturnType<typeof nextTradeAfterLossPairs>): WeeklyBehaviorSignal {
  const stable = new Set(["CALM", "FOCUSED"]);
  const pressure = new Set(["FOMO", "REVENGE", "FRUSTRATED", "FEAR"]);
  const events: WeeklyBehaviorSignalEvent[] = [];

  for (const [index, pair] of pairs.entries()) {
    const before = readDisciplineReview(pair.loss.tags).mindset;
    const after = readDisciplineReview(pair.next.tags).mindset;
    if (!before || !after || !stable.has(before) || !pressure.has(after)) continue;
    events.push({
      id: `mindset-shift-${pair.loss.id}-${pair.next.id}-${index}`,
      title: `${before} → ${after}`,
      detail: `${pair.next.instrument} opened ${round(pair.minutes, 1)}m after the loss · result ${money(pair.next.netPnl ?? 0)}.`,
      trades: [tradeRef(pair.loss), tradeRef(pair.next)],
    });
  }

  return {
    key: "MINDSET_SHIFT",
    label: "MINDSET SHIFT",
    value: String(events.length),
    caption: "Calm/Focused → pressure tag after loss",
    tone: events.length > 0 ? "watch" : "clear",
    summary: events.length > 0
      ? `${events.length} reviewed post-loss ${events.length === 1 ? "pair changed" : "pairs changed"} from Calm/Focused to an explicitly selected FOMO, Revenge, Frustrated or Fear tag.`
      : "No reviewed post-loss pair matched the defined Calm/Focused-to-pressure mindset shift.",
    events,
  };
}

function riskEscalationSignal(pairs: ReturnType<typeof nextTradeAfterLossPairs>): WeeklyBehaviorSignal {
  const events: WeeklyBehaviorSignalEvent[] = [];
  let totalIncrease = 0;

  for (const [index, pair] of pairs.entries()) {
    const before = pair.loss.initialRisk;
    const after = pair.next.initialRisk;
    if (before == null || after == null || before <= 0 || after <= before + 0.01) continue;
    const increase = round(after - before);
    totalIncrease += increase;
    events.push({
      id: `risk-escalation-${pair.loss.id}-${pair.next.id}-${index}`,
      title: `${money(before)} → ${money(after)} initial risk`,
      detail: `Risk increased ${money(increase)} on the immediate same-day trade after a loss.`,
      trades: [tradeRef(pair.loss), tradeRef(pair.next)],
    });
  }

  totalIncrease = round(totalIncrease);
  return {
    key: "RISK_ESCALATION",
    label: "RISK ESCALATION",
    value: String(events.length),
    caption: "Higher initial risk after loss",
    tone: events.length > 0 ? "warning" : "clear",
    summary: events.length > 0
      ? `${events.length} immediate post-loss ${events.length === 1 ? "trade used" : "trades used"} higher initial risk than the losing trade before it; total observed increase ${money(totalIncrease)}.`
      : "No immediate same-day post-loss trade used higher recorded initial risk than the loss before it.",
    events,
  };
}

export function calculateWeeklyBehaviorSignals(
  trades: TradeApiModel[],
  settings: TradingGuardrailSettings | null = null,
): WeeklyBehaviorSignal[] {
  const sorted = sortedClosedTrades(trades);
  const pairs = nextTradeAfterLossPairs(sorted);

  return [
    rapidReentrySignal(pairs),
    postLossActivitySignal(sorted),
    lossStreakSignal(sorted),
    overtradingSignal(sorted, settings),
    dailyLossCountSignal(sorted, settings),
    planBreakdownSignal(pairs),
    mindsetShiftSignal(pairs),
    riskEscalationSignal(pairs),
  ];
}
