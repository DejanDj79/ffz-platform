import { describe, expect, it } from "vitest";
import {
  calculateFundedPayoutSummary,
  createFundedAccountFromEvaluation,
  effectiveChallengeAfterPayouts,
} from "@/lib/challenges/funded";
import type { Challenge } from "@/lib/challenges/types";
import type { TradeApiModel } from "@/lib/journal/types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";

function fundedChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    propFirm: "Blue Guardian Futures",
    name: "Standard 25K — Funded",
    accountSize: 25_000,
    startingBalance: 25_000,
    profitTarget: 0,
    maxDrawdown: 1_500,
    dailyLossLimit: 0,
    challengeFee: 0,
    resetFee: 0,
    resetsUsed: 0,
    minimumTradingDays: 0,
    currentBalance: 27_000,
    todayPnl: 0,
    daysTraded: 0,
    status: "FUNDED",
    phase: "FUNDED",
    notes: "",
    createdAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
    drawdownMode: "EOD_TRAILING",
    highestEodBalance: 27_000,
    drawdownLockFloorOffset: 0,
    dailyLossBreachType: "NONE",
    maxMinis: 1,
    maxMicros: 10,
    ...overrides,
  };
}

function trade(
  id: string,
  closedAt: string,
  netPnl: number,
): TradeApiModel {
  return {
    id,
    challengeId: "11111111-1111-4111-8111-111111111111",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: closedAt,
    closedAt,
    entryPrice: 20_000,
    stopPrice: null,
    targetPrice: null,
    exitPrice: 20_010,
    contracts: 1,
    commissionFees: 0,
    grossPnl: netPnl,
    netPnl,
    initialRisk: null,
    rMultiple: null,
    outcome: netPnl > 0 ? "WIN" : netPnl < 0 ? "LOSS" : "BREAKEVEN",
    setup: null,
    tags: [],
    notes: null,
    createdAt: closedAt,
    updatedAt: closedAt,
  };
}

function payout(amount: number, occurredAt = "2026-09-05T20:00:00Z"): LedgerEntryApiModel {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    challengeId: "11111111-1111-4111-8111-111111111111",
    tradingAccountId: null,
    entryType: "INCOME",
    category: "PAYOUT",
    occurredAt,
    amount,
    currency: "USD",
    provider: "Blue Guardian Futures",
    description: "Payout",
    reference: null,
    notes: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

describe("funded payout readiness", () => {
  it("becomes payout eligible after the configured days, buffer and consistency gates", () => {
    const summary = calculateFundedPayoutSummary(
      fundedChallenge(),
      [
        trade("t1", "2026-09-01T15:00:00Z", 600),
        trade("t2", "2026-09-02T15:00:00Z", 700),
        trade("t3", "2026-09-03T15:00:00Z", 700),
      ],
      [],
    );

    expect(summary.tradingDays).toBe(3);
    expect(summary.cycleNetPnl).toBe(2_000);
    expect(summary.consistencyPct).toBe(35);
    expect(summary.consistencyOk).toBe(true);
    expect(summary.bufferBalance).toBe(26_600);
    expect(summary.grossPayoutAvailable).toBe(400);
    expect(summary.estimatedTraderPayout).toBe(360);
    expect(summary.eligible).toBe(true);
  });

  it("uses the later payout cap and post-payout drawdown floor after a linked payout", () => {
    const challenge = fundedChallenge({ currentBalance: 28_100 });
    const ledger = [payout(1_350)];
    const effective = effectiveChallengeAfterPayouts(challenge, ledger);

    expect(effective.drawdownLockFloorOffset).toBe(100);

    const summary = calculateFundedPayoutSummary(
      challenge,
      [
        trade("before", "2026-09-04T15:00:00Z", 1_500),
        trade("after-1", "2026-09-08T15:00:00Z", 800),
        trade("after-2", "2026-09-09T15:00:00Z", 700),
        trade("after-3", "2026-09-10T15:00:00Z", 600),
      ],
      ledger,
    );

    expect(summary.payoutCount).toBe(1);
    expect(summary.cycleTrades).toBe(3);
    expect(summary.payoutCap).toBe(2_000);
    expect(summary.estimatedGrossWithdrawn).toBe(1_500);
  });

  it("creates a clean funded account record without charging the evaluation fee twice", () => {
    const evaluation = fundedChallenge({
      name: "Standard 25K #1",
      status: "PASSED",
      phase: "EVALUATION",
      profitTarget: 1_500,
      challengeFee: 99,
      resetFee: 104,
      resetsUsed: 1,
      currentBalance: 26_500,
    });

    const funded = createFundedAccountFromEvaluation(evaluation);

    expect(funded.status).toBe("FUNDED");
    expect(funded.phase).toBe("FUNDED");
    expect(funded.startingBalance).toBe(25_000);
    expect(funded.currentBalance).toBe(25_000);
    expect(funded.profitTarget).toBe(0);
    expect(funded.challengeFee).toBe(0);
    expect(funded.resetFee).toBe(0);
    expect(funded.resetsUsed).toBe(0);
    expect(funded.name).toContain("Funded");
  });
});
