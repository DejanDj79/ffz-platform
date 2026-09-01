import { eq, ne } from "drizzle-orm";
import { db, sql } from "./client";
import { challenges, users } from "./schema";
import { dollarsToCents } from "./money";

const DEV_EMAIL = "dev@ffz.local";

async function main() {
  const realUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.email, DEV_EMAIL))
    .limit(1);

  if (realUsers[0]) {
    console.log("Seed skipped: a real development account already exists.");
    return;
  }

  const existingUsers = await db.select().from(users).where(eq(users.email, DEV_EMAIL)).limit(1);
  const devUser = existingUsers[0] ?? (await db.insert(users).values({ email: DEV_EMAIL, displayName: "FFZ Dev User" }).returning())[0];

  const existingChallenges = await db.select().from(challenges).where(eq(challenges.userId, devUser.id)).limit(1);

  if (existingChallenges.length === 0) {
    await db.insert(challenges).values({
      userId: devUser.id,
      rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
      propFirm: "Blue Guardian Futures",
      name: "Standard 25K #1",
      status: "NOT_STARTED",
      phase: "EVALUATION",
      drawdownType: "EOD_TRAILING",
      dailyLossBreachType: "NONE",

      accountSizeCents: dollarsToCents(25_000),
      startingBalanceCents: dollarsToCents(25_000),
      currentBalanceCents: dollarsToCents(25_000),
      highestEodBalanceCents: dollarsToCents(25_000),
      todayPnlCents: 0,

      profitTargetCents: dollarsToCents(1_500),
      maxDrawdownCents: dollarsToCents(1_500),
      drawdownLockFloorOffsetCents: 0,
      dailyLossLimitCents: null,

      challengeFeeCents: 0,
      resetFeeCents: 0,
      maxMiniContracts: 1,
      maxMicroContracts: 10,
      daysTraded: 0,
      notes: "Development seed challenge.",
    });
  }

  // Backfill rule metadata for an already-existing Blue Guardian dev challenge
  // without overwriting editable balances, fees or the currently disputed max drawdown.
  await db.update(challenges)
    .set({
      drawdownType: "EOD_TRAILING",
      dailyLossBreachType: "NONE",
      drawdownLockFloorOffsetCents: 0,
      maxMiniContracts: 1,
      maxMicroContracts: 10,
      updatedAt: new Date(),
    })
    .where(eq(challenges.rulesPresetId, "BLUE_GUARDIAN_FUTURES_STANDARD_25K"));

  console.log(`Seed complete. Development user: ${DEV_EMAIL}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await sql.end(); });
