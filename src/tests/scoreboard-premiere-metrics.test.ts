import { describe, expect, it } from "vitest";
import {
  buildMonthlyScoreboardCalendar,
  calculateJourneyDay,
  calculateScoreboardPerformance,
} from "@/lib/scoreboard/metrics";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(
  overrides: Partial<TradeApiModel> = {},
): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: "00000000-0000-4000-8000-000000000001",
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

describe("Premiere scoreboard metrics", () => {
  it("calculates best, worst and average wins/losses", () => {
    const result = calculateScoreboardPerformance([
      trade({ netPnl: 100 }),
      trade({ netPnl: 50 }),
      trade({ netPnl: -25, outcome: "LOSS" }),
      trade({ netPnl: -75, outcome: "LOSS" }),
    ]);

    expect(result.bestTrade).toBe(100);
    expect(result.worstTrade).toBe(-75);
    expect(result.averageWin).toBe(75);
    expect(result.averageLoss).toBe(-50);
  });

  it("builds current-month daily result cells", () => {
    const result = buildMonthlyScoreboardCalendar(
      [
        trade({
          openedAt: "2026-09-02T08:00:00.000Z",
          netPnl: 40,
        }),
        trade({
          openedAt: "2026-09-03T08:00:00.000Z",
          netPnl: -20,
          outcome: "LOSS",
        }),
      ],
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(result.label).toBe("SEPTEMBER 2026");
    expect(result.days[1].status).toBe("PROFIT");
    expect(result.days[2].status).toBe("LOSS");
    expect(result.days[3].status).toBe("NO_TRADE");
    expect(result.days[5].status).toBe("FUTURE");
    expect(result.days[30].status).toBe("OUTSIDE_MONTH");
  });

  it("calculates journey day from season start", () => {
    expect(
      calculateJourneyDay(
        "2026-08-30T00:00:00.000Z",
        new Date("2026-09-02T10:00:00.000Z"),
      ),
    ).toBe(4);
  });
});
