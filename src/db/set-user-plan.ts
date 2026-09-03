import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { userPlans } from "./user-plans-schema";
import type { UserPlan } from "@/lib/monetization/types";

function parsePlan(raw: string | undefined): UserPlan {
  const value = raw?.trim().toUpperCase();
  if (value === "FREE" || value === "PRO") return value;
  throw new Error("Plan must be FREE or PRO.");
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const plan = parsePlan(process.argv[3]);

  if (!email) {
    throw new Error(
      "Usage: npx tsx --env-file=.env.local src/db/set-user-plan.ts user@example.com PRO",
    );
  }

  const matches = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = matches[0];
  if (!user) throw new Error(`No FFZ user found for ${email}`);

  if (user.role === "CREATOR" && plan !== "PRO") {
    throw new Error("CREATOR accounts must remain on the PRO plan.");
  }

  const now = new Date();
  const rows = await db
    .insert(userPlans)
    .values({ userId: user.id, plan, updatedAt: now })
    .onConflictDoUpdate({
      target: userPlans.userId,
      set: { plan, updatedAt: now },
    })
    .returning({ plan: userPlans.plan });

  console.log(`Plan updated: ${user.email} -> ${rows[0]?.plan ?? plan}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
