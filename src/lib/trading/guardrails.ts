import { marketDateKey } from "@/lib/journal/market-time";
import type { TradeApiModel } from "@/lib/journal/types";
import type { EconomicCalendarEvent } from "@/lib/economic-calendar/types";
import type {
  DailyTradingStats,
  EvaluateNewsGuardrailsInput,
  EvaluatePersonalGuardrailsInput,
  GuardrailSeverity,
  TradeGuardrailCheck,
  TradingGuardrailSettings,
} from "./guardrails-types";
import type { PositionSizeResult, RiskLevel } from "./types";

export const DEFAULT_TRADING_GUARDRAILS: TradingGuardrailSettings = {
  maxRiskPerTrade: { enabled: true, value: 100, severity: "BLOCKED" },
  maxDailyLosses: { enabled: true, value: 2, severity: "BLOCKED" },
  maxTradesPerDay: { enabled: true, value: 4, severity: "CAUTION" },
  maxContracts: { enabled: true, value: 1 },
  minRewardRisk: { enabled: true, value: 1, severity: "CAUTION" },
  noNewTradesAfter: { enabled: false, timeEt: "16:00", severity: "BLOCKED" },
  highImpactNews: { enabled: true, beforeMinutes: 10, afterMinutes: 10, severity: "BLOCKED" },
  mediumImpactNews: { enabled: false, beforeMinutes: 5, afterMinutes: 5, severity: "CAUTION" },
  majorNewsOverride: {
    enabled: true,
    beforeMinutes: 15,
    afterMinutes: 15,
    severity: "BLOCKED",
    keywords: [
      "CPI",
      "Consumer Price Index",
      "FOMC",
      "Federal Funds",
      "Non-Farm",
      "Nonfarm",
    ],
  },
};

const EQUITY_INDEX_FUTURES = new Set(["MNQ", "MES", "NQ", "ES"]);

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function check(
  code: string,
  source: TradeGuardrailCheck["source"],
  severity: GuardrailSeverity,
  reason: string,
): TradeGuardrailCheck {
  return { code, source, severity, reason };
}

function riskLevelFromUsage(drawdownUsagePct: number | null): RiskLevel {
  if (drawdownUsagePct == null) return "N/A";
  if (drawdownUsagePct <= 5) return "LOW";
  if (drawdownUsagePct <= 10) return "MODERATE";
  return "HIGH";
}

