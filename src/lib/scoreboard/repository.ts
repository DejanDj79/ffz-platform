import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  scoreboardSettings,
} from "@/db/schema";
import { getChallenge } from "@/lib/challenges/repository";
import type {
  ScoreboardSettingsApiModel,
  UpdateScoreboardSettingsInput,
} from "./types";

function toApiModel(
  row: typeof scoreboardSettings.$inferSelect,
): ScoreboardSettingsApiModel {
  return {
    id: row.id,
    overlayKey: row.overlayKey,
    challengeId: row.challengeId,
    layout: row.layout as "COMPACT" | "FULL",
    goalLabel: row.goalLabel,
    refreshSeconds: row.refreshSeconds,
    isEnabled: row.isEnabled,

    showBalance: row.showBalance,
    showChallengePnl: row.showChallengePnl,
    showTargetProgress: row.showTargetProgress,
    showTradeCount: row.showTradeCount,
    showWinRate: row.showWinRate,
    showAverageR: row.showAverageR,
    showRealMoneyNet: row.showRealMoneyNet,
    showRealPayouts: row.showRealPayouts,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findByUser(userId: string) {
  const rows = await db
    .select()
    .from(scoreboardSettings)
    .where(eq(scoreboardSettings.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getOrCreateScoreboardSettings(
  userId: string,
): Promise<ScoreboardSettingsApiModel> {
  let row = await findByUser(userId);

  if (!row) {
    const created = await db
      .insert(scoreboardSettings)
      .values({ userId })
      .onConflictDoNothing({
        target: scoreboardSettings.userId,
      })
      .returning();

    row = created[0] ?? (await findByUser(userId));
  }

  if (!row) {
    throw new Error("Unable to create scoreboard settings.");
  }

  return toApiModel(row);
}

export async function updateScoreboardSettings(
  userId: string,
  input: UpdateScoreboardSettingsInput,
) {
  await getOrCreateScoreboardSettings(userId);

  if (input.challengeId) {
    const challenge = await getChallenge(
      userId,
      input.challengeId,
    );

    if (!challenge) {
      throw new Error("CHALLENGE_NOT_FOUND");
    }
  }

  const values: Partial<typeof scoreboardSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.challengeId !== undefined)
    values.challengeId = input.challengeId;

  if (input.layout !== undefined)
    values.layout = input.layout;

  if (input.goalLabel !== undefined)
    values.goalLabel = input.goalLabel;

  if (input.refreshSeconds !== undefined)
    values.refreshSeconds = input.refreshSeconds;

  if (input.isEnabled !== undefined)
    values.isEnabled = input.isEnabled;

  if (input.showBalance !== undefined)
    values.showBalance = input.showBalance;

  if (input.showChallengePnl !== undefined)
    values.showChallengePnl = input.showChallengePnl;

  if (input.showTargetProgress !== undefined)
    values.showTargetProgress = input.showTargetProgress;

  if (input.showTradeCount !== undefined)
    values.showTradeCount = input.showTradeCount;

  if (input.showWinRate !== undefined)
    values.showWinRate = input.showWinRate;

  if (input.showAverageR !== undefined)
    values.showAverageR = input.showAverageR;

  if (input.showRealMoneyNet !== undefined)
    values.showRealMoneyNet = input.showRealMoneyNet;

  if (input.showRealPayouts !== undefined)
    values.showRealPayouts = input.showRealPayouts;

  const rows = await db
    .update(scoreboardSettings)
    .set(values)
    .where(eq(scoreboardSettings.userId, userId))
    .returning();

  if (!rows[0]) {
    throw new Error("Unable to update scoreboard settings.");
  }

  return toApiModel(rows[0]);
}

export async function rotateScoreboardKey(userId: string) {
  await getOrCreateScoreboardSettings(userId);

  const rows = await db
    .update(scoreboardSettings)
    .set({
      overlayKey: randomUUID(),
      updatedAt: new Date(),
    })
    .where(eq(scoreboardSettings.userId, userId))
    .returning();

  if (!rows[0]) {
    throw new Error("Unable to rotate scoreboard key.");
  }

  return toApiModel(rows[0]);
}

export async function getScoreboardSettingsByOverlayKey(
  overlayKey: string,
) {
  const rows = await db
    .select()
    .from(scoreboardSettings)
    .where(eq(scoreboardSettings.overlayKey, overlayKey))
    .limit(1);

  return rows[0] ? toApiModel(rows[0]) : null;
}
