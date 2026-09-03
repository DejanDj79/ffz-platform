import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { centsToDollars, dollarsToCents } from "@/db/money";
import {
  challenges,
  ledgerEntries,
  tradingAccounts,
} from "@/db/schema";
import { syncChallengesFromJournal } from "@/lib/challenges/journal-sync";
import type {
  LedgerCategory,
  LedgerEntryApiModel,
  LedgerEntryInput,
  UpdateLedgerEntryInput,
} from "./types";

type LedgerWriteOptions = {
  syncChallenges?: boolean;
};

function toApiModel(
  row: typeof ledgerEntries.$inferSelect,
): LedgerEntryApiModel {
  return {
    id: row.id,

    challengeId: row.challengeId,
    tradingAccountId: row.tradingAccountId,

    entryType: row.entryType,
    category: row.category as LedgerCategory,

    occurredAt: row.occurredAt.toISOString(),
    amount: centsToDollars(row.amountCents) ?? 0,
    currency: row.currency,

    provider: row.provider,
    description: row.description,
    reference: row.reference,
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
    const rows = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(
        and(
          eq(challenges.id, challengeId),
          eq(challenges.userId, userId),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      throw new Error("CHALLENGE_NOT_FOUND");
    }
  }

  if (tradingAccountId) {
    const rows = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(
        and(
          eq(tradingAccounts.id, tradingAccountId),
          eq(tradingAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      throw new Error("TRADING_ACCOUNT_NOT_FOUND");
    }
  }
}

export async function listLedgerEntries(userId: string) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId))
    .orderBy(desc(ledgerEntries.occurredAt));

  return rows.map(toApiModel);
}

export async function getLedgerEntry(
  userId: string,
  entryId: string,
) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.id, entryId),
        eq(ledgerEntries.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function createLedgerEntry(
  userId: string,
  input: LedgerEntryInput,
  options: LedgerWriteOptions = {},
) {
  await assertOwnedRelations(
    userId,
    input.challengeId,
    input.tradingAccountId,
  );

  const rows = await db
    .insert(ledgerEntries)
    .values({
      userId,

      challengeId: input.challengeId,
      tradingAccountId: input.tradingAccountId,

      entryType: input.entryType,
      category: input.category,

      occurredAt: new Date(input.occurredAt),
      amountCents: dollarsToCents(input.amount),
      currency: input.currency,

      provider: input.provider,
      description: input.description,
      reference: input.reference,
      notes: input.notes,

      updatedAt: new Date(),
    })
    .returning();

  const created = toApiModel(rows[0]);
  if (
    options.syncChallenges !== false &&
    created.entryType === "INCOME" &&
    created.category === "PAYOUT"
  ) {
    await syncChallengesFromJournal(userId, [created.challengeId], new Date(), true);
  }
  return created;
}

export async function updateLedgerEntry(
  userId: string,
  entryId: string,
  input: UpdateLedgerEntryInput,
  options: LedgerWriteOptions = {},
) {
  const current = await getLedgerEntry(userId, entryId);
  if (!current) return null;

  const merged: LedgerEntryInput = {
    challengeId:
      input.challengeId !== undefined
        ? input.challengeId
        : current.challengeId,

    tradingAccountId:
      input.tradingAccountId !== undefined
        ? input.tradingAccountId
        : current.tradingAccountId,

    entryType: input.entryType ?? current.entryType,
    category: input.category ?? current.category,

    occurredAt: input.occurredAt ?? current.occurredAt,
    amount: input.amount ?? current.amount,
    currency: input.currency ?? current.currency,

    provider:
      input.provider !== undefined
        ? input.provider
        : current.provider,

    description:
      input.description !== undefined
        ? input.description
        : current.description,

    reference:
      input.reference !== undefined
        ? input.reference
        : current.reference,

    notes:
      input.notes !== undefined
        ? input.notes
        : current.notes,
  };

  await assertOwnedRelations(
    userId,
    merged.challengeId,
    merged.tradingAccountId,
  );

  const rows = await db
    .update(ledgerEntries)
    .set({
      challengeId: merged.challengeId,
      tradingAccountId: merged.tradingAccountId,

      entryType: merged.entryType,
      category: merged.category,

      occurredAt: new Date(merged.occurredAt),
      amountCents: dollarsToCents(merged.amount),
      currency: merged.currency,

      provider: merged.provider,
      description: merged.description,
      reference: merged.reference,
      notes: merged.notes,

      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ledgerEntries.id, entryId),
        eq(ledgerEntries.userId, userId),
      ),
    )
    .returning();

  const updated = rows[0] ? toApiModel(rows[0]) : null;
  const currentWasPayout = current.entryType === "INCOME" && current.category === "PAYOUT";
  const updatedIsPayout = updated?.entryType === "INCOME" && updated.category === "PAYOUT";
  if (options.syncChallenges !== false && (currentWasPayout || updatedIsPayout)) {
    await syncChallengesFromJournal(
      userId,
      [current.challengeId, updated?.challengeId],
      new Date(),
      true,
    );
  }

  return updated;
}

export async function deleteLedgerEntry(
  userId: string,
  entryId: string,
  options: LedgerWriteOptions = {},
) {
  const current = await getLedgerEntry(userId, entryId);
  if (!current) return null;

  const rows = await db
    .delete(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.id, entryId),
        eq(ledgerEntries.userId, userId),
      ),
    )
    .returning({ id: ledgerEntries.id });

  if (
    rows[0] &&
    options.syncChallenges !== false &&
    current.entryType === "INCOME" &&
    current.category === "PAYOUT"
  ) {
    await syncChallengesFromJournal(userId, [current.challengeId], new Date(), true);
  }

  return rows[0] ?? null;
}
