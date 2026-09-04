import { describe, expect, it } from "vitest";
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
