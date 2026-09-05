import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weeklyFocuses } from "@/db/weekly-focus-schema";
import type {
  SaveWeeklyFocusInput,
  WeeklyFocusApiModel,
  WeeklyFocusSignalKey,
  WeeklyFocusStatus,
} from "./types";
import { weeklyFocusSaveSchema, weeklyFocusWeekStartSchema } from "./validation";

function toApiModel(row: typeof weeklyFocuses.$inferSelect): WeeklyFocusApiModel {
  return {
    id: row.id,
    weekStart: row.weekStart,
    primaryFocus: row.primaryFocus,
    rule: row.rule,
    whyItMatters: row.whyItMatters,
    sourceSignalKey: row.sourceSignalKey as WeeklyFocusSignalKey | null,
    status: row.status as WeeklyFocusStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getWeeklyFocus(userId: string, weekStartInput: string) {
  const weekStart = weeklyFocusWeekStartSchema.parse(weekStartInput);
  const rows = await db
    .select()
    .from(weeklyFocuses)
    .where(and(eq(weeklyFocuses.userId, userId), eq(weeklyFocuses.weekStart, weekStart)))
    .limit(1);

  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function saveWeeklyFocus(
  userId: string,
  input: SaveWeeklyFocusInput,
): Promise<WeeklyFocusApiModel> {
  const parsed = weeklyFocusSaveSchema.parse(input);
  const now = new Date();

  const rows = await db
    .insert(weeklyFocuses)
    .values({
      userId,
      weekStart: parsed.weekStart,
      primaryFocus: parsed.primaryFocus,
      rule: parsed.rule,
      whyItMatters: parsed.whyItMatters || null,
      sourceSignalKey: parsed.sourceSignalKey ?? null,
      status: parsed.status,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [weeklyFocuses.userId, weeklyFocuses.weekStart],
      set: {
        primaryFocus: parsed.primaryFocus,
        rule: parsed.rule,
        whyItMatters: parsed.whyItMatters || null,
        sourceSignalKey: parsed.sourceSignalKey ?? null,
        status: parsed.status,
        updatedAt: now,
      },
    })
    .returning();

  if (!rows[0]) throw new Error("Unable to save weekly focus.");
  return toApiModel(rows[0]);
}
