import { describe, expect, it } from "vitest";
import { calculateLedgerStats } from "@/lib/ledger/stats";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";

function entry(
  overrides: Partial<LedgerEntryApiModel>,
): LedgerEntryApiModel {
  return {
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
    ...overrides,
  };
}

describe("real money ledger stats", () => {
  it("calculates cash flow and challenge costs", () => {
    const stats = calculateLedgerStats([
      entry({
        entryType: "EXPENSE",
        category: "CHALLENGE_FEE",
        amount: 65,
      }),
      entry({
        entryType: "EXPENSE",
        category: "RESET_FEE",
        amount: 50,
      }),
      entry({
        entryType: "INCOME",
        category: "PAYOUT",
        amount: 500,
      }),
    ]);

    expect(stats.totalExpenses).toBe(115);
    expect(stats.totalIncome).toBe(500);
    expect(stats.netCashFlow).toBe(385);
    expect(stats.challengeCosts).toBe(115);
    expect(stats.payouts).toBe(500);
    expect(stats.entryCount).toBe(3);
  });
});
