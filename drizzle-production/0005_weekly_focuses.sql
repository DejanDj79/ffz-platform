CREATE TABLE "weekly_focuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "week_start" varchar(10) NOT NULL,
  "primary_focus" varchar(180) NOT NULL,
  "rule" text NOT NULL,
  "why_it_matters" text,
  "source_signal_key" varchar(40),
  "status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_focuses" ADD CONSTRAINT "weekly_focuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_focuses_user_week_unique" ON "weekly_focuses" USING btree ("user_id","week_start");
--> statement-breakpoint
CREATE INDEX "weekly_focuses_user_idx" ON "weekly_focuses" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "weekly_focuses_week_start_idx" ON "weekly_focuses" USING btree ("week_start");
