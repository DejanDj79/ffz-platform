export const LEDGER_CATEGORIES = [
  "CHALLENGE_FEE",
  "RESET_FEE",
  "ACTIVATION_FEE",
  "REACTIVATION_FEE",
  "PLATFORM_FEE",
  "DATA_FEE",
  "PAYOUT",
  "REFUND",
  "OTHER_EXPENSE",
  "OTHER_INCOME",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];
export type LedgerEntryType = "EXPENSE" | "INCOME";

export type LedgerEntryApiModel = {
  id: string;

  challengeId: string | null;
  tradingAccountId: string | null;

  entryType: LedgerEntryType;
  category: LedgerCategory;

  occurredAt: string;
  amount: number;
  currency: string;

  provider: string | null;
  description: string | null;
  reference: string | null;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
};

export type LedgerEntryInput = {
  challengeId: string | null;
  tradingAccountId: string | null;

  entryType: LedgerEntryType;
  category: LedgerCategory;

  occurredAt: string;
  amount: number;
  currency: string;

  provider: string | null;
  description: string | null;
  reference: string | null;
  notes: string | null;
};

export type UpdateLedgerEntryInput = Partial<LedgerEntryInput>;
