import { describe, expect, it } from "vitest";
import {
  buildStartedTradeUpdate,
  PLANNED_TRADE_TAG,
  STARTED_FROM_PLAN_TAG,
} from "@/lib/journal/planned";
import type { TradeApiModel } from "@/lib/journal/types";

function plannedTrade(): TradeApiModel {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    challengeId: "22222222-2222-4222-8222-222222222222",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "OPEN",
    openedAt: "2026-09-03T00:00:00.000Z",
    closedAt: null,
    entryPrice: 18950.25,
    stopPrice: 18930.25,
    targetPrice: 18990.25,
    exitPrice: null,
    contracts: 2,
    commissionFees: 4.5,
    grossPnl: null,
    netPnl: null,
    initialRisk: 80,
    rMultiple: null,
    outcome: null,
    setup: "Opening range",
    tags: [PLANNED_TRADE_TAG, "A+"],
    notes: "FFZ PRE-TRADE PLAN",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
  };
}

describe("buildStartedTradeUpdate", () => {
  it("preserves stop, target and planned provenance when a planned trade is started", () => {
    const update = buildStartedTradeUpdate(
      plannedTrade(),
      "2026-09-03T01:00:00.000Z",
      "Trade started from FFZ plan.",
    );

    expect(update.entryPrice).toBe(18950.25);
    expect(update.stopPrice).toBe(18930.25);
    expect(update.targetPrice).toBe(18990.25);
    expect(update.contracts).toBe(2);
    expect(update.commissionFees).toBe(4.5);
    expect(update.tags).toEqual(["A+", STARTED_FROM_PLAN_TAG]);
    expect(update.openedAt).toBe("2026-09-03T01:00:00.000Z");
  });

  it("does not duplicate planned provenance if a plan already carries it", () => {
    const plan = plannedTrade();
    plan.tags.push(STARTED_FROM_PLAN_TAG);

    const update = buildStartedTradeUpdate(
      plan,
      "2026-09-03T01:00:00.000Z",
      "Trade started from FFZ plan.",
    );

    expect(update.tags).toEqual(["A+", STARTED_FROM_PLAN_TAG]);
  });
});
