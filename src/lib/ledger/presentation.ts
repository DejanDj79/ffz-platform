import type {
  LedgerCategory,
  LedgerEntryType,
} from "./types";

export const EXPENSE_CATEGORIES: LedgerCategory[] = [
  "CHALLENGE_FEE",
  "RESET_FEE",
  "ACTIVATION_FEE",
  "REACTIVATION_FEE",
  "PLATFORM_FEE",
  "DATA_FEE",
  "OTHER_EXPENSE",
];

export const INCOME_CATEGORIES: LedgerCategory[] = [
  "PAYOUT",
  "REFUND",
  "OTHER_INCOME",
];

export const CATEGORY_LABELS: Record<LedgerCategory, string> = {
  CHALLENGE_FEE: "Challenge Fee",
  RESET_FEE: "Reset Fee",
  ACTIVATION_FEE: "Activation Fee",
  REACTIVATION_FEE: "Reactivation Fee",
  PLATFORM_FEE: "Platform Fee",
  DATA_FEE: "Data Fee",
  PAYOUT: "Payout",
  REFUND: "Refund",
  OTHER_EXPENSE: "Other Expense",
  OTHER_INCOME: "Other Income",
};

export function categoriesForType(
  entryType: LedgerEntryType,
): LedgerCategory[] {
  return entryType === "EXPENSE"
    ? EXPENSE_CATEGORIES
    : INCOME_CATEGORIES;
}
