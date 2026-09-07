import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./token";
import { sendPasswordResetEmail } from "./reset-mail";

export async function requestPasswordReset(email: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const issued = await db.transaction(async (tx) => {
    // Serialize requests and resets for this account, including across workers.
    const [user] = await tx.select({ id: users.id, passwordHash: users.passwordHash })
      .from(users).where(eq(users.email, email)).for("update");
    if (!user?.passwordHash) return false;
    const [recent] = await tx.select().from(passwordResetTokens).where(and(
      eq(passwordResetTokens.userId, user.id),
      gt(passwordResetTokens.createdAt, sql`now() - interval '5 minutes'`),
    ));
    if (recent) return false;
    await tx.insert(passwordResetTokens).values({
      userId: user.id, tokenHash, expiresAt: sql`now() + interval '30 minutes'`,
    }).onConflictDoUpdate({ target: passwordResetTokens.userId, set: {
      tokenHash, expiresAt: sql`now() + interval '30 minutes'`, createdAt: sql`now()`,
    } });
    return true;
  });
  if (!issued) return;
  try {
    await sendPasswordResetEmail(email, token);
  } catch {
    // Only remove our failed token, never a subsequently issued replacement.
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    throw new Error("Password reset email delivery failed");
  }
}

export async function completePasswordReset(token: string, password: string) {
  const tokenHash = hashSessionToken(token);
  const [candidate] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, sql`now()`),
  ));
  if (!candidate) return false;
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.id, candidate.userId)).for("update");
    if (!user) return false;
    // Atomic consumption: two submissions of the same token cannot both succeed.
    const consumed = await tx.delete(passwordResetTokens).where(and(
      eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.tokenHash, tokenHash),
      gt(passwordResetTokens.expiresAt, sql`clock_timestamp()`),
    )).returning({ userId: passwordResetTokens.userId });
    if (!consumed.length) return false;
    await tx.update(users).set({ passwordHash, updatedAt: sql`now()` }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return true;
  });
}
