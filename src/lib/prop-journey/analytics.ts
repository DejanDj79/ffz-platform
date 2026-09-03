import type { ChallengeApiModel } from "@/lib/challenges/api-types";
import type {
  LedgerCategory,
  LedgerEntryApiModel,
} from "@/lib/ledger/types";

export type PropJourneyCostRow = {
  category: LedgerCategory;
  amount: number;
  entries: number;
};

export type PropJourneyMonthlyRow = {
  month: string;
  costs: number;
  payouts: number;
  refunds: number;
  otherIncome: number;
  net: number;
};

export type PropJourneyFirmRow = {
  firm: string;
  challengeCount: number;
  passedCount: number;
  fundedCount: number;
  payoutAccounts: number;
  costs: number;
  payouts: number;
  refunds: number;
  otherIncome: number;
  net: number;
};

export type PropJourneyAccountRow = {
  challengeId: string;
  name: string;
  propFirm: string;
  status: ChallengeApiModel["status"];
  phase: ChallengeApiModel["phase"];
  costs: number;
  payouts: number;
  refunds: number;
  otherIncome: number;
  net: number;
};

export type PropJourneyCurrencyAnalytics = {
  currency: string;
  totalCosts: number;
  totalIncome: number;
  totalPayouts: number;
  refunds: number;
  otherIncome: number;
  netJourneyPnl: number;
  recoveryPct: number;
  amountToBreakEven: number;
  breakEvenReached: boolean;
  payoutCount: number;
  payoutAccountCount: number;
  largestPayout: number;
  averagePayout: number;
  trackedChallenges: number;
  evaluationsStarted: number;
  passedEvaluations: number;
  fundedReached: number;
  costBreakdown: PropJourneyCostRow[];
  monthlyCashFlow: PropJourneyMonthlyRow[];
  firmBreakdown: PropJourneyFirmRow[];
  accountBreakdown: PropJourneyAccountRow[];
};

export type PropJourneyAnalytics = {
  currencies: string[];
  byCurrency: PropJourneyCurrencyAnalytics[];
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase() || "USD";
}

function isPayout(entry: LedgerEntryApiModel) {
  return entry.entryType === "INCOME" && entry.category === "PAYOUT";
}

function isRefund(entry: LedgerEntryApiModel) {
  return entry.entryType === "INCOME" && entry.category === "REFUND";
}

function isOtherIncome(entry: LedgerEntryApiModel) {
  return entry.entryType === "INCOME" && !isPayout(entry) && !isRefund(entry);
}

function hasFundedPhase(challenge: ChallengeApiModel) {
  return ["SIM_FUNDED", "FUNDED", "PAYOUT"].includes(challenge.phase);
}

