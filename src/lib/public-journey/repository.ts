import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { listChallenges } from "@/lib/challenges/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";
import { buildPublicJourneyData } from "./data";

export async function getPublicJourneyData() {
  const creatorRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "CREATOR"))
    .orderBy(asc(users.createdAt))
    .limit(1);

  const creator = creatorRows[0];
  if (!creator) return null;

  const [entries, challenges] = await Promise.all([
    listLedgerEntries(creator.id),
    listChallenges(creator.id, { syncFromJournal: false }),
  ]);

  return buildPublicJourneyData(
    null,
    entries,
    challenges,
  );
}
