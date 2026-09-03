import { describe, expect, it } from "vitest";
import {
  ALL_SETUPS,
  calculateSetupTimeOfDayBreakdown,
  filterTradesBySetup,
  setupOptionsFromTrades,
} from "@/lib/journal/setup-analytics";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: "challenge-1",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-02T13:35:00.000Z",
    closedAt: "2026-09-02T13:40:00.000Z",
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
    tags: [],
    notes: null,
    createdAt: "2026-09-02T13:41:00.000Z",
    updatedAt: "2026-09-02T13:41:00.000Z",
    ...overrides,
  };
}

describe("setup analytics", () => {
  it("builds setup options and filters one playbook", () => {
    const trades = [
      trade({ setup: "ORB" }),
      trade({ setup: "IVB" }),
      trade({ setup: null }),
    ];

    expect(setupOptionsFromTrades(trades)).toEqual(["IVB", "ORB", "NO SETUP"]);
    expect(filterTradesBySetup(trades, "ORB")).toHaveLength(1);
    expect(filterTradesBySetup(trades, ALL_SETUPS)).toHaveLength(3);
  });

  it("groups setup performance by New York entry time", () => {
    const rows = calculateSetupTimeOfDayBreakdown([
      trade({
        openedAt: "2026-09-02T13:35:00.000Z",
        netPnl: 40,
        outcome: "WIN",
        rMultiple: 2,
      }),
      trade({
        openedAt: "2026-09-02T14:15:00.000Z",
        netPnl: -20,
        outcome: "LOSS",
        rMultiple: -1,
      }),
      trade({
        openedAt: "2026-09-02T18:30:00.000Z",
        netPnl: 30,
        outcome: "WIN",
        rMultiple: 1.5,
      }),
    ]);

    expect(rows.map((row) => row.label)).toEqual([
      "09:30–10:00 ET",
      "10:00–11:30 ET",
      "14:00–16:00 ET",
    ]);
    expect(rows[0].netPnl).toBe(40);
    expect(rows[1].winRate).toBe(0);
    expect(rows[2].averageR).toBe(1.5);
  });

  it("uses DST-aware New York time instead of a fixed UTC offset", () => {
    const winter = calculateSetupTimeOfDayBreakdown([
      trade({
        openedAt: "2026-01-15T14:35:00.000Z",
        closedAt: "2026-01-15T14:40:00.000Z",
      }),
    ]);

    const summer = calculateSetupTimeOfDayBreakdown([
      trade({
        openedAt: "2026-07-15T13:35:00.000Z",
        closedAt: "2026-07-15T13:40:00.000Z",
      }),
    ]);

    expect(winter[0].label).toBe("09:30–10:00 ET");
    expect(summer[0].label).toBe("09:30–10:00 ET");
  });
});
