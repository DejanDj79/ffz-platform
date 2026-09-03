import { eq, ne } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { userPlans } from "./user-plans-schema";

async function grantCreator(userId: string) {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        role: "CREATOR",
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    await tx
      .insert(userPlans)
      .values({
        userId,
        plan: "PRO",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPlans.userId,
        set: {
          plan: "PRO",
          updatedAt: now,
        },
      });
  });

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      plan: userPlans.plan,
    })
    .from(users)
    .leftJoin(userPlans, eq(userPlans.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0];
}

async function main() {
  const requestedEmail = process.argv[2]?.trim().toLowerCase();

  if (requestedEmail) {
    const matches = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, requestedEmail))
      .limit(1);

    if (!matches[0]) {
      throw new Error(`No FFZ user found for ${requestedEmail}`);
    }

    const user = await grantCreator(matches[0].id);
    console.log("CREATOR role + PRO plan granted:");
    console.log(user);
    return;
  }

  const realUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(users)
    .where(ne(users.email, "dev@ffz.local"));

  if (realUsers.length === 0) {
    throw new Error(
      "No real FFZ users found. Register first, then run this command again.",
    );
  }

  if (realUsers.length > 1) {
    console.log("More than one real FFZ account exists:");
    for (const user of realUsers) {
      console.log(`- ${user.email} (${user.role})`);
    }

    console.log(
      "\nRun again with the creator email:\n" +
        "npx tsx --env-file=.env.local src/db/make-creator.ts you@example.com",
    );
    process.exitCode = 1;
    return;
  }

  const user = await grantCreator(realUsers[0].id);
  console.log("CREATOR role + PRO plan granted:");
  console.log(user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
