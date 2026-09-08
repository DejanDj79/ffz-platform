import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { challenges, users } from "./schema";

export const creatorEpisodes = pgTable(
  "creator_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id").references(() => challenges.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 180 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
    source: varchar("source", { length: 24 }).notNull().default("BUILDER"),
    periodFrom: timestamp("period_from", { withTimezone: true }).notNull(),
    periodTo: timestamp("period_to", { withTimezone: true }).notNull(),
    brief: text("brief").notNull().default(""),
    storyAngle: text("story_angle"),
    script: text("script"),
    featuredTradeIds: jsonb("featured_trade_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_episodes_user_idx").on(table.userId),
    challengeIdx: index("creator_episodes_challenge_idx").on(table.challengeId),
    periodIdx: index("creator_episodes_period_idx").on(table.periodFrom, table.periodTo),
    updatedIdx: index("creator_episodes_updated_idx").on(table.updatedAt),
  }),
);

export type CreatorEpisodeRow = typeof creatorEpisodes.$inferSelect;
export type NewCreatorEpisodeRow = typeof creatorEpisodes.$inferInsert;
