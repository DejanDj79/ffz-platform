DO $$ BEGIN
  CREATE TYPE "challenge_status" AS ENUM (
    'NOT_STARTED',
    'ACTIVE',
    'PASSED',
    'FAILED',
    'FUNDED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "challenge_phase" AS ENUM (
    'EVALUATION',
    'FUNDED',
    'PAYOUT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "drawdown_type" AS ENUM (
    'STATIC',
    'EOD_TRAILING',
    'INTRADAY_TRAILING'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "display_name" varchar(120),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique"
  ON "users" ("email");

CREATE TABLE IF NOT EXISTS "trading_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(140) NOT NULL,
  "provider" varchar(140),
  "account_type" varchar(40) DEFAULT 'PROP' NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "trading_accounts_user_idx"
  ON "trading_accounts" ("user_id");

CREATE TABLE IF NOT EXISTS "challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "trading_account_id" uuid REFERENCES "trading_accounts"("id") ON DELETE set null,

  "rules_preset_id" varchar(160),
  "prop_firm" varchar(160) NOT NULL,
  "name" varchar(160) NOT NULL,

  "status" "challenge_status" DEFAULT 'NOT_STARTED' NOT NULL,
  "phase" "challenge_phase" DEFAULT 'EVALUATION' NOT NULL,
  "drawdown_type" "drawdown_type" DEFAULT 'STATIC' NOT NULL,

  "account_size_cents" integer NOT NULL,
  "starting_balance_cents" integer NOT NULL,
  "current_balance_cents" integer NOT NULL,
  "highest_eod_balance_cents" integer NOT NULL,

  "profit_target_cents" integer NOT NULL,
  "max_drawdown_cents" integer NOT NULL,
  "daily_loss_limit_cents" integer,

  "challenge_fee_cents" integer DEFAULT 0 NOT NULL,
  "reset_fee_cents" integer,
  "reset_count" integer DEFAULT 0 NOT NULL,

  "max_mini_contracts" integer,
  "max_micro_contracts" integer,

  "minimum_trading_days" integer,
  "days_traded" integer DEFAULT 0 NOT NULL,

  "notes" text,

  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "challenges_user_idx"
  ON "challenges" ("user_id");

CREATE INDEX IF NOT EXISTS "challenges_status_idx"
  ON "challenges" ("status");

CREATE INDEX IF NOT EXISTS "challenges_account_idx"
  ON "challenges" ("trading_account_id");
