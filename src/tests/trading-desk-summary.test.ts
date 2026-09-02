import { describe, expect, it } from "vitest";
import {
  calculateDeskGuardrails,
  summarizeTradingDay,
} from "@/lib/trading-desk/summary";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: "challenge-1",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-02T10:00:00",
    closedAt: "2026-09-02T10:05:00",
    entryPrice: 20000,
    stopPrice: 19990,
    targetPrice: 20020,
    exitPrice: 20020,
    contracts: 1,
    commissionFees: 0,
    grossPnl: 50,
    netPnl: 50,
    initialRisk: 20,
    rMultiple: 2.5,
    outcome: "WIN",
    setup: null,
    tags: [],
    notes: null,
    createdAt: "2026-09-02T10:06:00",
    updatedAt: "2026-09-02T10:06:00",
    ...overrides,
  };
}

describe("Daily Trading Desk summary", () => {
  it("aggregates only today's trades for the selected challenge", () => {
    const now = new Date("2026-09-02T15:00:00");
    const summary = summarizeTradingDay([
      trade(),
      trade({ netPnl: -100, grossPnl: -100, outcome: "LOSS" }),
      trade({ netPnl: -80, grossPnl: -80, outcome: "LOSS" }),
      trade({ challengeId: "challenge-2", netPnl: 500, grossPnl: 500 }),
      trade({ openedAt: "2026-09-01T10:00:00", closedAt: "2026-09-01T10:05:00" }),
    ], now, "challenge-1");

    expect(summary.totalTrades).toBe(3);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(2);
    expect(summary.netPnl).toBe(-130);
    expect(summary.grossLoss).toBe(180);
  });

  it("moves to caution with one planned losing trade remaining", () => {
    const now = new Date("2026-09-02T15:00:00");
    const summary = summarizeTradingDay([
      trade({ netPnl: -100, grossPnl: -100, outcome: "LOSS" }),
      trade({ netPnl: -80, grossPnl: -80, outcome: "LOSS" }),
    ], now, "challenge-1");

    const guardrails = calculateDeskGuardrails({
      summary,
      maxRiskPerTrade: 100,
      maxLosingTrades: 3,
      challengeRemainingDrawdown: 1000,
      challengeRemainingDailyLoss: null,
    });

    expect(guardrails.status).toBe("CAUTION");
    expect(guardrails.remainingLossSlots).toBe(1);
    expect(guardrails.grossLossRemaining).toBe(120);
  });

  it("stops the session after the losing-trade limit is reached", () => {
    const now = new Date("2026-09-02T15:00:00");
    const summary = summarizeTradingDay([
      trade({ netPnl: -90, grossPnl: -90, outcome: "LOSS" }),
      trade({ netPnl: -100, grossPnl: -100, outcome: "LOSS" }),
      trade({ netPnl: -95, grossPnl: -95, outcome: "LOSS" }),
    ], now, "challenge-1");

    const guardrails = calculateDeskGuardrails({
      summary,
      maxRiskPerTrade: 100,
      maxLosingTrades: 3,
      challengeRemainingDrawdown: 1000,
      challengeRemainingDailyLoss: null,
    });

    expect(guardrails.status).toBe("STOP");
    expect(guardrails.remainingLossSlots).toBe(0);
  });
});
