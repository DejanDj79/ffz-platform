import { z } from "zod";
import { WEEKLY_FOCUS_SIGNAL_KEYS, WEEKLY_FOCUS_STATUSES } from "./types";

const weekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD.");

export const weeklyFocusSaveSchema = z.object({
  weekStart: weekStartSchema,
  primaryFocus: z.string().trim().min(3).max(180),
  rule: z.string().trim().min(3).max(1000),
  whyItMatters: z.string().trim().max(1000).nullable().optional(),
  sourceSignalKey: z.enum(WEEKLY_FOCUS_SIGNAL_KEYS).nullable().optional(),
  status: z.enum(WEEKLY_FOCUS_STATUSES).optional().default("ACTIVE"),
});

export const weeklyFocusWeekStartSchema = weekStartSchema;
