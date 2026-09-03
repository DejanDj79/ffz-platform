import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userPlanEnum = pgEnum("user_plan", ["FREE", "PRO"]);

export const userPlans = pgTable("user_plans", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: userPlanEnum("plan").notNull().default("FREE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserPlanRow = typeof userPlans.$inferSelect;
export type NewUserPlanRow = typeof userPlans.$inferInsert;
