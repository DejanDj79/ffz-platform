ALTER TABLE "user_plans" ADD COLUMN "billing_provider" varchar(32);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "provider_customer_id" varchar(80);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "provider_subscription_id" varchar(80);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "provider_product_id" varchar(80);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "provider_variant_id" varchar(80);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "subscription_status" varchar(32);--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "subscription_renews_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "subscription_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "subscription_test_mode" boolean;--> statement-breakpoint
ALTER TABLE "user_plans" ADD COLUMN "provider_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_plans_provider_subscription_unique" ON "user_plans" USING btree ("provider_subscription_id");
