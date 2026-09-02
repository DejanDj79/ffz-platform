import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  categoriesForType,
} from "@/lib/ledger/presentation";

describe("ledger presentation", () => {
  it("returns only expense categories for expenses", () => {
    const values = categoriesForType("EXPENSE");

    expect(values).toContain("CHALLENGE_FEE");
    expect(values).toContain("RESET_FEE");
    expect(values).not.toContain("PAYOUT");
  });

  it("returns only income categories for income", () => {
    const values = categoriesForType("INCOME");

    expect(values).toContain("PAYOUT");
    expect(values).toContain("REFUND");
    expect(values).not.toContain("CHALLENGE_FEE");
  });

  it("has a human-readable label for payout", () => {
    expect(CATEGORY_LABELS.PAYOUT).toBe("Payout");
  });
});
