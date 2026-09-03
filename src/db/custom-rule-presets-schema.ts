import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./schema";
import type { CustomRuleVariant } from "@/lib/prop-firms/custom-types";

export const customRulePresets = pgTable(
  "custom_rule_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    propFirm: varchar("prop_firm", { length: 160 }).notNull(),
    variants: jsonb("variants").$type<CustomRuleVariant[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("custom_rule_presets_user_idx").on(table.userId),
  }),
);

export type CustomRulePresetRow = typeof customRulePresets.$inferSelect;
export type NewCustomRulePresetRow = typeof customRulePresets.$inferInsert;
