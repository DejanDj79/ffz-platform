import type { ChallengeApiModel } from "@/lib/challenges/api-types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { calculatePropJourneyAnalytics } from "@/lib/prop-journey/analytics";

export type PublicJourneyCurrentAccount = {
  propFirm: string;
  status: ChallengeApiModel["status"];
  phase: ChallengeApiModel["phase"];
  accountSize: number;
  pnl: number;
  profitTarget: number;
  progressPct: number;
  daysTraded: number;
  minimumTradingDays: number | null;
};

export type PublicJourneyMilestone = {
  label: string;
  detail: string;
  achieved: boolean;
};

export type PublicJourneyData = {
  displayName: "Futures From Zero";
  currency: string;
  lastUpdatedAt: string | null;
  currentAccount: PublicJourneyCurrentAccount | null;
  totalCosts: number;
  totalPayouts: number;
  netJourneyPnl: number;
  amountToBreakEven: number;
  breakEvenReached: boolean;
  payoutCount: number;
  trackedChallenges: number;
  evaluationsStarted: number;
  passedEvaluations: number;
  fundedReached: number;
  payoutAccountCount: number;
  monthlyCashFlow: Array<{
    month: string;
    costs: number;
    payouts: number;
    net: number;
  }>;
  firmBreakdown: Array<{
    firm: string;
    challengeCount: number;
    fundedCount: number;
    payoutAccounts: number;
    costs: number;
    payouts: number;
    net: number;
  }>;
  milestones: PublicJourneyMilestone[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function currentChallenge(challenges: ChallengeApiModel[]) {
  const activeStatuses = new Set<ChallengeApiModel["status"]>([
    "ACTIVE",
    "IN_PROGRESS",
    "FUNDED",
    "PAUSED",
    "NOT_STARTED",
  ]);

  const sorted = [...challenges].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return sorted.find((challenge) => activeStatuses.has(challenge.status)) ?? sorted[0] ?? null;
}

function latestUpdate(entries: LedgerEntryApiModel[], challenges: ChallengeApiModel[]) {
  const timestamps = [
    ...entries.map((entry) => entry.updatedAt),
    ...challenges.map((challenge) => challenge.updatedAt),
  ]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function buildPublicJourneyData(
  entries: LedgerEntryApiModel[],
  challenges: ChallengeApiModel[],
): PublicJourneyData {
  const analytics = calculatePropJourneyAnalytics(entries, challenges);
  const currency = analytics.currencies.includes("USD")
    ? "USD"
    : analytics.currencies[0] ?? "USD";
  const journey = analytics.byCurrency.find((row) => row.currency === currency)
    ?? analytics.byCurrency[0];

  const challenge = currentChallenge(challenges);
  const pnl = challenge ? challenge.currentBalance - challenge.startingBalance : 0;
  const progressPct = challenge && challenge.profitTarget > 0
    ? clamp((pnl / challenge.profitTarget) * 100, 0, 100)
    : 0;

  const currentAccount: PublicJourneyCurrentAccount | null = challenge
    ? {
        propFirm: challenge.propFirm,
        status: challenge.status,
        phase: challenge.phase,
        accountSize: challenge.accountSize,
        pnl: Math.round((pnl + Number.EPSILON) * 100) / 100,
        profitTarget: challenge.profitTarget,
        progressPct: Math.round((progressPct + Number.EPSILON) * 100) / 100,
        daysTraded: challenge.daysTraded,
        minimumTradingDays: challenge.minimumTradingDays,
      }
    : null;

  return {
    displayName: "Futures From Zero",
    currency: journey.currency,
    lastUpdatedAt: latestUpdate(entries, challenges),
    currentAccount,
    totalCosts: journey.totalCosts,
    totalPayouts: journey.totalPayouts,
    netJourneyPnl: journey.netJourneyPnl,
    amountToBreakEven: journey.amountToBreakEven,
    breakEvenReached: journey.breakEvenReached,
    payoutCount: journey.payoutCount,
    trackedChallenges: journey.trackedChallenges,
    evaluationsStarted: journey.evaluationsStarted,
    passedEvaluations: journey.passedEvaluations,
    fundedReached: journey.fundedReached,
    payoutAccountCount: journey.payoutAccountCount,
    monthlyCashFlow: journey.monthlyCashFlow.slice(-6).map((row) => ({
      month: row.month,
      costs: row.costs,
      payouts: row.payouts,
      net: row.net,
    })),
    firmBreakdown: journey.firmBreakdown
      .filter((row) => row.firm !== "Unassigned")
      .slice(0, 5)
      .map((row) => ({
        firm: row.firm,
        challengeCount: row.challengeCount,
        fundedCount: row.fundedCount,
        payoutAccounts: row.payoutAccounts,
        costs: row.costs,
        payouts: row.payouts,
        net: row.net,
      })),
    milestones: [
      {
        label: "Evaluation started",
        detail: "At least one tracked evaluation has started.",
        achieved: journey.evaluationsStarted > 0,
      },
      {
        label: "Evaluation passed",
        detail: "At least one evaluation has reached passed or funded status.",
        achieved: journey.passedEvaluations > 0,
      },
      {
        label: "Funded reached",
        detail: "At least one tracked account has reached a funded phase.",
        achieved: journey.fundedReached > 0,
      },
      {
        label: "First payout",
        detail: "A real payout has been recorded in the Real Money Ledger.",
        achieved: journey.payoutCount > 0,
      },
      {
        label: "Break-even",
        detail: "Recorded prop income has recovered all recorded prop costs.",
        achieved: journey.breakEvenReached,
      },
    ],
  };
}
