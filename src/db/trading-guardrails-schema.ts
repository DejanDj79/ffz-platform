import { jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";
import type { TradingGuardrailSettings } from "@/lib/trading/guardrails-types";

export const tradingGuardrailSettings = pgTable(
  "trading_guardrail_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    settings: jsonb("settings").$type<TradingGuardrailSettings>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("trading_guardrail_settings_user_unique").on(table.userId),
  }),
);

export type TradingGuardrailSettingsRow = typeof tradingGuardrailSettings.$inferSelect;
export type NewTradingGuardrailSettingsRow = typeof tradingGuardrailSettings.$inferInsert;
