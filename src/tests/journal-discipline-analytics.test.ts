import { describe, expect, it } from "vitest";
import { calculateJournalAnalytics, type JournalAnalyticsFilters } from "@/lib/journal/analytics";
import { applyDisciplineReview } from "@/lib/journal/discipline";
import type { TradeApiModel } from "@/lib/journal/types";

function trade(overrides: Partial<TradeApiModel> = {}): TradeApiModel {
  return {
    id: crypto.randomUUID(),
    challengeId: "challenge-1",
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    status: "CLOSED",
    openedAt: "2026-09-01T14:00:00.000Z",
    closedAt: "2026-09-01T14:05:00.000Z",
    entryPrice: 20000,
    stopPrice: 19990,
    targetPrice: 20020,
    exitPrice: 20020,
    contracts: 1,
    commissionFees: 0,
    grossPnl: 40,
    netPnl: 40,
    initialRisk: 20,
    rMultiple: 2,
    outcome: "WIN",
    setup: "ORB",
    tags: ["A+"],
    notes: null,
    createdAt: "2026-09-01T14:06:00.000Z",
    updatedAt: "2026-09-01T14:06:00.000Z",
    ...overrides,
  };
}

const filters: JournalAnalyticsFilters = {
  period: "ALL",
  instrument: "ALL",
  direction: "ALL",
  challengeId: "ALL",
};

describe("discipline analytics", () => {
  it("breaks closed-trade performance down by execution and mindset", () => {
    const onPlanCalm = trade({
      tags: applyDisciplineReview(["A+"], {
        execution: "ON_PLAN",
        mindset: "CALM",
      }),
    });
    const onPlanFocusedLoss = trade({
      openedAt: "2026-09-01T15:00:00.000Z",
      closedAt: "2026-09-01T15:05:00.000Z",
      netPnl: -20,
      outcome: "LOSS",
      rMultiple: -1,
      tags: applyDisciplineReview(["A+"], {
        execution: "ON_PLAN",
        mindset: "FOCUSED",
      }),
    });
    const deviatedFomo = trade({
      openedAt: "2026-09-01T16:00:00.000Z",
      closedAt: "2026-09-01T16:05:00.000Z",
      netPnl: -30,
      outcome: "LOSS",
      rMultiple: -1.5,
      tags: applyDisciplineReview(["scalp"], {
        execution: "DEVIATED",
        mindset: "FOMO",
      }),
    });

    const analytics = calculateJournalAnalytics(
      [onPlanCalm, onPlanFocusedLoss, deviatedFomo],
      filters,
    );

    const onPlan = analytics.byExecution.find((row) => row.key === "ON_PLAN");
    expect(onPlan).toMatchObject({
      label: "On plan",
      trades: 2,
      winRate: 50,
      averageR: 0.5,
      netPnl: 20,
    });

    const deviated = analytics.byExecution.find((row) => row.key === "DEVIATED");
    expect(deviated).toMatchObject({
      label: "Deviated",
      trades: 1,
      winRate: 0,
      averageR: -1.5,
      netPnl: -30,
    });

    expect(analytics.byMindset.find((row) => row.key === "CALM")).toMatchObject({
      label: "Calm",
      trades: 1,
      winRate: 100,
      averageR: 2,
      netPnl: 40,
    });
    expect(analytics.byMindset.find((row) => row.key === "FOMO")).toMatchObject({
      label: "FOMO",
      trades: 1,
      winRate: 0,
      averageR: -1.5,
      netPnl: -30,
    });
  });

  it("keeps FFZ metadata out of normal tag analytics", () => {
    const analytics = calculateJournalAnalytics(
      [
        trade({
          tags: applyDisciplineReview(["A+", "trend", "FFZ:planned"], {
            execution: "ON_PLAN",
            mindset: "FOCUSED",
          }),
        }),
      ],
      filters,
    );

    expect(analytics.byTag.map((row) => row.label)).toEqual(["A+", "trend"]);
    expect(analytics.byTag.some((row) => row.label.startsWith("FFZ:"))).toBe(false);
  });

  it("omits unreviewed trades from discipline breakdowns", () => {
    const analytics = calculateJournalAnalytics([trade({ tags: ["A+"] })], filters);

    expect(analytics.byExecution).toEqual([]);
    expect(analytics.byMindset).toEqual([]);
  });
});