function calculateForCurrency(
  currency: string,
  entries: LedgerEntryApiModel[],
  challenges: ChallengeApiModel[],
): PropJourneyCurrencyAnalytics {
  const scoped = entries.filter(
    (entry) => normalizeCurrency(entry.currency) === currency,
  );

  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
  const challengeFeeIds = new Set(
    scoped
      .filter((entry) => entry.entryType === "EXPENSE" && entry.category === "CHALLENGE_FEE" && entry.challengeId)
      .map((entry) => entry.challengeId as string),
  );
  const payoutChallengeIds = new Set(
    scoped
      .filter((entry) => isPayout(entry) && entry.challengeId)
      .map((entry) => entry.challengeId as string),
  );

  const totalCosts = scoped.reduce(
    (sum, entry) => entry.entryType === "EXPENSE" ? sum + entry.amount : sum,
    0,
  );
  const totalIncome = scoped.reduce(
    (sum, entry) => entry.entryType === "INCOME" ? sum + entry.amount : sum,
    0,
  );
  const totalPayouts = scoped.reduce(
    (sum, entry) => isPayout(entry) ? sum + entry.amount : sum,
    0,
  );
  const refunds = scoped.reduce(
    (sum, entry) => isRefund(entry) ? sum + entry.amount : sum,
    0,
  );
  const otherIncome = scoped.reduce(
    (sum, entry) => isOtherIncome(entry) ? sum + entry.amount : sum,
    0,
  );
  const netJourneyPnl = totalIncome - totalCosts;
  const recoveryPct = totalCosts > 0
    ? (totalIncome / totalCosts) * 100
    : totalIncome > 0 ? 100 : 0;

  const payouts = scoped.filter(isPayout);
  const largestPayout = payouts.reduce(
    (largest, entry) => Math.max(largest, entry.amount),
    0,
  );

  const fundedIds = new Set(
    challenges
      .filter((challenge) =>
        challenge.status === "FUNDED" ||
        hasFundedPhase(challenge) ||
        payoutChallengeIds.has(challenge.id),
      )
      .map((challenge) => challenge.id),
  );

  const passedIds = new Set(
    challenges
      .filter((challenge) =>
        challenge.status === "PASSED" ||
        fundedIds.has(challenge.id),
      )
      .map((challenge) => challenge.id),
  );

  const evaluationsStarted = challenges.filter((challenge) =>
    challenge.status !== "NOT_STARTED" || challengeFeeIds.has(challenge.id),
  ).length;

  const costMap = new Map<LedgerCategory, { amount: number; entries: number }>();
  for (const entry of scoped) {
    if (entry.entryType !== "EXPENSE") continue;
    const current = costMap.get(entry.category) ?? { amount: 0, entries: 0 };
    current.amount += entry.amount;
    current.entries += 1;
    costMap.set(entry.category, current);
  }
  const costBreakdown = Array.from(costMap.entries())
    .map(([category, value]) => ({
      category,
      amount: round(value.amount),
      entries: value.entries,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthMap = new Map<string, Omit<PropJourneyMonthlyRow, "month">>();
  for (const entry of scoped) {
    const date = new Date(entry.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = monthMap.get(month) ?? {
      costs: 0,
      payouts: 0,
      refunds: 0,
      otherIncome: 0,
      net: 0,
    };

    if (entry.entryType === "EXPENSE") current.costs += entry.amount;
    if (isPayout(entry)) current.payouts += entry.amount;
    if (isRefund(entry)) current.refunds += entry.amount;
    if (isOtherIncome(entry)) current.otherIncome += entry.amount;
    current.net += entry.entryType === "INCOME" ? entry.amount : -entry.amount;
    monthMap.set(month, current);
  }
  const monthlyCashFlow = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      costs: round(value.costs),
      payouts: round(value.payouts),
      refunds: round(value.refunds),
      otherIncome: round(value.otherIncome),
      net: round(value.net),
    }));

  const knownFirmNames = new Map<string, string>();
  for (const challenge of challenges) {
    const firm = challenge.propFirm.trim() || "Unknown firm";
    knownFirmNames.set(firm.toLowerCase(), firm);
  }

  const resolveEntryFirm = (entry: LedgerEntryApiModel) => {
    if (entry.challengeId) {
      const challenge = challengeById.get(entry.challengeId);
      if (challenge) return challenge.propFirm.trim() || "Unknown firm";
    }

    const provider = entry.provider?.trim();
    if (provider) return knownFirmNames.get(provider.toLowerCase()) ?? provider;
    return "Unassigned";
  };

  const firmNames = new Set<string>();
  for (const challenge of challenges) firmNames.add(challenge.propFirm.trim() || "Unknown firm");
  for (const entry of scoped) firmNames.add(resolveEntryFirm(entry));

  const firmBreakdown = Array.from(firmNames).map((firm): PropJourneyFirmRow => {
    const firmChallenges = challenges.filter(
      (challenge) => (challenge.propFirm.trim() || "Unknown firm") === firm,
    );
    const firmChallengeIds = new Set(firmChallenges.map((challenge) => challenge.id));
    const firmEntries = scoped.filter((entry) => {
      if (entry.challengeId && firmChallengeIds.has(entry.challengeId)) return true;
      if (!entry.challengeId) return resolveEntryFirm(entry) === firm;
      return false;
    });

    const costs = firmEntries.reduce(
      (sum, entry) => entry.entryType === "EXPENSE" ? sum + entry.amount : sum,
      0,
    );
    const firmPayouts = firmEntries.reduce(
      (sum, entry) => isPayout(entry) ? sum + entry.amount : sum,
      0,
    );
    const firmRefunds = firmEntries.reduce(
      (sum, entry) => isRefund(entry) ? sum + entry.amount : sum,
      0,
    );
    const firmOtherIncome = firmEntries.reduce(
      (sum, entry) => isOtherIncome(entry) ? sum + entry.amount : sum,
      0,
    );
    const payoutAccounts = new Set(
      firmEntries.filter((entry) => isPayout(entry) && entry.challengeId).map((entry) => entry.challengeId),
    ).size;

    return {
      firm,
      challengeCount: firmChallenges.length,
      passedCount: firmChallenges.filter((challenge) => passedIds.has(challenge.id)).length,
      fundedCount: firmChallenges.filter((challenge) => fundedIds.has(challenge.id)).length,
      payoutAccounts,
      costs: round(costs),
      payouts: round(firmPayouts),
      refunds: round(firmRefunds),
      otherIncome: round(firmOtherIncome),
      net: round(firmPayouts + firmRefunds + firmOtherIncome - costs),
    };
  }).sort((a, b) => b.net - a.net || b.payouts - a.payouts || b.costs - a.costs);

  const accountBreakdown = challenges.map((challenge): PropJourneyAccountRow => {
    const challengeEntries = scoped.filter((entry) => entry.challengeId === challenge.id);
    const costs = challengeEntries.reduce(
      (sum, entry) => entry.entryType === "EXPENSE" ? sum + entry.amount : sum,
      0,
    );
    const accountPayouts = challengeEntries.reduce(
      (sum, entry) => isPayout(entry) ? sum + entry.amount : sum,
      0,
    );
    const accountRefunds = challengeEntries.reduce(
      (sum, entry) => isRefund(entry) ? sum + entry.amount : sum,
      0,
    );
    const accountOtherIncome = challengeEntries.reduce(
      (sum, entry) => isOtherIncome(entry) ? sum + entry.amount : sum,
      0,
    );

    return {
      challengeId: challenge.id,
      name: challenge.name,
      propFirm: challenge.propFirm,
      status: challenge.status,
      phase: challenge.phase,
      costs: round(costs),
      payouts: round(accountPayouts),
      refunds: round(accountRefunds),
      otherIncome: round(accountOtherIncome),
      net: round(accountPayouts + accountRefunds + accountOtherIncome - costs),
    };
  }).sort((a, b) => b.net - a.net || b.payouts - a.payouts || b.costs - a.costs);

  return {
    currency,
    totalCosts: round(totalCosts),
    totalIncome: round(totalIncome),
    totalPayouts: round(totalPayouts),
    refunds: round(refunds),
    otherIncome: round(otherIncome),
    netJourneyPnl: round(netJourneyPnl),
    recoveryPct: round(recoveryPct),
    amountToBreakEven: round(Math.max(0, totalCosts - totalIncome)),
    breakEvenReached: totalCosts > 0 && totalIncome >= totalCosts,
    payoutCount: payouts.length,
    payoutAccountCount: payoutChallengeIds.size,
    largestPayout: round(largestPayout),
    averagePayout: payouts.length > 0 ? round(totalPayouts / payouts.length) : 0,
    trackedChallenges: challenges.length,
    evaluationsStarted,
    passedEvaluations: passedIds.size,
    fundedReached: fundedIds.size,
    costBreakdown,
    monthlyCashFlow,
    firmBreakdown,
    accountBreakdown,
  };
}

export function calculatePropJourneyAnalytics(
  entries: LedgerEntryApiModel[],
  challenges: ChallengeApiModel[],
): PropJourneyAnalytics {
  const currencies = Array.from(
    new Set(entries.map((entry) => normalizeCurrency(entry.currency))),
  ).sort();

  if (currencies.length === 0) currencies.push("USD");

  return {
    currencies,
    byCurrency: currencies.map((currency) =>
      calculateForCurrency(currency, entries, challenges),
    ),
  };
}
