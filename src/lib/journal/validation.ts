import { z } from "zod";
import { PLANNED_TRADE_TAG } from "./planned";
import { JOURNAL_INSTRUMENTS } from "./types";

const nullableUuid = z.string().uuid().nullable();
const nullablePrice = z.number().finite().positive().nullable();
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20)
  .transform((items) => [...new Set(items)]);

const updateTradeFields = {
  challengeId: nullableUuid,
  tradingAccountId: nullableUuid,
  instrument: z.enum(JOURNAL_INSTRUMENTS),
  direction: z.enum(["LONG", "SHORT"]),
  openedAt: z.string().datetime({ offset: true }),
  closedAt: z.string().datetime({ offset: true }).nullable(),
  entryPrice: z.number().finite().positive(),
  stopPrice: nullablePrice,
  targetPrice: nullablePrice,
  exitPrice: nullablePrice,
  contracts: z.number().int().positive().max(1000),
  commissionFees: z.number().finite().nonnegative(),
  setup: z.string().trim().max(120).nullable(),
  tags: tagsSchema,
  notes: z.string().max(10000).nullable(),
};

const tradeFields = {
  ...updateTradeFields,
  challengeId: updateTradeFields.challengeId.default(null),
  tradingAccountId: updateTradeFields.tradingAccountId.default(null),
  closedAt: updateTradeFields.closedAt.default(null),
  stopPrice: updateTradeFields.stopPrice.default(null),
  targetPrice: updateTradeFields.targetPrice.default(null),
  exitPrice: updateTradeFields.exitPrice.default(null),
  commissionFees: updateTradeFields.commissionFees.default(0),
  setup: updateTradeFields.setup.default(null),
  tags: tagsSchema.default([]),
  notes: updateTradeFields.notes.default(null),
};

export const tradeEditableSchema = z.object(tradeFields).superRefine((value, ctx) => {
  const hasExit = value.exitPrice != null;
  const hasClosedAt = value.closedAt != null;

  if (hasExit !== hasClosedAt) {
    ctx.addIssue({
      code: "custom",
      path: hasExit ? ["closedAt"] : ["exitPrice"],
      message: "Closed trades require both Exit Price and Closed At.",
    });
  }

  if (
    value.closedAt &&
    new Date(value.closedAt).getTime() < new Date(value.openedAt).getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["closedAt"],
      message: "Closed At cannot be before Opened At.",
    });
  }
});

export const journalTradeCreateSchema = tradeEditableSchema.superRefine((value, ctx) => {
  if (value.tags.includes(PLANNED_TRADE_TAG)) return;

  if (value.closedAt == null) {
    ctx.addIssue({
      code: "custom",
      path: ["closedAt"],
      message: "Journal trades must be completed before saving. Closed At is required.",
    });
  }

  if (value.exitPrice == null) {
    ctx.addIssue({
      code: "custom",
      path: ["exitPrice"],
      message: "Journal trades must be completed before saving. Exit Price is required.",
    });
  }
});

export const updateTradeSchema = z.object(updateTradeFields).partial();
