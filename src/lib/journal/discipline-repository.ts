import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trades } from "@/db/schema";
import { getTrade } from "./repository";

export async function updateClosedTradeDisciplineTags(
  userId: string,
  tradeId: string,
  tags: string[],
) {
  const current = await getTrade(userId, tradeId);
  if (!current) return null;

  if (current.status !== "CLOSED") {
    throw new Error("TRADE_NOT_CLOSED");
  }

  await db
    .update(trades)
    .set({
      tags,
      updatedAt: new Date(),
    })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));

  return getTrade(userId, tradeId);
}
