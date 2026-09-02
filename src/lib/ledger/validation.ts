import { z } from "zod";
import { LEDGER_CATEGORIES } from "./types";

const EXPENSE_CATEGORIES = new Set([
  "CHALLENGE_FEE",
  "RESET_FEE",
  "ACTIVATION_FEE",
  "REACTIVATION_FEE",
  "PLATFORM_FEE",
  "DATA_FEE",
  "OTHER_EXPENSE",
]);

const INCOME_CATEGORIES = new Set([
  "PAYOUT",
  "REFUND",
  "OTHER_INCOME",
]);

const fields = {
  challengeId: z.string().uuid().nullable().default(null),
  tradingAccountId: z.string().uuid().nullable().default(null),

  entryType: z.enum(["EXPENSE", "INCOME"]),
  category: z.enum(LEDGER_CATEGORIES),

  occurredAt: z.string().datetime({ offset: true }),
  amount: z.number().finite().positive(),

  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("USD"),

  provider: z.string().trim().max(160).nullable().default(null),
  description: z.string().trim().max(240).nullable().default(null),
  reference: z.string().trim().max(160).nullable().default(null),
  notes: z.string().max(10000).nullable().default(null),
};

function validateTypeCategory(
  value: {
    entryType?: "EXPENSE" | "INCOME";
    category?: (typeof LEDGER_CATEGORIES)[number];
  },
  ctx: z.RefinementCtx,
) {
  if (!value.entryType || !value.category) return;

  if (
    value.entryType === "EXPENSE" &&
    !EXPENSE_CATEGORIES.has(value.category)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["category"],
      message: "This category is not valid for an expense.",
    });
  }

  if (
    value.entryType === "INCOME" &&
    !INCOME_CATEGORIES.has(value.category)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["category"],
      message: "This category is not valid for income.",
    });
  }
}

export const ledgerEntrySchema = z
  .object(fields)
  .superRefine(validateTypeCategory);

export const updateLedgerEntrySchema = z.object(fields).partial();
