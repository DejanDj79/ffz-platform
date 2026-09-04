import { describe, expect, it } from "vitest";
import {
  calculateTradeReviewPerformance,
  shiftTradeReviewPerformanceAnchor,
  tradeReviewPerformanceBounds,
} from "@/lib/journal/trade-review-performance";
import { selectTradeReviewTrades, tradeDurationMs } from "@/lib/journal/trade-review";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(
  id: string,
  overrides: Partial<TradeApiModel> = {},
): TradeApiModel {
  return {
    id,
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-04T13:30:00.000Z",
    closedAt: "2026-09-04T13:36:00.000Z",
    entryPrice: 24000,
    stopPrice: 23990,
    targetPrice: 24020,
    exitPrice: 24012,
    contracts: 1,
    commissionFees: 4,
    grossPnl: 24,
    netPnl: 20,
    initialRisk: 20,
    rMultiple: 1,
    outcome: "WIN",
    setup: "Opening range pullback",
    tags: [],
    notes: null,
    createdAt: "2026-09-04T13:36:00.000Z",
    updatedAt: "2026-09-04T13:36:00.000Z",
    ...overrides,
  };
}

function localIso(year: number, monthIndex: number, day: number, hour = 12) {
  return new Date(year, monthIndex, day, hour, 0, 0, 0).toISOString();
}

describe("trade review viewer helpers", () => {
  it("keeps only closed trades, applies instrument filter and sorts newest first", () => {
    const result = selectTradeReviewTrades(
      [
        trade("older", { openedAt: "2026-09-03T13:30:00.000Z" }),
        trade("open", { status: "OPEN", closedAt: null, exitPrice: null }),
        trade("mes", { instrument: "MES", openedAt: "2026-09-05T13:30:00.000Z" }),
        trade("newer", { openedAt: "2026-09-04T14:30:00.000Z" }),
      ],
      "MNQ",
    );

    expect(result.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("calculates closed-trade duration", () => {
    expect(tradeDurationMs(trade("duration"))).toBe(6 * 60 * 1000);
    expect(tradeDurationMs(trade("open", { closedAt: null, status: "OPEN" }))).toBeNull();
  });
});

describe("trade review performance", () => {
  it("calculates intraday cumulative pnl and period metrics", () => {
    const anchor = new Date(2026, 8, 4, 14);
    const result = calculateTradeReviewPerformance(
      [
        trade("win", {
          closedAt: localIso(2026, 8, 4, 10),
          netPnl: 100,
          grossPnl: 104,
          outcome: "WIN",
        }),
        trade("loss", {
          closedAt: localIso(2026, 8, 4, 11),
          netPnl: -50,
          grossPnl: -46,
          outcome: "LOSS",
        }),
        trade("tomorrow", {
          closedAt: localIso(2026, 8, 5, 10),
          netPnl: 400,
        }),
      ],
      "DAY",
      anchor,
    );

    expect(result.tradeCount).toBe(2);
    expect(result.netPnl).toBe(50);
    expect(result.profitFactor).toBe(2);
    expect(result.winRate).toBe(50);
    expect(result.points.map((point) => point.cumulativePnl)).toEqual([100, 50]);
  });

  it("damps FFZ score when a tiny sample produces an extreme profit factor", () => {
    const anchor = new Date(2026, 8, 4, 14);
    const result = calculateTradeReviewPerformance(
      [
        trade("win-a", {
          closedAt: localIso(2026, 8, 4, 10),
          netPnl: 60,
          outcome: "WIN",
          tags: ["FFZ:execution:on-plan", "FFZ:mindset:calm", "FFZ:planned"],
        }),
        trade("win-b", {
          closedAt: localIso(2026, 8, 4, 11),
          netPnl: 49,
          outcome: "WIN",
          tags: ["FFZ:execution:on-plan", "FFZ:mindset:focused", "FFZ:planned"],
        }),
        trade("tiny-loss", {
          closedAt: localIso(2026, 8, 4, 12),
          netPnl: -1,
          outcome: "LOSS",
          tags: ["FFZ:execution:deviated", "FFZ:mindset:fear"],
        }),
      ],
      "DAY",
      anchor,
    );

    expect(result.profitFactor).toBe(109);
    expect(result.ffzScore.status).toBe("PRELIMINARY");
    expect(result.ffzScore.confidence).toBe(0.3);
    expect(result.ffzScore.value).toBeLessThan(70);
    expect(result.ffzScore.breakdown?.performance).toBeGreaterThan(80);
  });

  it("uses Monday through Sunday for week periods and keeps zero-trade days", () => {
    const anchor = new Date(2026, 8, 9, 12);
    const result = calculateTradeReviewPerformance(
      [
        trade("monday", {
          closedAt: localIso(2026, 8, 7, 10),
          netPnl: 10,
        }),
        trade("wednesday", {
          closedAt: localIso(2026, 8, 9, 10),
          netPnl: -5,
          outcome: "LOSS",
        }),
        trade("next-week", {
          closedAt: localIso(2026, 8, 14, 10),
          netPnl: 20,
        }),
      ],
      "WEEK",
      anchor,
    );

    expect(result.points).toHaveLength(7);
    expect(result.tradeCount).toBe(2);
    expect(result.points[0].pnl).toBe(10);
    expect(result.points[1].pnl).toBe(0);
    expect(result.points[2].pnl).toBe(-5);
    expect(result.points.at(-1)?.cumulativePnl).toBe(5);
  });

  it("shifts periods without drifting calendar boundaries", () => {
    const anchor = new Date(2026, 8, 30, 12);
    const october = shiftTradeReviewPerformanceAnchor(anchor, "MONTH", 1);
    const { start, end } = tradeReviewPerformanceBounds("MONTH", october);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(1);
  });
});