export function marketMinuteOfDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseTimeEt(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function calculateDailyTradingStats(
  trades: TradeApiModel[],
  now = new Date(),
): DailyTradingStats {
  const today = marketDateKey(now);

  const todayTrades = trades.filter(
    (trade) => marketDateKey(trade.openedAt) === today,
  );

  const losses = trades.filter(
    (trade) =>
      trade.status === "CLOSED" &&
      trade.outcome === "LOSS" &&
      marketDateKey(trade.closedAt ?? trade.openedAt) === today,
  ).length;

  return {
    trades: todayTrades.length,
    losses,
  };
}

export function personalContractLimit(settings: TradingGuardrailSettings) {
  if (!settings.maxContracts.enabled) return null;
  const value = Math.floor(settings.maxContracts.value);
  return value > 0 ? value : null;
}

export function applyPersonalContractLimit(
  result: PositionSizeResult,
  contractLimit: number | null,
  remainingDrawdown: number | null,
  remainingDailyLoss: number | null,
): PositionSizeResult {
  if (contractLimit == null || result.maxContracts <= contractLimit) return result;

  const maxContracts = contractLimit;
  const actualRisk = result.riskPerContract * maxContracts;
  const drawdownUsagePct = remainingDrawdown && remainingDrawdown > 0
    ? (actualRisk / remainingDrawdown) * 100
    : result.drawdownUsagePct;
  const dailyLossUsagePct = remainingDailyLoss && remainingDailyLoss > 0
    ? (actualRisk / remainingDailyLoss) * 100
    : result.dailyLossUsagePct;

  return {
    ...result,
    maxContracts,
    actualRisk,
    unusedRiskBudget: Math.max(0, result.effectiveRiskBudget - actualRisk),
    drawdownUsagePct,
    dailyLossUsagePct,
    riskLevel: riskLevelFromUsage(drawdownUsagePct),
  };
}

export function evaluatePersonalGuardrails({
  result,
  settings,
  dailyStats,
  now = new Date(),
  uncappedMaxContracts = null,
  journalAvailable = true,
}: EvaluatePersonalGuardrailsInput): TradeGuardrailCheck[] {
  const checks: TradeGuardrailCheck[] = [];

  if (
    settings.maxRiskPerTrade.enabled &&
    result.actualRisk > settings.maxRiskPerTrade.value + 0.005
  ) {
    checks.push(check(
      "PERSONAL_MAX_RISK",
      "PERSONAL",
      settings.maxRiskPerTrade.severity,
      `Planned risk ${roundMoney(result.actualRisk).toFixed(2)} exceeds your personal $${roundMoney(settings.maxRiskPerTrade.value).toFixed(2)} max risk per trade.`,
    ));
  }

  const journalRulesEnabled =
    settings.maxDailyLosses.enabled || settings.maxTradesPerDay.enabled;

  if (!journalAvailable && journalRulesEnabled) {
    checks.push(check(
      "PERSONAL_JOURNAL_UNAVAILABLE",
      "PERSONAL",
      "CAUTION",
      "Journal data is unavailable, so daily trade/loss guardrails cannot be verified.",
    ));
  }

  if (
    journalAvailable &&
    settings.maxDailyLosses.enabled &&
    dailyStats.losses >= settings.maxDailyLosses.value
  ) {
    checks.push(check(
      "PERSONAL_DAILY_LOSSES",
      "PERSONAL",
      settings.maxDailyLosses.severity,
      `Daily loss stop reached: ${dailyStats.losses} loss${dailyStats.losses === 1 ? "" : "es"} today, limit ${settings.maxDailyLosses.value}.`,
    ));
  }

  if (
    journalAvailable &&
    settings.maxTradesPerDay.enabled &&
    dailyStats.trades >= settings.maxTradesPerDay.value
  ) {
    checks.push(check(
      "PERSONAL_DAILY_TRADES",
      "PERSONAL",
      settings.maxTradesPerDay.severity,
      `Daily trade count reached ${dailyStats.trades}; your personal limit is ${settings.maxTradesPerDay.value}.`,
    ));
  }

  if (settings.minRewardRisk.enabled) {
    if (result.rewardRiskRatio == null) {
      checks.push(check(
        "PERSONAL_MIN_RR_MISSING",
        "PERSONAL",
        settings.minRewardRisk.severity,
        `No target is set, so the personal minimum ${settings.minRewardRisk.value.toFixed(2)}R reward/risk rule cannot be verified.`,
      ));
    } else if (result.rewardRiskRatio < settings.minRewardRisk.value) {
      checks.push(check(
        "PERSONAL_MIN_RR",
        "PERSONAL",
        settings.minRewardRisk.severity,
        `Planned reward is ${result.rewardRiskRatio.toFixed(2)}R; your personal minimum is ${settings.minRewardRisk.value.toFixed(2)}R.`,
      ));
    }
  }

  if (settings.noNewTradesAfter.enabled) {
    const currentEt = marketMinuteOfDay(now);
    const cutoffEt = parseTimeEt(settings.noNewTradesAfter.timeEt);
    if (currentEt != null && cutoffEt != null && currentEt >= cutoffEt) {
      checks.push(check(
        "PERSONAL_TIME_CUTOFF",
        "PERSONAL",
        settings.noNewTradesAfter.severity,
        `New-trade cutoff reached: no new entries after ${settings.noNewTradesAfter.timeEt} ET.`,
      ));
    }
  }

  const cap = personalContractLimit(settings);
  if (
    cap != null &&
    uncappedMaxContracts != null &&
    uncappedMaxContracts > result.maxContracts &&
    result.maxContracts <= cap
  ) {
    checks.push(check(
      "PERSONAL_CONTRACT_CAP",
      "PERSONAL",
      "INFO",
      `Position size was capped from ${uncappedMaxContracts} to ${result.maxContracts} contract${result.maxContracts === 1 ? "" : "s"} by your personal contract limit.`,
    ));
  }

  return checks;
}

function matchesMajorNews(event: EconomicCalendarEvent, keywords: string[]) {
  const title = event.title.toLowerCase();
  return keywords.some((keyword) => {
    const normalized = keyword.trim().toLowerCase();
    return normalized.length > 0 && title.includes(normalized);
  });
}

function eventWindowCheck(
  event: EconomicCalendarEvent,
  now: Date,
  beforeMinutes: number,
  afterMinutes: number,
) {
  const eventMs = new Date(event.date).getTime();
  if (!Number.isFinite(eventMs)) return null;
  const nowMs = now.getTime();
  const start = eventMs - beforeMinutes * 60_000;
  const end = eventMs + afterMinutes * 60_000;
  if (nowMs < start || nowMs > end) return null;
  return Math.round((eventMs - nowMs) / 60_000);
}

function eventTimingText(minutesToEvent: number) {
  if (minutesToEvent > 0) return `in ${minutesToEvent} min`;
  if (minutesToEvent === 0) return "now";
  return `${Math.abs(minutesToEvent)} min ago`;
}

export function evaluateNewsGuardrails({
  instrument,
  events,
  settings,
  now = new Date(),
  calendarAvailable = true,
  calendarStale = false,
}: EvaluateNewsGuardrailsInput): TradeGuardrailCheck[] {
  const enabled =
    settings.highImpactNews.enabled ||
    settings.mediumImpactNews.enabled ||
    settings.majorNewsOverride.enabled;

  if (!enabled || !EQUITY_INDEX_FUTURES.has(instrument)) return [];

  if (!calendarAvailable) {
    return [check(
      "NEWS_CALENDAR_UNAVAILABLE",
      "NEWS",
      "CAUTION",
      "Economic Calendar is unavailable, so the configured news lockout cannot be verified.",
    )];
  }

  const checks: TradeGuardrailCheck[] = [];

  if (calendarStale) {
    checks.push(check(
      "NEWS_CALENDAR_STALE",
      "NEWS",
      "CAUTION",
      "Economic Calendar data is stale; news lockout coverage may be incomplete.",
    ));
  }

  for (const event of events) {
    if (event.currency !== "USD") continue;

    const major =
      settings.majorNewsOverride.enabled &&
      matchesMajorNews(event, settings.majorNewsOverride.keywords);

    const rule = major
      ? settings.majorNewsOverride
      : event.impact === "High" && settings.highImpactNews.enabled
        ? settings.highImpactNews
        : event.impact === "Medium" && settings.mediumImpactNews.enabled
          ? settings.mediumImpactNews
          : null;

    if (!rule) continue;

    const minutesToEvent = eventWindowCheck(
      event,
      now,
      rule.beforeMinutes,
      rule.afterMinutes,
    );
    if (minutesToEvent == null) continue;

    checks.push(check(
      major ? `NEWS_MAJOR_${event.id}` : `NEWS_${event.impact.toUpperCase()}_${event.id}`,
      "NEWS",
      rule.severity,
      `${major ? "Major" : event.impact} USD news lockout: ${event.title} ${eventTimingText(minutesToEvent)} (${rule.beforeMinutes}m before / ${rule.afterMinutes}m after).`,
    ));
  }

  return checks;
}
