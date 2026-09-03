import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

export type FounderSlotStatus = "AVAILABLE" | "RESERVED" | "PURCHASED" | "REFUNDED";

export const founderSlots = pgTable(
  "founder_slots",
  {
    slotNo: integer("slot_no").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 16 }).notNull().default("AVAILABLE"),

    reservationToken: uuid("reservation_token"),
    reservationExpiresAt: timestamp("reservation_expires_at", { withTimezone: true }),
    checkoutUrl: text("checkout_url"),

    providerOrderId: varchar("provider_order_id", { length: 80 }),
    providerCustomerId: varchar("provider_customer_id", { length: 80 }),
    providerProductId: varchar("provider_product_id", { length: 80 }),
    providerVariantId: varchar("provider_variant_id", { length: 80 }),
    purchaseTestMode: boolean("purchase_test_mode"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slotRange: check(
      "founder_slots_slot_range",
      sql`${table.slotNo} BETWEEN 1 AND 150`,
    ),
    statusCheck: check(
      "founder_slots_status_check",
      sql`${table.status} IN ('AVAILABLE', 'RESERVED', 'PURCHASED', 'REFUNDED')`,
    ),
    userUnique: uniqueIndex("founder_slots_user_unique").on(table.userId),
    reservationTokenUnique: uniqueIndex("founder_slots_reservation_token_unique").on(table.reservationToken),
    providerOrderUnique: uniqueIndex("founder_slots_provider_order_unique").on(table.providerOrderId),
  }),
);

export type FounderSlotRow = typeof founderSlots.$inferSelect;
