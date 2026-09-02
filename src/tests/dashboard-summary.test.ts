import { describe, expect, it } from "vitest";
import {
  calculateDashboardSummary,
  calculatePerformanceSummary,
  selectPrimaryChallenge,
} from "@/lib/dashboard/summary";
import type { Challenge } from "@/lib/challenges/types";
import type { TradeApiModel } from "@/lib/journal/types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";

function challenge(
  overrides: Partial<Challenge> = {},
): Challenge {
  return {
    id: crypto.randomUUID(),
    propFirm: "Test Firm",
    name: "25K Test",
    accountSize: 25000,
    startingBalance: 25000,
    profitTarget: 1500,
    maxDrawdown: 1500,
    dailyLossLimit: 0,
    challengeFee: 0,
    resetFee: 0,
    resetsUsed: 0,
    minimumTradingDays: 0,
    currentBalance: 25500,
    todayPnl: 0,
    daysTraded: 1,
    status: "IN_PROGRESS",
    phase: "EVALUATION",
    notes: "",
    createdAt: "2026-09-02T08:00:00.000Z",
    updatedAt: "2026-09-02T08:00:00.000Z",
    drawdownMode: "STATIC",
    highestEodBalance: 25500,
    drawdownLockFloorOffset: 0,
    maxMinis: 1,
    maxMicros: 10,
    ...overrides,
  };
}

function trade(
  overrides: Partial<TradeApiModel> = {},
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

const ledger: LedgerEntryApiModel = {
  id: crypto.randomUUID(),
  challengeId: null,
  tradingAccountId: null,
  entryType: "EXPENSE",
  category: "CHALLENGE_FEE",
  occurredAt: "2026-09-02T08:00:00.000Z",
  amount: 65,
  currency: "USD",
  provider: null,
  description: null,
  reference: null,
  notes: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
};

describe("dashboard summary", () => {
  it("prefers an in-progress challenge", () => {
    const primary = selectPrimaryChallenge([
      challenge({ status: "NOT_STARTED", name: "Waiting" }),
      challenge({ status: "IN_PROGRESS", name: "Running" }),
    ]);

    expect(primary?.name).toBe("Running");
  });

  it("aggregates challenge, journal, ledger and risk data", () => {
    const summary = calculateDashboardSummary(
      [challenge()],
      [trade()],
      [ledger],
      new Date("2026-09-02T12:00:00.000Z"),
    );

    expect(summary.challenge.pnl).toBe(500);
    expect(summary.challenge.targetRemaining).toBe(1000);
    expect(summary.challenge.targetProgressPct).toBeCloseTo(33.333, 2);
    expect(summary.challenge.drawdownFloor).toBe(23500);
    expect(summary.challenge.remainingDrawdown).toBe(2000);
    expect(summary.challenge.health).toBe("SAFE");
    expect(summary.journal.netPnl).toBe(40);
    expect(summary.journal.winRate).toBe(100);
    expect(summary.ledger.totalExpenses).toBe(65);
    expect(summary.ledger.netCashFlow).toBe(-65);
    expect(summary.performance.todayPnl).toBe(40);
    expect(summary.performance.monthPnl).toBe(40);
  });

  it("calculates trading performance metrics and cumulative equity", () => {
    const performance = calculatePerformanceSummary(
      [
        trade({ netPnl: 100, outcome: "WIN", closedAt: "2026-09-01T10:00:00.000Z" }),
        trade({ netPnl: -50, outcome: "LOSS", closedAt: "2026-09-02T10:00:00.000Z" }),
        trade({ netPnl: 150, outcome: "WIN", closedAt: "2026-09-02T11:00:00.000Z" }),
      ],
      new Date("2026-09-02T12:00:00.000Z"),
    );

    expect(performance.todayPnl).toBe(100);
    expect(performance.monthPnl).toBe(200);
    expect(performance.averageWin).toBe(125);
    expect(performance.averageLoss).toBe(-50);
    expect(performance.expectancy).toBeCloseTo(66.67, 2);
    expect(performance.bestTrade).toBe(150);
    expect(performance.worstTrade).toBe(-50);
    expect(performance.equityCurve.map((point) => point.value)).toEqual([100, 50, 200]);
  });
});
