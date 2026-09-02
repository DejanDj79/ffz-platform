import { z } from "zod";
import { JOURNAL_INSTRUMENTS } from "./types";

const nullableUuid = z.string().uuid().nullable();
const nullablePrice = z.number().finite().positive().nullable();

const tradeFields = {
  challengeId: nullableUuid.default(null),
  tradingAccountId: nullableUuid.default(null),
  instrument: z.enum(JOURNAL_INSTRUMENTS),
  direction: z.enum(["LONG", "SHORT"]),
  openedAt: z.string().datetime({ offset: true }),
  closedAt: z.string().datetime({ offset: true }).nullable().default(null),
  entryPrice: z.number().finite().positive(),
  stopPrice: nullablePrice.default(null),
  targetPrice: nullablePrice.default(null),
  exitPrice: nullablePrice.default(null),
  contracts: z.number().int().positive().max(1000),
  commissionFees: z.number().finite().nonnegative().default(0),
  setup: z.string().trim().max(120).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([])
    .transform((items) => [...new Set(items)]),
  notes: z.string().max(10000).nullable().default(null),
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

export const updateTradeSchema = z.object(tradeFields).partial();
