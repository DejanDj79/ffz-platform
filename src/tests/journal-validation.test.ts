import { describe, expect, it } from "vitest";
import { tradeEditableSchema } from "@/lib/journal/validation";

const base = {
  challengeId: null,
  tradingAccountId: null,
  instrument: "MNQ" as const,
  direction: "LONG" as const,
  openedAt: "2026-09-02T08:00:00+02:00",
  closedAt: null,
  entryPrice: 20000,
  stopPrice: 19990,
  targetPrice: 20020,
  exitPrice: null,
  contracts: 1,
  commissionFees: 1.22,
  setup: "Opening range",
  tags: ["A+", "scalp", "A+"],
  notes: null,
};

describe("journal validation", () => {
  it("accepts open trade and deduplicates tags", () => {
    const parsed = tradeEditableSchema.parse(base);
    expect(parsed.tags).toEqual(["A+", "scalp"]);
  });

  it("requires closedAt when exitPrice exists", () => {
    expect(() => tradeEditableSchema.parse({ ...base, exitPrice: 20020 })).toThrow();
  });

  it("accepts a complete closed trade", () => {
    const parsed = tradeEditableSchema.parse({
      ...base,
      exitPrice: 20020,
      closedAt: "2026-09-02T08:20:00+02:00",
    });
    expect(parsed.exitPrice).toBe(20020);
  });
});
