import { describe, expect, it } from "vitest";
import { calculateJournalStats } from "@/lib/journal/stats";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(
  overrides: Partial<TradeApiModel>,
): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-02T08:00:00.000Z",
    closedAt: "2026-09-02T08:10:00.000Z",
    entryPrice: 20000,
    stopPrice: 19990,
    targetPrice: 20020,
    exitPrice: 20020,
    contracts: 1,
    commissionFees: 0,
    grossPnl: 40,
    netPnl: 40,
    initialRisk: 20,
    rMultiple: 2,
    outcome: "WIN",
    setup: null,
    tags: [],
    notes: null,
    createdAt: "2026-09-02T08:11:00.000Z",
    updatedAt: "2026-09-02T08:11:00.000Z",
    ...overrides,
  };
}

describe("journal stats", () => {
  it("calculates core Journal summary metrics", () => {
    const stats = calculateJournalStats([
      trade({ netPnl: 100, rMultiple: 2, outcome: "WIN" }),
      trade({ netPnl: -50, rMultiple: -1, outcome: "LOSS" }),
      trade({
        status: "OPEN",
        closedAt: null,
        exitPrice: null,
        netPnl: null,
        grossPnl: null,
        rMultiple: null,
        outcome: null,
      }),
    ]);

    expect(stats.totalTrades).toBe(3);
    expect(stats.closedTrades).toBe(2);
    expect(stats.openTrades).toBe(1);
    expect(stats.netPnl).toBe(50);
    expect(stats.winRate).toBe(50);
    expect(stats.averageR).toBe(0.5);
    expect(stats.profitFactor).toBe(2);
  });

  it("returns infinite profit factor with wins and no losses", () => {
    const stats = calculateJournalStats([
      trade({ netPnl: 25, outcome: "WIN" }),
    ]);

    expect(stats.profitFactor).toBe(Infinity);
  });
});
