CREATE TABLE IF NOT EXISTS "custom_rule_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "prop_firm" varchar(160) NOT NULL,
  "variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "custom_rule_presets_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "custom_rule_presets_user_idx"
  ON "custom_rule_presets" USING btree ("user_id");
