import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges } from "@/db/schema";
import { creatorEpisodes } from "@/db/creator-episodes-schema";
import type {
  CreateCreatorEpisodeInput,
  CreatorEpisodeApiModel,
  CreatorEpisodeSource,
  CreatorEpisodeStatus,
} from "./episodes-types";
import { creatorEpisodeCreateSchema } from "./episodes-validation";

function toApiModel(row: typeof creatorEpisodes.$inferSelect): CreatorEpisodeApiModel {
  return {
    id: row.id,
    challengeId: row.challengeId,
    title: row.title,
    status: row.status as CreatorEpisodeStatus,
    source: row.source as CreatorEpisodeSource,
    periodFrom: row.periodFrom.toISOString(),
    periodTo: row.periodTo.toISOString(),
    brief: row.brief,
    storyAngle: row.storyAngle,
    script: row.script,
    featuredTradeIds: Array.isArray(row.featuredTradeIds) ? row.featuredTradeIds : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertOwnedChallenge(userId: string, challengeId: string | null) {
  if (!challengeId) return;

  const rows = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.userId, userId)))
    .limit(1);

  if (!rows[0]) throw new Error("CHALLENGE_NOT_FOUND");
}

export async function listCreatorEpisodes(
  userId: string,
  limit = 12,
): Promise<CreatorEpisodeApiModel[]> {
  const rows = await db
    .select()
    .from(creatorEpisodes)
    .where(eq(creatorEpisodes.userId, userId))
    .orderBy(desc(creatorEpisodes.updatedAt))
    .limit(Math.max(1, Math.min(limit, 50)));

  return rows.map(toApiModel);
}

export async function getCreatorEpisode(
  userId: string,
  episodeId: string,
): Promise<CreatorEpisodeApiModel | null> {
  const rows = await db
    .select()
    .from(creatorEpisodes)
    .where(and(eq(creatorEpisodes.id, episodeId), eq(creatorEpisodes.userId, userId)))
    .limit(1);

  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function createCreatorEpisode(
  userId: string,
  input: CreateCreatorEpisodeInput,
): Promise<CreatorEpisodeApiModel> {
  const parsed = creatorEpisodeCreateSchema.parse(input);
  await assertOwnedChallenge(userId, parsed.challengeId);

  const rows = await db
    .insert(creatorEpisodes)
    .values({
      userId,
      challengeId: parsed.challengeId,
      title: parsed.title,
      status: "DRAFT",
      source: parsed.source,
      periodFrom: new Date(parsed.periodFrom),
      periodTo: new Date(parsed.periodTo),
      brief: parsed.brief,
      storyAngle: null,
      script: null,
      featuredTradeIds: [],
      updatedAt: new Date(),
    })
    .returning();

  if (!rows[0]) throw new Error("Unable to create Creator episode.");
  return toApiModel(rows[0]);
}
