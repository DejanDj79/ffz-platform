import { describe, expect, it } from "vitest";
import type { ChallengeApiModel } from "@/lib/challenges/api-types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { buildPublicJourneyData } from "@/lib/public-journey/data";

function challenge(
  id: string,
  overrides: Partial<ChallengeApiModel> = {},
): ChallengeApiModel {
  return {
    id,
    rulesPresetId: "private-preset",
    propFirm: "Test Prop",
    name: `Private Account ${id}`,
    status: "IN_PROGRESS",
    phase: "EVALUATION",
    drawdownType: "STATIC",
    dailyLossBreachType: "HARD",
    accountSize: 50000,
    startingBalance: 50000,
    currentBalance: 51000,
    highestEodBalance: 51000,
    todayPnl: 250,
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
    daysTraded: 2,
    notes: "private challenge note",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
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
    tradingAccountId: "private-trading-account-id",
    occurredAt: "2026-08-10T12:00:00.000Z",
    currency: "USD",
    provider: "Test Prop",
    description: "private description",
    reference: "private-order-reference",
    notes: "private ledger note",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
    ...input,
  };
}

describe("Public FFZ Journey", () => {
  it("publishes aggregate economics without raw account or ledger details", () => {
    const data = buildPublicJourneyData(
      [
        entry("private-fee-id", {
          challengeId: "private-challenge-id",
          entryType: "EXPENSE",
          category: "CHALLENGE_FEE",
          amount: 100,
        }),
        entry("private-payout-id", {
          challengeId: "private-challenge-id",
          entryType: "INCOME",
          category: "PAYOUT",
          amount: 350,
        }),
      ],
      [challenge("private-challenge-id")],
    );

    expect(data.displayName).toBe("Futures From Zero");
    expect(data.totalCosts).toBe(100);
    expect(data.totalPayouts).toBe(350);
    expect(data.netJourneyPnl).toBe(250);
    expect(data.currentAccount?.propFirm).toBe("Test Prop");
    expect(data.currentAccount?.pnl).toBe(1000);
    expect(data.currentAccount?.progressPct).toBeCloseTo(33.33, 2);

    const publicJson = JSON.stringify(data);
    expect(publicJson).not.toContain("private-challenge-id");
    expect(publicJson).not.toContain("Private Account");
    expect(publicJson).not.toContain("private challenge note");
    expect(publicJson).not.toContain("private-order-reference");
    expect(publicJson).not.toContain("private ledger note");
    expect(publicJson).not.toContain("private-trading-account-id");
  });

  it("uses the most recently updated active account as the current mission", () => {
    const data = buildPublicJourneyData(
      [],
      [
        challenge("old", {
          propFirm: "Old Firm",
          status: "FAILED",
          updatedAt: "2026-08-20T00:00:00.000Z",
        }),
        challenge("current", {
          propFirm: "Current Firm",
          status: "FUNDED",
          phase: "FUNDED",
          updatedAt: "2026-08-18T00:00:00.000Z",
        }),
      ],
    );

    expect(data.displayName).toBe("Futures From Zero");
    expect(data.currentAccount?.propFirm).toBe("Current Firm");
    expect(data.currentAccount?.status).toBe("FUNDED");
  });

  it("prefers USD for the public economics view when multiple currencies exist", () => {
    const data = buildPublicJourneyData(
      [
        entry("eur", {
          entryType: "EXPENSE",
          category: "CHALLENGE_FEE",
          amount: 80,
          currency: "EUR",
        }),
        entry("usd", {
          entryType: "EXPENSE",
          category: "CHALLENGE_FEE",
          amount: 100,
          currency: "USD",
        }),
      ],
      [],
    );

    expect(data.currency).toBe("USD");
    expect(data.totalCosts).toBe(100);
  });
});
