import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRADING_GUARDRAILS,
  calculateDailyTradingStats,
  evaluateNewsGuardrails,
  evaluatePersonalGuardrails,
  marketMinuteOfDay,
  personalContractLimit,
} from "@/lib/trading/guardrails";
import type { EconomicCalendarEvent } from "@/lib/economic-calendar/types";
import type { TradeApiModel } from "@/lib/journal/types";
import type { PositionSizeResult } from "@/lib/trading/types";

function result(overrides: Partial<PositionSizeResult> = {}): PositionSizeResult {
  return {
    direction: "LONG",
    stopDistancePoints: 10,
    stopDistanceTicks: 40,
    marketRiskPerContract: 20,
    commissionAndFeesPerContract: 0,
    slippageBufferTicks: 0,
    slippageBufferPerContract: 0,
    totalCostBufferPerContract: 0,
    riskPerContract: 20,
    effectiveRiskBudget: 100,
    maxContracts: 1,
    actualRisk: 80,
    unusedRiskBudget: 20,
    rewardDistancePoints: 20,
    rewardRiskRatio: 2,
    drawdownUsagePct: 4,
    dailyLossUsagePct: 20,
    riskLevel: "LOW",
    warnings: [],
    ...overrides,
  };
}

function trade(overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-03T13:35:00.000Z",
    closedAt: "2026-09-03T13:40:00.000Z",
    entryPrice: 20000,
    stopPrice: 19990,
    targetPrice: 20020,
    exitPrice: 19990,
    contracts: 1,
    commissionFees: 0,
    grossPnl: -20,
    netPnl: -20,
    initialRisk: 20,
    rMultiple: -1,
    outcome: "LOSS",
    setup: "ORB",
    tags: [],
    notes: null,
    createdAt: "2026-09-03T13:40:00.000Z",
    updatedAt: "2026-09-03T13:40:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<EconomicCalendarEvent> = {}): EconomicCalendarEvent {
  return {
    id: "cpi",
    category: "macro",
    date: "2026-09-03T12:30:00.000Z",
    title: "CPI m/m",
    description: null,
    country: "US",
    currency: "USD",
    impact: "High",
    previous: null,
    forecast: null,
    actual: null,
    unit: null,
    ...overrides,
  };
}

describe("trading guardrails", () => {
  it("counts New York trading-day trades and closed losses", () => {
    const stats = calculateDailyTradingStats(
      [
        trade(),
        trade({ id: crypto.randomUUID(), outcome: "WIN", netPnl: 40 }),
        trade({
          id: crypto.randomUUID(),
          openedAt: "2026-09-02T13:35:00.000Z",
          closedAt: "2026-09-02T13:40:00.000Z",
        }),
      ],
      new Date("2026-09-03T15:00:00.000Z"),
    );

    expect(stats).toEqual({ trades: 2, losses: 1 });
  });

  it("blocks after the configured number of losing trades", () => {
    const checks = evaluatePersonalGuardrails({
      result: result(),
      settings: DEFAULT_TRADING_GUARDRAILS,
      dailyStats: { trades: 2, losses: 2 },
      now: new Date("2026-09-03T15:00:00.000Z"),
    });

    expect(checks.find((item) => item.code === "PERSONAL_DAILY_LOSSES")?.severity).toBe("BLOCKED");
  });

  it("warns when planned reward is below the personal minimum", () => {
    const settings = structuredClone(DEFAULT_TRADING_GUARDRAILS);
    settings.minRewardRisk.value = 1.5;

    const checks = evaluatePersonalGuardrails({
      result: result({ rewardRiskRatio: 1.2 }),
      settings,
      dailyStats: { trades: 0, losses: 0 },
    });

    expect(checks.find((item) => item.code === "PERSONAL_MIN_RR")?.severity).toBe("CAUTION");
  });

  it("uses the configured personal contract sizing cap", () => {
    expect(personalContractLimit(DEFAULT_TRADING_GUARDRAILS)).toBe(1);
  });

  it("blocks inside the wider major-release CPI window", () => {
    const checks = evaluateNewsGuardrails({
      instrument: "MNQ",
      events: [event()],
      settings: DEFAULT_TRADING_GUARDRAILS,
      now: new Date("2026-09-03T12:18:00.000Z"),
    });

    expect(checks).toHaveLength(1);
    expect(checks[0].severity).toBe("BLOCKED");
    expect(checks[0].reason).toContain("CPI");
  });

  it("ignores non-USD events for equity-index futures", () => {
    const checks = evaluateNewsGuardrails({
      instrument: "MES",
      events: [event({ currency: "EUR", country: null })],
      settings: DEFAULT_TRADING_GUARDRAILS,
      now: new Date("2026-09-03T12:30:00.000Z"),
    });

    expect(checks).toEqual([]);
  });

  it("returns caution when news protection cannot verify the calendar", () => {
    const checks = evaluateNewsGuardrails({
      instrument: "NQ",
      events: [],
      settings: DEFAULT_TRADING_GUARDRAILS,
      calendarAvailable: false,
    });

    expect(checks[0]?.code).toBe("NEWS_CALENDAR_UNAVAILABLE");
    expect(checks[0]?.severity).toBe("CAUTION");
  });

  it("converts market time with DST", () => {
    expect(marketMinuteOfDay("2026-01-15T14:30:00.000Z")).toBe(9 * 60 + 30);
    expect(marketMinuteOfDay("2026-07-15T13:30:00.000Z")).toBe(9 * 60 + 30);
  });
});
