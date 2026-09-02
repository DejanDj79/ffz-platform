import type { Challenge } from "@/lib/challenges/types";
import type { TradeApiModel } from "@/lib/journal/types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { calculateJournalStats } from "@/lib/journal/stats";
import { calculateLedgerStats } from "@/lib/ledger/stats";

export type DashboardChallengeSummary = {
  challenge: Challenge | null;
  pnl: number;
  targetRemaining: number;
  targetProgressPct: number;
};

export type DashboardSummary = {
  challenge: DashboardChallengeSummary;
  journal: ReturnType<typeof calculateJournalStats>;
  ledger: ReturnType<typeof calculateLedgerStats>;
};

const ACTIVE_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "PASSED",
  "FUNDED",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function selectPrimaryChallenge(
  challenges: Challenge[],
): Challenge | null {
  return (
    challenges.find((challenge) => challenge.status === "IN_PROGRESS") ??
    challenges.find((challenge) => challenge.status === "FUNDED") ??
    challenges.find((challenge) => challenge.status === "NOT_STARTED") ??
    challenges.find((challenge) => ACTIVE_STATUSES.has(challenge.status)) ??
    challenges[0] ??
    null
  );
}

export function calculateDashboardSummary(
  challenges: Challenge[],
  trades: TradeApiModel[],
  ledgerEntries: LedgerEntryApiModel[],
): DashboardSummary {
  const challenge = selectPrimaryChallenge(challenges);

  let challengeSummary: DashboardChallengeSummary = {
    challenge,
    pnl: 0,
    targetRemaining: 0,
    targetProgressPct: 0,
  };

  if (challenge) {
    const pnl = challenge.currentBalance - challenge.startingBalance;
    const targetRemaining = Math.max(0, challenge.profitTarget - pnl);

    const targetProgressPct =
      challenge.profitTarget > 0
        ? clamp((pnl / challenge.profitTarget) * 100, 0, 100)
        : 0;

    challengeSummary = {
      challenge,
      pnl,
      targetRemaining,
      targetProgressPct,
    };
  }

  return {
    challenge: challengeSummary,
    journal: calculateJournalStats(trades),
    ledger: calculateLedgerStats(ledgerEntries),
  };
}
