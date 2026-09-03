CREATE TYPE "public"."user_plan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
CREATE TABLE "user_plans" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "plan" "user_plan" DEFAULT 'FREE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_plans_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
INSERT INTO "user_plans" ("user_id", "plan")
SELECT "id", 'PRO'::"user_plan"
FROM "users"
WHERE "role" = 'CREATOR'
ON CONFLICT ("user_id") DO UPDATE
SET "plan" = 'PRO'::"user_plan", "updated_at" = now();
