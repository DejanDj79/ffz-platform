import { describe, expect, it } from "vitest";
import { applyDisciplineReview } from "@/lib/journal/discipline";
import { STARTED_FROM_PLAN_TAG } from "@/lib/journal/planned";
import { calculateWeeklyReview, shiftWeeklyReviewAnchor } from "@/lib/journal/weekly-review";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(id: string, overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id,
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: new Date(2026, 8, 7, 10, 0).toISOString(),
    closedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    entryPrice: 24000,
    stopPrice: 23990,
    targetPrice: 24020,
    exitPrice: 24010,
    contracts: 1,
    commissionFees: 4,
    grossPnl: 24,
    netPnl: 20,
    initialRisk: 20,
    rMultiple: 1,
    outcome: "WIN",
    setup: "ORB Pullback",
    tags: [],
    notes: null,
    createdAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    updatedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
    ...overrides,
  };
}

describe("weekly review", () => {
  it("uses Monday through Sunday and reuses the weekly FFZ performance score", () => {
    const anchor = new Date(2026, 8, 9, 12);
    const review = calculateWeeklyReview(
      [
        trade("monday", { netPnl: 100, outcome: "WIN" }),
        trade("friday", {
          openedAt: new Date(2026, 8, 11, 11, 0).toISOString(),
          closedAt: new Date(2026, 8, 11, 11, 5).toISOString(),
          netPnl: -40,
          outcome: "LOSS",
          rMultiple: -1,
        }),
        trade("next-week", {
          openedAt: new Date(2026, 8, 14, 10, 0).toISOString(),
          closedAt: new Date(2026, 8, 14, 10, 5).toISOString(),
          netPnl: 500,
        }),
      ],
      anchor,
    );

    expect(review.start.getDay()).toBe(1);
    expect(review.dailyPoints).toHaveLength(7);
    expect(review.tradeCount).toBe(2);
    expect(review.netPnl).toBe(60);
    expect(review.profitFactor).toBe(2.5);
    expect(review.ffzScore.value).not.toBeNull();
    expect(review.averageR).toBe(0);
  });

  it("breaks down discipline, origin and objective post-loss behavior", () => {
    const lossTags = applyDisciplineReview([], { execution: "ON_PLAN", mindset: "CALM" });
    const followUpTags = applyDisciplineReview([], { execution: "UNPLANNED", mindset: "REVENGE" });
    const plannedTags = applyDisciplineReview([STARTED_FROM_PLAN_TAG], { execution: "ON_PLAN", mindset: "FOCUSED" });

    const review = calculateWeeklyReview(
      [
        trade("loss", {
          openedAt: new Date(2026, 8, 7, 10, 0).toISOString(),
          closedAt: new Date(2026, 8, 7, 10, 5).toISOString(),
          netPnl: -50,
          outcome: "LOSS",
          rMultiple: -1,
          tags: lossTags,
        }),
        trade("rapid-follow-up", {
          openedAt: new Date(2026, 8, 7, 10, 12).toISOString(),
          closedAt: new Date(2026, 8, 7, 10, 18).toISOString(),
          netPnl: -20,
          outcome: "LOSS",
          rMultiple: -0.4,
          tags: followUpTags,
        }),
        trade("planned-win", {
          openedAt: new Date(2026, 8, 8, 11, 0).toISOString(),
          closedAt: new Date(2026, 8, 8, 11, 8).toISOString(),
          netPnl: 100,
          outcome: "WIN",
          rMultiple: 2,
          tags: plannedTags,
        }),
      ],
      new Date(2026, 8, 9, 12),
    );

    expect(review.execution.find((row) => row.key === "UNPLANNED")?.trades).toBe(1);
    expect(review.mindset.find((row) => row.key === "REVENGE")?.trades).toBe(1);
    expect(review.origin.find((row) => row.key === "PLANNED")?.trades).toBe(1);
    expect(review.postLoss.followUps).toBe(1);
    expect(review.postLoss.averageNextPnl).toBe(-20);
    expect(review.postLoss.rapidReEntries).toBe(1);
    expect(review.postLoss.deviatedOrUnplanned).toBe(1);
    expect(review.findings.some((finding) => finding.text.includes("Revenge"))).toBe(true);
  });

  it("calculates trade-by-trade weekly max drawdown", () => {
    const review = calculateWeeklyReview(
      [
        trade("one", { netPnl: 100 }),
        trade("two", {
          openedAt: new Date(2026, 8, 7, 11, 0).toISOString(),
          closedAt: new Date(2026, 8, 7, 11, 5).toISOString(),
          netPnl: -60,
          outcome: "LOSS",
        }),
        trade("three", {
          openedAt: new Date(2026, 8, 8, 10, 0).toISOString(),
          closedAt: new Date(2026, 8, 8, 10, 5).toISOString(),
          netPnl: -20,
          outcome: "LOSS",
        }),
        trade("four", {
          openedAt: new Date(2026, 8, 9, 10, 0).toISOString(),
          closedAt: new Date(2026, 8, 9, 10, 5).toISOString(),
          netPnl: 40,
          outcome: "WIN",
        }),
      ],
      new Date(2026, 8, 9, 12),
    );

    expect(review.maxDrawdown).toBe(80);
  });

  it("shifts weekly anchors by exactly seven calendar days", () => {
    const anchor = new Date(2026, 8, 9, 12);
    const previous = shiftWeeklyReviewAnchor(anchor, -1);
    const next = shiftWeeklyReviewAnchor(anchor, 1);

    expect(previous.getDate()).toBe(2);
    expect(next.getDate()).toBe(16);
  });
});
