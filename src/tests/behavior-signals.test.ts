import { describe, expect, it } from "vitest";
import { applyDisciplineReview } from "@/lib/journal/discipline";
import { calculateWeeklyBehaviorSignals } from "@/lib/journal/behavior-signals";
import type { TradeApiModel } from "@/lib/journal/types";
import type { TradingGuardrailSettings } from "@/lib/trading/guardrails-types";

function trade(id: string, overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id,
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: new Date(2026, 8, 7, 10, 0).toISOString(),
    closedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    entryPrice: 24000,
    stopPrice: 23990,
    targetPrice: 24020,
    exitPrice: 24010,
    contracts: 1,
    commissionFees: 4,
    grossPnl: 24,
    netPnl: 20,
    initialRisk: 20,
    rMultiple: 1,
    outcome: "WIN",
    setup: "ORB Pullback",
    tags: [],
    notes: null,
    createdAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    updatedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    ...overrides,
  };
}

function guardrails(overrides: Partial<TradingGuardrailSettings> = {}): TradingGuardrailSettings {
  return {
    maxRiskPerTrade: { enabled: false, value: 100, severity: "CAUTION" },
    maxDailyLosses: { enabled: false, value: 3, severity: "CAUTION" },
    maxTradesPerDay: { enabled: false, value: 5, severity: "CAUTION" },
    maxContracts: { enabled: false, value: 1 },
    minRewardRisk: { enabled: false, value: 1, severity: "CAUTION" },
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
    ...overrides,
  };
}

function signal(
  signals: ReturnType<typeof calculateWeeklyBehaviorSignals>,
  key: Parameters<typeof signals.find>[0] extends never ? never : string,
) {
  return signals.find((item) => item.key === key);
}

describe("objective behavior signals", () => {
  it("detects rapid re-entry and explicit plan breakdown without inferring Revenge", () => {
    const lossTags = applyDisciplineReview([], { execution: "ON_PLAN", mindset: "CALM" });
    const followUpTags = applyDisciplineReview([], { execution: "UNPLANNED", mindset: "FOMO" });
    const trades = [
      trade("loss", {
        openedAt: new Date(2026, 8, 7, 10, 0).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
        outcome: "LOSS",
        netPnl: -40,
        initialRisk: 40,
        tags: lossTags,
      }),
      trade("follow-up", {
        openedAt: new Date(2026, 8, 7, 10, 12).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 18).toISOString(),
        outcome: "LOSS",
        netPnl: -20,
        initialRisk: 40,
        tags: followUpTags,
      }),
    ];

    const signals = calculateWeeklyBehaviorSignals(trades);
    expect(signal(signals, "RAPID_REENTRY")?.value).toBe("1");
    expect(signal(signals, "PLAN_BREAKDOWN")?.value).toBe("1");
    expect(signal(signals, "MINDSET_SHIFT")?.value).toBe("1");
    expect(signal(signals, "RAPID_REENTRY")?.events[0].trades[1].mindset).toBe("FOMO");
    expect(signal(signals, "RAPID_REENTRY")?.summary.toLowerCase()).not.toContain("revenge");
  });

  it("detects post-loss activity and consecutive loss streaks", () => {
    const trades = [
      trade("loss-1", { outcome: "LOSS", netPnl: -30 }),
      trade("loss-2", {
        openedAt: new Date(2026, 8, 7, 10, 20).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 25).toISOString(),
        outcome: "LOSS",
        netPnl: -20,
      }),
      trade("loss-3", {
        openedAt: new Date(2026, 8, 7, 10, 40).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 45).toISOString(),
        outcome: "LOSS",
        netPnl: -10,
      }),
      trade("win", {
        openedAt: new Date(2026, 8, 7, 11, 0).toISOString(),
        closedAt: new Date(2026, 8, 7, 11, 5).toISOString(),
        outcome: "WIN",
        netPnl: 50,
      }),
    ];

    const signals = calculateWeeklyBehaviorSignals(trades);
    expect(signal(signals, "POST_LOSS_ACTIVITY")?.value).toBe("1");
    expect(signal(signals, "POST_LOSS_ACTIVITY")?.events[0].trades).toHaveLength(4);
    expect(signal(signals, "LOSS_STREAK")?.value).toBe("3");
    expect(signal(signals, "LOSS_STREAK")?.tone).toBe("warning");
  });

  it("uses enabled guardrails for overtrading and daily loss-count signals", () => {
    const settings = guardrails({
      maxTradesPerDay: { enabled: true, value: 3, severity: "CAUTION" },
      maxDailyLosses: { enabled: true, value: 2, severity: "CAUTION" },
    });
    const trades = [
      trade("one", { outcome: "LOSS", netPnl: -20 }),
      trade("two", {
        openedAt: new Date(2026, 8, 7, 10, 20).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 25).toISOString(),
        outcome: "LOSS",
        netPnl: -20,
      }),
      trade("three", {
        openedAt: new Date(2026, 8, 7, 10, 40).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 45).toISOString(),
      }),
      trade("four", {
        openedAt: new Date(2026, 8, 7, 11, 0).toISOString(),
        closedAt: new Date(2026, 8, 7, 11, 5).toISOString(),
      }),
    ];

    const signals = calculateWeeklyBehaviorSignals(trades, settings);
    expect(signal(signals, "OVERTRADING")?.value).toBe("1");
    expect(signal(signals, "OVERTRADING")?.events[0].detail).toContain("3");
    expect(signal(signals, "DAILY_LOSS_COUNT")?.value).toBe("1");
    expect(signal(signals, "DAILY_LOSS_COUNT")?.tone).toBe("warning");
  });

  it("does not claim guardrail breaches when those guardrails are disabled", () => {
    const signals = calculateWeeklyBehaviorSignals([trade("one")], guardrails());

    expect(signal(signals, "OVERTRADING")?.value).toBe("—");
    expect(signal(signals, "OVERTRADING")?.tone).toBe("unavailable");
    expect(signal(signals, "DAILY_LOSS_COUNT")?.value).toBe("—");
    expect(signal(signals, "DAILY_LOSS_COUNT")?.tone).toBe("unavailable");
  });

  it("detects risk escalation only from recorded higher initial risk after a loss", () => {
    const trades = [
      trade("loss", {
        outcome: "LOSS",
        netPnl: -30,
        initialRisk: 50,
      }),
      trade("bigger-risk", {
        openedAt: new Date(2026, 8, 7, 10, 15).toISOString(),
        closedAt: new Date(2026, 8, 7, 10, 20).toISOString(),
        initialRisk: 80,
      }),
      trade("later-loss", {
        openedAt: new Date(2026, 8, 7, 11, 0).toISOString(),
        closedAt: new Date(2026, 8, 7, 11, 5).toISOString(),
        outcome: "LOSS",
        netPnl: -15,
        initialRisk: null,
      }),
      trade("unknown-risk", {
        openedAt: new Date(2026, 8, 7, 11, 20).toISOString(),
        closedAt: new Date(2026, 8, 7, 11, 25).toISOString(),
        initialRisk: 100,
      }),
    ];

    const signals = calculateWeeklyBehaviorSignals(trades);
    expect(signal(signals, "RISK_ESCALATION")?.value).toBe("1");
    expect(signal(signals, "RISK_ESCALATION")?.events).toHaveLength(1);
    expect(signal(signals, "RISK_ESCALATION")?.summary).toContain("+$30.00");
  });
});
