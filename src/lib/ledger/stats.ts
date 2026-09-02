import type { LedgerEntryApiModel } from "./types";

export type LedgerStats = {
  totalExpenses: number;
  totalIncome: number;
  netCashFlow: number;
  challengeCosts: number;
  payouts: number;
  refunds: number;
  entryCount: number;
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLedgerStats(
  entries: LedgerEntryApiModel[],
): LedgerStats {
  const totalExpenses = entries.reduce(
    (sum, entry) =>
      entry.entryType === "EXPENSE" ? sum + entry.amount : sum,
    0,
  );

  const totalIncome = entries.reduce(
    (sum, entry) =>
      entry.entryType === "INCOME" ? sum + entry.amount : sum,
    0,
  );

  const challengeCostCategories = new Set([
    "CHALLENGE_FEE",
    "RESET_FEE",
    "ACTIVATION_FEE",
    "REACTIVATION_FEE",
  ]);

  const challengeCosts = entries.reduce(
    (sum, entry) =>
      entry.entryType === "EXPENSE" &&
      challengeCostCategories.has(entry.category)
        ? sum + entry.amount
        : sum,
    0,
  );

  const payouts = entries.reduce(
    (sum, entry) =>
      entry.category === "PAYOUT" ? sum + entry.amount : sum,
    0,
  );

  const refunds = entries.reduce(
    (sum, entry) =>
      entry.category === "REFUND" ? sum + entry.amount : sum,
    0,
  );

  return {
    totalExpenses: round(totalExpenses),
    totalIncome: round(totalIncome),
    netCashFlow: round(totalIncome - totalExpenses),
    challengeCosts: round(challengeCosts),
    payouts: round(payouts),
    refunds: round(refunds),
    entryCount: entries.length,
  };
}
