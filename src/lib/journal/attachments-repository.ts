import { and, asc, count, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { tradeAttachments } from "@/db/schema";
import type { TradeAttachmentApiModel } from "./types";

function toApiModel(
  row: typeof tradeAttachments.$inferSelect,
): TradeAttachmentApiModel {
  return {
    id: row.id,
    tradeId: row.tradeId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTradeAttachments(
  userId: string,
  tradeId: string,
) {
  const rows = await db
    .select()
    .from(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    )
    .orderBy(
      asc(tradeAttachments.sortOrder),
      asc(tradeAttachments.createdAt),
    );

  return rows.map(toApiModel);
}

export async function countTradeAttachments(
  userId: string,
  tradeId: string,
) {
  const rows = await db
    .select({
      value: count(tradeAttachments.id),
    })
    .from(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    );

  return Number(rows[0]?.value ?? 0);
}

export async function nextTradeAttachmentSortOrder(
  userId: string,
  tradeId: string,
) {
  const rows = await db
    .select({
      value: max(tradeAttachments.sortOrder),
    })
    .from(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    );

  return Number(rows[0]?.value ?? -1) + 1;
}

export async function createTradeAttachment(
  userId: string,
  tradeId: string,
  input: {
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    sortOrder: number;
  },
) {
  const rows = await db
    .insert(tradeAttachments)
    .values({
      userId,
      tradeId,
      storageKey: input.storageKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      sortOrder: input.sortOrder,
    })
    .returning();

  return toApiModel(rows[0]);
}

export async function getTradeAttachment(
  userId: string,
  tradeId: string,
  attachmentId: string,
) {
  const rows = await db
    .select()
    .from(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.id, attachmentId),
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function deleteTradeAttachment(
  userId: string,
  tradeId: string,
  attachmentId: string,
) {
  const rows = await db
    .delete(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.id, attachmentId),
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    )
    .returning({
      id: tradeAttachments.id,
      storageKey: tradeAttachments.storageKey,
    });

  return rows[0] ?? null;
}


export async function listTradeAttachmentStorageKeys(
  userId: string,
  tradeId: string,
) {
  const rows = await db
    .select({
      storageKey: tradeAttachments.storageKey,
    })
    .from(tradeAttachments)
    .where(
      and(
        eq(tradeAttachments.userId, userId),
        eq(tradeAttachments.tradeId, tradeId),
      ),
    );

  return rows.map((row) => row.storageKey);
}
