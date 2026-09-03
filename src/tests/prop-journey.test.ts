import { describe, expect, it } from "vitest";
import type { ChallengeApiModel } from "@/lib/challenges/api-types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { calculatePropJourneyAnalytics } from "@/lib/prop-journey/analytics";

function challenge(
  id: string,
  overrides: Partial<ChallengeApiModel> = {},
): ChallengeApiModel {
  return {
    id,
    rulesPresetId: null,
    propFirm: "Test Prop",
    name: `Account ${id}`,
    status: "IN_PROGRESS",
    phase: "EVALUATION",
    drawdownType: "STATIC",
    dailyLossBreachType: "HARD",
    accountSize: 50000,
    startingBalance: 50000,
    currentBalance: 50000,
    highestEodBalance: 50000,
    todayPnl: 0,
    profitTarget: 3000,
    maxDrawdown: 2000,
    drawdownLockFloorOffset: 0,
    dailyLossLimit: 1000,
    challengeFee: 50,
    resetFee: 50,
    resetCount: 0,
    maxMiniContracts: 5,
    maxMicroContracts: 50,
    minimumTradingDays: 5,
    daysTraded: 0,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(
  id: string,
  input: Partial<LedgerEntryApiModel> & Pick<LedgerEntryApiModel, "entryType" | "category" | "amount">,
): LedgerEntryApiModel {
  return {
    id,
    challengeId: null,
    tradingAccountId: null,
    occurredAt: "2026-01-10T12:00:00.000Z",
    currency: "USD",
    provider: null,
    description: null,
    reference: null,
    notes: null,
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-01-10T12:00:00.000Z",
    ...input,
  };
}

describe("Prop Journey analytics", () => {
  it("uses real Ledger cash flow and never configured challenge fees", () => {
    const result = calculatePropJourneyAnalytics(
      [
        entry("fee", { challengeId: "one", entryType: "EXPENSE", category: "CHALLENGE_FEE", amount: 60 }),
        entry("reset", { challengeId: "one", entryType: "EXPENSE", category: "RESET_FEE", amount: 40 }),
        entry("payout", { challengeId: "one", entryType: "INCOME", category: "PAYOUT", amount: 250 }),
      ],
      [challenge("one", { challengeFee: 999 })],
    );

    const usd = result.byCurrency[0];
    expect(usd.totalCosts).toBe(100);
    expect(usd.totalPayouts).toBe(250);
    expect(usd.totalIncome).toBe(250);
    expect(usd.netJourneyPnl).toBe(150);
    expect(usd.recoveryPct).toBe(250);
    expect(usd.breakEvenReached).toBe(true);
  });

  it("separates refunds and other income from payouts", () => {
    const result = calculatePropJourneyAnalytics(
      [
        entry("cost", { entryType: "EXPENSE", category: "PLATFORM_FEE", amount: 100 }),
        entry("refund", { entryType: "INCOME", category: "REFUND", amount: 20 }),
        entry("other", { entryType: "INCOME", category: "OTHER_INCOME", amount: 10 }),
      ],
      [],
    ).byCurrency[0];

    expect(result.totalPayouts).toBe(0);
    expect(result.refunds).toBe(20);
    expect(result.otherIncome).toBe(10);
    expect(result.totalIncome).toBe(30);
    expect(result.netJourneyPnl).toBe(-70);
    expect(result.amountToBreakEven).toBe(70);
  });

  it("tracks the funnel from evaluation to funded payout account", () => {
    const result = calculatePropJourneyAnalytics(
      [
        entry("fee-a", { challengeId: "a", entryType: "EXPENSE", category: "CHALLENGE_FEE", amount: 50 }),
        entry("payout-c", { challengeId: "c", entryType: "INCOME", category: "PAYOUT", amount: 500 }),
      ],
      [
        challenge("a", { status: "NOT_STARTED" }),
        challenge("b", { status: "PASSED" }),
        challenge("c", { status: "FUNDED", phase: "FUNDED" }),
      ],
    ).byCurrency[0];

    expect(result.trackedChallenges).toBe(3);
    expect(result.evaluationsStarted).toBe(3);
    expect(result.passedEvaluations).toBe(2);
    expect(result.fundedReached).toBe(1);
    expect(result.payoutAccountCount).toBe(1);
  });

  it("keeps currencies separate instead of combining cash amounts", () => {
    const result = calculatePropJourneyAnalytics(
      [
        entry("usd", { entryType: "EXPENSE", category: "CHALLENGE_FEE", amount: 100, currency: "USD" }),
        entry("eur", { entryType: "EXPENSE", category: "CHALLENGE_FEE", amount: 80, currency: "EUR" }),
      ],
      [],
    );

    expect(result.currencies).toEqual(["EUR", "USD"]);
    expect(result.byCurrency.find((row) => row.currency === "USD")?.totalCosts).toBe(100);
    expect(result.byCurrency.find((row) => row.currency === "EUR")?.totalCosts).toBe(80);
  });

  it("groups linked and provider-only Ledger activity by prop firm", () => {
    const result = calculatePropJourneyAnalytics(
      [
        entry("linked", { challengeId: "one", entryType: "EXPENSE", category: "CHALLENGE_FEE", amount: 50 }),
        entry("provider", { entryType: "EXPENSE", category: "DATA_FEE", amount: 10, provider: "Test Prop" }),
      ],
      [challenge("one")],
    ).byCurrency[0];

    expect(result.firmBreakdown).toHaveLength(1);
    expect(result.firmBreakdown[0].firm).toBe("Test Prop");
    expect(result.firmBreakdown[0].costs).toBe(60);
  });
});
