import { eq, ne } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

async function main() {
  const requestedEmail = process.argv[2]?.trim().toLowerCase();

  if (requestedEmail) {
    const rows = await db
      .update(users)
      .set({
        role: "CREATOR",
        updatedAt: new Date(),
      })
      .where(eq(users.email, requestedEmail))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      });

    if (!rows[0]) {
      throw new Error(`No FFZ user found for ${requestedEmail}`);
    }

    console.log("CREATOR role granted:");
    console.log(rows[0]);
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

  const user = realUsers[0];

  const rows = await db
    .update(users)
    .set({
      role: "CREATOR",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    });

  console.log("CREATOR role granted:");
  console.log(rows[0]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
