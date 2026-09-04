CREATE TABLE "founder_slots" (
  "slot_no" integer PRIMARY KEY NOT NULL,
  "user_id" uuid,
  "status" varchar(16) DEFAULT 'AVAILABLE' NOT NULL,
  "reservation_token" uuid,
  "reservation_expires_at" timestamp with time zone,
  "checkout_url" text,
  "provider_order_id" varchar(80),
  "provider_customer_id" varchar(80),
  "provider_product_id" varchar(80),
  "provider_variant_id" varchar(80),
  "purchase_test_mode" boolean,
  "purchased_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "founder_slots_slot_range" CHECK ("slot_no" BETWEEN 1 AND 150),
  CONSTRAINT "founder_slots_status_check" CHECK ("status" IN ('AVAILABLE', 'RESERVED', 'PURCHASED', 'REFUNDED'))
);
--> statement-breakpoint
ALTER TABLE "founder_slots" ADD CONSTRAINT "founder_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_slots_user_unique" ON "founder_slots" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_slots_reservation_token_unique" ON "founder_slots" USING btree ("reservation_token");
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_slots_provider_order_unique" ON "founder_slots" USING btree ("provider_order_id");
--> statement-breakpoint
INSERT INTO "founder_slots" ("slot_no") SELECT generate_series(1, 150);
