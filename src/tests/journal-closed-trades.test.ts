import { describe, expect, it } from "vitest";
import { PLANNED_TRADE_TAG } from "@/lib/journal/planned";
import {
  journalTradeCreateSchema,
  tradeEditableSchema,
} from "@/lib/journal/validation";

const completedTrade = {
  challengeId: null,
  tradingAccountId: null,
  instrument: "MNQ" as const,
  direction: "LONG" as const,
  openedAt: "2026-09-07T13:30:00.000Z",
  closedAt: "2026-09-07T13:35:00.000Z",
  entryPrice: 20000,
  stopPrice: 19990,
  targetPrice: 20020,
  exitPrice: 20010,
  contracts: 1,
  commissionFees: 0,
  setup: null,
  tags: [],
  notes: null,
};

describe("completed-only Journal validation", () => {
  it("accepts a completed manual Journal trade", () => {
    expect(journalTradeCreateSchema.safeParse(completedTrade).success).toBe(true);
  });

  it("rejects an incomplete manual Journal trade", () => {
    const result = journalTradeCreateSchema.safeParse({
      ...completedTrade,
      closedAt: null,
      exitPrice: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["closedAt", "exitPrice"]),
      );
    }
  });

  it("does not let the internal planned tag bypass the completed-trade endpoint", () => {
    expect(journalTradeCreateSchema.safeParse({
      ...completedTrade,
      closedAt: null,
      exitPrice: null,
      tags: [PLANNED_TRADE_TAG],
    }).success).toBe(false);
  });

  it("keeps the generic editable schema compatible with pre-trade plans", () => {
    expect(tradeEditableSchema.safeParse({
      ...completedTrade,
      closedAt: null,
      exitPrice: null,
      tags: [PLANNED_TRADE_TAG],
    }).success).toBe(true);
  });
});
