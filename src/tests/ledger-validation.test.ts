import { describe, expect, it } from "vitest";
import { ledgerEntrySchema } from "@/lib/ledger/validation";

const base = {
  challengeId: null,
  tradingAccountId: null,
  occurredAt: "2026-09-02T09:00:00+02:00",
  amount: 65,
  currency: "usd",
  provider: "Example Prop Firm",
  description: "Challenge purchase",
  reference: null,
  notes: null,
};

describe("ledger validation", () => {
  it("accepts an expense and normalizes currency", () => {
    const parsed = ledgerEntrySchema.parse({
      ...base,
      entryType: "EXPENSE",
      category: "CHALLENGE_FEE",
    });

    expect(parsed.currency).toBe("USD");
    expect(parsed.amount).toBe(65);
  });

  it("accepts payout as income", () => {
    const parsed = ledgerEntrySchema.parse({
      ...base,
      entryType: "INCOME",
      category: "PAYOUT",
      amount: 500,
    });

    expect(parsed.category).toBe("PAYOUT");
  });

  it("rejects payout as an expense", () => {
    expect(() =>
      ledgerEntrySchema.parse({
        ...base,
        entryType: "EXPENSE",
        category: "PAYOUT",
      }),
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() =>
      ledgerEntrySchema.parse({
        ...base,
        entryType: "EXPENSE",
        category: "CHALLENGE_FEE",
        amount: 0,
      }),
    ).toThrow();
  });
});
