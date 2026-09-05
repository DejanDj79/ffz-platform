import { applyDisciplineReview } from "./discipline";
import { STARTED_FROM_PLAN_TAG } from "./planned";
import type { TradeApiModel } from "./types";
import type { TradingGuardrailSettings } from "@/lib/trading/guardrails-types";

function at(weekStart: Date, dayOffset: number, hour: number, minute: number) {
  const value = new Date(weekStart);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

function demoTrade(
  weekStart: Date,
  id: string,
  dayOffset: number,
  openHour: number,
  openMinute: number,
  closeHour: number,
  closeMinute: number,
  overrides: Partial<TradeApiModel>,
): TradeApiModel {
  const openedAt = at(weekStart, dayOffset, openHour, openMinute);
  const closedAt = at(weekStart, dayOffset, closeHour, closeMinute);

  return {
    id: `behavior-demo-${id}`,
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt,
    closedAt,
    entryPrice: 24000,
    stopPrice: 23990,
    targetPrice: 24020,
    exitPrice: 24010,
    contracts: 1,
    commissionFees: 4,
    grossPnl: 24,
    netPnl: 20,
    initialRisk: 40,
    rMultiple: 0.5,
    outcome: "WIN",
    setup: "Demo Setup",
    tags: [],
    notes: "Development-only behavior signal demo trade.",
    createdAt: closedAt,
    updatedAt: closedAt,
    ...overrides,
  };
}

export const BEHAVIOR_DEMO_GUARDRAILS: TradingGuardrailSettings = {
  maxRiskPerTrade: { enabled: true, value: 100, severity: "CAUTION" },
  maxDailyLosses: { enabled: true, value: 2, severity: "CAUTION" },
  maxTradesPerDay: { enabled: true, value: 3, severity: "CAUTION" },
  maxContracts: { enabled: true, value: 1 },
  minRewardRisk: { enabled: true, value: 1, severity: "CAUTION" },
  noNewTradesAfter: { enabled: false, timeEt: "15:30", severity: "CAUTION" },
  highImpactNews: { enabled: false, beforeMinutes: 15, afterMinutes: 15, severity: "CAUTION" },
  mediumImpactNews: { enabled: false, beforeMinutes: 10, afterMinutes: 10, severity: "INFO" },
  majorNewsOverride: {
    enabled: false,
    beforeMinutes: 30,
    afterMinutes: 30,
    severity: "BLOCKED",
    keywords: ["FOMC", "CPI"],
  },
};

export function createBehaviorDemoTrades(weekStart: Date): TradeApiModel[] {
  const calmOnPlan = applyDisciplineReview([STARTED_FROM_PLAN_TAG], {
    execution: "ON_PLAN",
    mindset: "CALM",
  });
  const fomoUnplanned = applyDisciplineReview([], {
    execution: "UNPLANNED",
    mindset: "FOMO",
  });
  const frustratedDeviated = applyDisciplineReview([], {
    execution: "DEVIATED",
    mindset: "FRUSTRATED",
  });
  const focusedOnPlan = applyDisciplineReview([STARTED_FROM_PLAN_TAG], {
    execution: "ON_PLAN",
    mindset: "FOCUSED",
  });

  return [
    demoTrade(weekStart, "monday-loss-1", 0, 9, 35, 9, 42, {
      outcome: "LOSS",
      netPnl: -42,
      grossPnl: -38,
      initialRisk: 40,
      rMultiple: -1.05,
      tags: calmOnPlan,
    }),
    demoTrade(weekStart, "monday-loss-2", 0, 9, 49, 9, 55, {
      instrument: "MES",
      outcome: "LOSS",
      netPnl: -61,
      grossPnl: -57,
      initialRisk: 80,
      rMultiple: -0.76,
      tags: fomoUnplanned,
    }),
    demoTrade(weekStart, "monday-loss-3", 0, 10, 4, 10, 10, {
      outcome: "LOSS",
      netPnl: -34,
      grossPnl: -30,
      initialRisk: 95,
      rMultiple: -0.36,
      tags: frustratedDeviated,
    }),
    demoTrade(weekStart, "monday-win", 0, 10, 22, 10, 31, {
      instrument: "MES",
      outcome: "WIN",
      netPnl: 26,
      grossPnl: 30,
      initialRisk: 60,
      rMultiple: 0.43,
      tags: focusedOnPlan,
    }),
    demoTrade(weekStart, "monday-loss-4", 0, 10, 44, 10, 51, {
      outcome: "LOSS",
      netPnl: -22,
      grossPnl: -18,
      initialRisk: 50,
      rMultiple: -0.44,
      tags: fomoUnplanned,
    }),
    demoTrade(weekStart, "tuesday-loss", 1, 11, 5, 11, 12, {
      outcome: "LOSS",
      netPnl: -35,
      grossPnl: -31,
      initialRisk: 35,
      rMultiple: -1,
      tags: calmOnPlan,
    }),
    demoTrade(weekStart, "tuesday-follow-up", 1, 11, 20, 11, 27, {
      instrument: "MES",
      outcome: "WIN",
      netPnl: 18,
      grossPnl: 22,
      initialRisk: 55,
      rMultiple: 0.33,
      tags: fomoUnplanned,
    }),
    demoTrade(weekStart, "tuesday-third", 1, 11, 42, 11, 49, {
      outcome: "LOSS",
      netPnl: -19,
      grossPnl: -15,
      initialRisk: 45,
      rMultiple: -0.42,
      tags: frustratedDeviated,
    }),
  ];
}
