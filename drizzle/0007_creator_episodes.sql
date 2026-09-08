CREATE TABLE "creator_episodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "challenge_id" uuid,
  "title" varchar(180) NOT NULL,
  "status" varchar(24) DEFAULT 'DRAFT' NOT NULL,
  "source" varchar(24) DEFAULT 'BUILDER' NOT NULL,
  "period_from" timestamp with time zone NOT NULL,
  "period_to" timestamp with time zone NOT NULL,
  "brief" text DEFAULT '' NOT NULL,
  "story_angle" text,
  "script" text,
  "featured_trade_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_episodes" ADD CONSTRAINT "creator_episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creator_episodes" ADD CONSTRAINT "creator_episodes_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "creator_episodes_user_idx" ON "creator_episodes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "creator_episodes_challenge_idx" ON "creator_episodes" USING btree ("challenge_id");
--> statement-breakpoint
CREATE INDEX "creator_episodes_period_idx" ON "creator_episodes" USING btree ("period_from","period_to");
--> statement-breakpoint
CREATE INDEX "creator_episodes_updated_idx" ON "creator_episodes" USING btree ("updated_at");
