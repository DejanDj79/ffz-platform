import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const weeklyFocuses = pgTable(
  "weekly_focuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Monday in the user's local Weekly Review semantics, stored as YYYY-MM-DD.
    weekStart: varchar("week_start", { length: 10 }).notNull(),
    primaryFocus: varchar("primary_focus", { length: 180 }).notNull(),
    rule: text("rule").notNull(),
    whyItMatters: text("why_it_matters"),
    sourceSignalKey: varchar("source_signal_key", { length: 40 }),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userWeekUnique: uniqueIndex("weekly_focuses_user_week_unique").on(table.userId, table.weekStart),
    userIdx: index("weekly_focuses_user_idx").on(table.userId),
    weekIdx: index("weekly_focuses_week_start_idx").on(table.weekStart),
  }),
);

export type WeeklyFocusRow = typeof weeklyFocuses.$inferSelect;
export type NewWeeklyFocusRow = typeof weeklyFocuses.$inferInsert;
