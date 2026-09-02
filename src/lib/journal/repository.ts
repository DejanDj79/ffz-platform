import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { centsToDollars, dollarsToCents } from "@/db/money";
import { challenges, trades, tradingAccounts } from "@/db/schema";
import { calculateTradeMetrics } from "./calculations";
import { isPlannedTrade } from "./planned";
import type {
  JournalInstrument,
  TradeApiModel,
  TradeEditableInput,
  UpdateTradeInput,
} from "./types";

const n = (value: string | null) => value == null ? null : Number(value);

function toApiModel(row: typeof trades.$inferSelect): TradeApiModel {
  return {
    id: row.id,
    challengeId: row.challengeId,
    tradingAccountId: row.tradingAccountId,
    instrument: row.instrument as JournalInstrument,
    direction: row.direction,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    entryPrice: Number(row.entryPrice),
    stopPrice: n(row.stopPrice),
    targetPrice: n(row.targetPrice),
    exitPrice: n(row.exitPrice),
    contracts: row.contracts,
    commissionFees: centsToDollars(row.commissionFeesCents) ?? 0,
    grossPnl: centsToDollars(row.grossPnlCents),
    netPnl: centsToDollars(row.netPnlCents),
    initialRisk: centsToDollars(row.initialRiskCents),
    rMultiple: n(row.rMultiple),
    outcome: row.outcome,
    setup: row.setup,
    tags: Array.isArray(row.tags) ? row.tags : [],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertOwnedRelations(
  userId: string,
  challengeId: string | null,
  tradingAccountId: string | null,
) {
  if (challengeId) {
    const owned = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(and(eq(challenges.id, challengeId), eq(challenges.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new Error("CHALLENGE_NOT_FOUND");
  }

  if (tradingAccountId) {
    const owned = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, tradingAccountId), eq(tradingAccounts.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new Error("TRADING_ACCOUNT_NOT_FOUND");
  }
}

function metrics(input: TradeEditableInput) {
  const value = calculateTradeMetrics({
    instrument: input.instrument,
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopPrice: input.stopPrice,
    exitPrice: input.exitPrice,
    contracts: input.contracts,
    commissionFees: input.commissionFees,
  });

  return {
    status: value.status,
    grossPnlCents: value.grossPnl == null ? null : dollarsToCents(value.grossPnl),
    netPnlCents: value.netPnl == null ? null : dollarsToCents(value.netPnl),
    initialRiskCents: value.initialRisk == null ? null : dollarsToCents(value.initialRisk),
    rMultiple: value.rMultiple == null ? null : String(value.rMultiple),
    outcome: value.outcome,
  };
}

export async function listTrades(
  userId: string,
  options: { includePlanned?: boolean } = {},
) {
  const rows = await db.select().from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.openedAt));

  const models = rows.map(toApiModel);
  return options.includePlanned
    ? models
    : models.filter((trade) => !isPlannedTrade(trade));
}

export async function getTrade(userId: string, tradeId: string) {
  const rows = await db.select().from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .limit(1);
  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function createTrade(userId: string, input: TradeEditableInput) {
  await assertOwnedRelations(userId, input.challengeId, input.tradingAccountId);
  const m = metrics(input);

  const rows = await db.insert(trades).values({
    userId,
    challengeId: input.challengeId,
    tradingAccountId: input.tradingAccountId,
    instrument: input.instrument,
    direction: input.direction,
    status: m.status,
    openedAt: new Date(input.openedAt),
    closedAt: input.closedAt ? new Date(input.closedAt) : null,
    entryPrice: String(input.entryPrice),
    stopPrice: input.stopPrice == null ? null : String(input.stopPrice),
    targetPrice: input.targetPrice == null ? null : String(input.targetPrice),
    exitPrice: input.exitPrice == null ? null : String(input.exitPrice),
    contracts: input.contracts,
    commissionFeesCents: dollarsToCents(input.commissionFees),
    grossPnlCents: m.grossPnlCents,
    netPnlCents: m.netPnlCents,
    initialRiskCents: m.initialRiskCents,
    rMultiple: m.rMultiple,
    outcome: m.outcome,
    setup: input.setup,
    tags: input.tags,
    notes: input.notes,
    updatedAt: new Date(),
  }).returning();

  return toApiModel(rows[0]);
}

export async function updateTrade(
  userId: string,
  tradeId: string,
  input: UpdateTradeInput,
) {
  const current = await getTrade(userId, tradeId);
  if (!current) return null;

  const merged: TradeEditableInput = {
    challengeId: input.challengeId !== undefined ? input.challengeId : current.challengeId,
    tradingAccountId: input.tradingAccountId !== undefined ? input.tradingAccountId : current.tradingAccountId,
    instrument: input.instrument ?? current.instrument,
    direction: input.direction ?? current.direction,
    openedAt: input.openedAt ?? current.openedAt,
    closedAt: input.closedAt !== undefined ? input.closedAt : current.closedAt,
    entryPrice: input.entryPrice ?? current.entryPrice,
    stopPrice: input.stopPrice !== undefined ? input.stopPrice : current.stopPrice,
    targetPrice: input.targetPrice !== undefined ? input.targetPrice : current.targetPrice,
    exitPrice: input.exitPrice !== undefined ? input.exitPrice : current.exitPrice,
    contracts: input.contracts ?? current.contracts,
    commissionFees: input.commissionFees ?? current.commissionFees,
    setup: input.setup !== undefined ? input.setup : current.setup,
    tags: input.tags ?? current.tags,
    notes: input.notes !== undefined ? input.notes : current.notes,
  };

  const hasExit = merged.exitPrice != null;
  const hasClosedAt = merged.closedAt != null;
  if (hasExit !== hasClosedAt) throw new Error("INVALID_CLOSED_STATE");

  if (
    merged.closedAt &&
    new Date(merged.closedAt).getTime() < new Date(merged.openedAt).getTime()
  ) {
    throw new Error("INVALID_CLOSED_TIME");
  }

  await assertOwnedRelations(userId, merged.challengeId, merged.tradingAccountId);
  const m = metrics(merged);

  const rows = await db.update(trades).set({
    challengeId: merged.challengeId,
    tradingAccountId: merged.tradingAccountId,
    instrument: merged.instrument,
    direction: merged.direction,
    status: m.status,
    openedAt: new Date(merged.openedAt),
    closedAt: merged.closedAt ? new Date(merged.closedAt) : null,
    entryPrice: String(merged.entryPrice),
    stopPrice: merged.stopPrice == null ? null : String(merged.stopPrice),
    targetPrice: merged.targetPrice == null ? null : String(merged.targetPrice),
    exitPrice: merged.exitPrice == null ? null : String(merged.exitPrice),
    contracts: merged.contracts,
    commissionFeesCents: dollarsToCents(merged.commissionFees),
    grossPnlCents: m.grossPnlCents,
    netPnlCents: m.netPnlCents,
    initialRiskCents: m.initialRiskCents,
    rMultiple: m.rMultiple,
    outcome: m.outcome,
    setup: merged.setup,
    tags: merged.tags,
    notes: merged.notes,
    updatedAt: new Date(),
  }).where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .returning();

  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function deleteTrade(userId: string, tradeId: string) {
  const rows = await db.delete(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
    .returning({ id: trades.id });
  return rows[0] ?? null;
}
