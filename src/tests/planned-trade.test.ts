import { describe, expect, it } from "vitest";
import {
  isPlannedTrade,
  PLANNED_TRADE_TAG,
  STARTED_FROM_PLAN_TAG,
  withoutPlannedTradeTag,
} from "@/lib/journal/planned";

describe("planned trade markers", () => {
  it("identifies pre-trade plans by the internal marker", () => {
    expect(isPlannedTrade({ tags: [PLANNED_TRADE_TAG, "A+"] })).toBe(true);
    expect(isPlannedTrade({ tags: ["A+"] })).toBe(false);
  });

  it("removes only the internal pre-trade marker when a result is logged", () => {
    const tags = [PLANNED_TRADE_TAG, "A+", STARTED_FROM_PLAN_TAG];

    expect(withoutPlannedTradeTag(tags)).toEqual(["A+", STARTED_FROM_PLAN_TAG]);
    expect(tags).toEqual([PLANNED_TRADE_TAG, "A+", STARTED_FROM_PLAN_TAG]);
  });
});
