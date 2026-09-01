import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges, tradingAccounts, users } from "@/db/schema";

const DEV_EMAIL = "dev@ffz.local";

/**
 * Local-development convenience:
 * the project previously stored all challenge data under dev@ffz.local.
 * On the first real registration, move that data to the new account.
 *
 * This never runs in production.
 */
export async function claimLegacyDevData(newUserId: string, newUserEmail: string) {
  if (process.env.NODE_ENV === "production") return;
  if (newUserEmail.toLowerCase() === DEV_EMAIL) return;

  const devRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEV_EMAIL))
    .limit(1);

  const devUser = devRows[0];
  if (!devUser || devUser.id === newUserId) return;

  await db.transaction(async (tx) => {
    await tx
      .update(tradingAccounts)
      .set({ userId: newUserId, updatedAt: new Date() })
      .where(eq(tradingAccounts.userId, devUser.id));

    await tx
      .update(challenges)
      .set({ userId: newUserId, updatedAt: new Date() })
      .where(eq(challenges.userId, devUser.id));
  });
}
