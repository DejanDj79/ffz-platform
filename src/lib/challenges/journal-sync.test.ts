import { describe, expect, it } from "vitest";
import { calculateJournalChallengeSync } from "./journal-sync";

const trade = (
  closedAt: string,
  netPnlCents: number,
  tags: string[] = [],
) => ({
  openedAt: new Date(closedAt),
  closedAt: new Date(closedAt),
  status: "CLOSED" as const,
  netPnlCents,
  tags,
});

describe("calculateJournalChallengeSync", () => {
  it("derives balance, NY trading days, today PnL and highest EOD balance", () => {
    const result = calculateJournalChallengeSync({
      startingBalanceCents: 5_000_000,
      trades: [
        trade("2026-09-01T15:00:00Z", 50_000),
        trade("2026-09-01T18:00:00Z", -10_000),
        trade("2026-09-02T15:00:00Z", 30_000),
      ],
      payouts: [],
      profitSplitPct: null,
      now: new Date("2026-09-02T20:00:00Z"),
    });

    expect(result.currentBalanceCents).toBe(5_070_000);
    expect(result.highestEodBalanceCents).toBe(5_070_000);
    expect(result.todayPnlCents).toBe(30_000);
    expect(result.daysTraded).toBe(2);
  });

  it("ignores planned trades", () => {
    const result = calculateJournalChallengeSync({
      startingBalanceCents: 2_500_000,
      trades: [
        trade("2026-09-02T15:00:00Z", 25_000, ["__FFZ_PLANNED__"]),
      ],
      payouts: [],
      profitSplitPct: null,
      now: new Date("2026-09-02T20:00:00Z"),
    });

    expect(result.currentBalanceCents).toBe(2_500_000);
    expect(result.daysTraded).toBe(0);
    expect(result.todayPnlCents).toBe(0);
  });

  it("subtracts gross payout withdrawals using the configured trader split", () => {
    const result = calculateJournalChallengeSync({
      startingBalanceCents: 5_000_000,
      trades: [trade("2026-09-01T15:00:00Z", 300_000)],
      payouts: [
        {
          occurredAt: new Date("2026-09-02T15:00:00Z"),
          amountCents: 180_000,
        },
      ],
      profitSplitPct: 90,
      now: new Date("2026-09-02T20:00:00Z"),
    });

    expect(result.estimatedGrossWithdrawnCents).toBe(200_000);
    expect(result.currentBalanceCents).toBe(5_100_000);
    expect(result.highestEodBalanceCents).toBe(5_300_000);
  });

  it("uses New York calendar days around UTC midnight", () => {
    const result = calculateJournalChallengeSync({
      startingBalanceCents: 5_000_000,
      trades: [
        trade("2026-09-03T00:30:00Z", 10_000),
        trade("2026-09-03T13:00:00Z", 20_000),
      ],
      payouts: [],
      profitSplitPct: null,
      now: new Date("2026-09-03T14:00:00Z"),
    });

    expect(result.daysTraded).toBe(2);
    expect(result.todayPnlCents).toBe(20_000);
  });
});
