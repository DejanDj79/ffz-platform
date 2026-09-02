import { describe, expect, it } from "vitest";
import {
  calculateJournalAnalytics,
  filterTradesForAnalytics,
  type JournalAnalyticsFilters,
} from "@/lib/journal/analytics";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(
  overrides: Partial<TradeApiModel> = {},
): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: "challenge-1",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-08-31T14:00:00.000Z",
    closedAt: "2026-08-31T14:05:00.000Z",
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
    setup: "ORB",
    tags: ["A+", "trend"],
    notes: null,
    createdAt: "2026-08-31T14:06:00.000Z",
    updatedAt: "2026-08-31T14:06:00.000Z",
    ...overrides,
  };
}

const allFilters: JournalAnalyticsFilters = {
  period: "ALL",
  instrument: "ALL",
  direction: "ALL",
  challengeId: "ALL",
};

describe("journal analytics", () => {
  it("calculates core performance and streak metrics", () => {
    const trades = [
      trade({ netPnl: 40, outcome: "WIN", rMultiple: 2 }),
      trade({
        openedAt: "2026-09-01T14:00:00.000Z",
        closedAt: "2026-09-01T14:05:00.000Z",
        netPnl: 60,
        outcome: "WIN",
        rMultiple: 3,
      }),
      trade({
        openedAt: "2026-09-02T14:00:00.000Z",
        closedAt: "2026-09-02T14:05:00.000Z",
        netPnl: -25,
        outcome: "LOSS",
        rMultiple: -1,
      }),
      trade({
        openedAt: "2026-09-02T15:00:00.000Z",
        closedAt: "2026-09-02T15:05:00.000Z",
        netPnl: -15,
        outcome: "LOSS",
        rMultiple: -0.75,
      }),
    ];

    const analytics = calculateJournalAnalytics(
      trades,
      allFilters,
      new Date("2026-09-02T18:00:00.000Z"),
    );

    expect(analytics.netPnl).toBe(60);
    expect(analytics.winRate).toBe(50);
    expect(analytics.profitFactor).toBe(2.5);
    expect(analytics.expectancy).toBe(15);
    expect(analytics.averageWin).toBe(50);
    expect(analytics.averageLoss).toBe(-20);
    expect(analytics.bestTrade).toBe(60);
    expect(analytics.worstTrade).toBe(-25);
    expect(analytics.maxWinStreak).toBe(2);
    expect(analytics.maxLossStreak).toBe(2);
    expect(analytics.equityCurve.at(-1)?.cumulativePnl).toBe(60);
    expect(analytics.dailyPnl).toHaveLength(3);
  });

  it("builds setup, tag and direction breakdowns", () => {
    const analytics = calculateJournalAnalytics(
      [
        trade(),
        trade({
          direction: "SHORT",
          setup: "Reversal",
          tags: ["A+"],
          netPnl: -20,
          outcome: "LOSS",
          rMultiple: -1,
        }),
      ],
      allFilters,
    );

    expect(analytics.bySetup.map((row) => row.label)).toEqual(
      expect.arrayContaining(["ORB", "Reversal"]),
    );
    expect(analytics.byTag.find((row) => row.label === "A+")?.trades).toBe(2);
    expect(analytics.byDirection.find((row) => row.label === "LONG")?.trades).toBe(1);
    expect(analytics.byDirection.find((row) => row.label === "SHORT")?.trades).toBe(1);
  });

  it("filters by recent period, instrument and challenge", () => {
    const trades = [
      trade({
        instrument: "MNQ",
        challengeId: "challenge-1",
        closedAt: "2026-09-01T12:00:00.000Z",
      }),
      trade({
        instrument: "MES",
        challengeId: null,
        closedAt: "2026-07-01T12:00:00.000Z",
      }),
    ];

    expect(
      filterTradesForAnalytics(
        trades,
        {
          period: "30D",
          instrument: "MNQ",
          direction: "ALL",
          challengeId: "challenge-1",
        },
        new Date("2026-09-02T12:00:00.000Z"),
      ),
    ).toHaveLength(1);

    expect(
      filterTradesForAnalytics(
        trades,
        {
          period: "ALL",
          instrument: "ALL",
          direction: "ALL",
          challengeId: "NONE",
        },
      ),
    ).toHaveLength(1);
  });
});
