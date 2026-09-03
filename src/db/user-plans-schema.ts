import {
  boolean,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

export const userPlanEnum = pgEnum("user_plan", ["FREE", "PRO"]);

export const userPlans = pgTable(
  "user_plans",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: userPlanEnum("plan").notNull().default("FREE"),

    billingProvider: varchar("billing_provider", { length: 32 }),
    providerCustomerId: varchar("provider_customer_id", { length: 80 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 80 }),
    providerProductId: varchar("provider_product_id", { length: 80 }),
    providerVariantId: varchar("provider_variant_id", { length: 80 }),
    subscriptionStatus: varchar("subscription_status", { length: 32 }),
    subscriptionRenewsAt: timestamp("subscription_renews_at", { withTimezone: true }),
    subscriptionEndsAt: timestamp("subscription_ends_at", { withTimezone: true }),
    subscriptionTestMode: boolean("subscription_test_mode"),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerSubscriptionUnique: uniqueIndex("user_plans_provider_subscription_unique")
      .on(table.providerSubscriptionId),
  }),
);

export type UserPlanRow = typeof userPlans.$inferSelect;
export type NewUserPlanRow = typeof userPlans.$inferInsert;
