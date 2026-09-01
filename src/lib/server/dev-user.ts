import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export const DEV_USER_EMAIL = "dev@ffz.local";

export async function getOrCreateDevUser() {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_USER_EMAIL))
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(users)
    .values({
      email: DEV_USER_EMAIL,
      displayName: "FFZ Dev User",
    })
    .returning();

  return inserted[0];
}
