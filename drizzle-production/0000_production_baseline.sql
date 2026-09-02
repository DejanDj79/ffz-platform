CREATE TYPE "public"."breach_type" AS ENUM('NONE', 'SOFT', 'HARD');--> statement-breakpoint
CREATE TYPE "public"."challenge_phase" AS ENUM('EVALUATION', 'VERIFICATION', 'SIM_FUNDED', 'FUNDED', 'PAYOUT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('NOT_STARTED', 'ACTIVE', 'IN_PROGRESS', 'PAUSED', 'PASSED', 'FAILED', 'FUNDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."drawdown_type" AS ENUM('STATIC', 'EOD_TRAILING', 'INTRADAY_TRAILING');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('EXPENSE', 'INCOME');--> statement-breakpoint
CREATE TYPE "public"."trade_direction" AS ENUM('LONG', 'SHORT');--> statement-breakpoint
CREATE TYPE "public"."trade_outcome" AS ENUM('WIN', 'LOSS', 'BREAKEVEN');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'CREATOR');--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trading_account_id" uuid,
	"rules_preset_id" varchar(160),
	"prop_firm" varchar(160) NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "challenge_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"phase" "challenge_phase" DEFAULT 'EVALUATION' NOT NULL,
	"drawdown_type" "drawdown_type" DEFAULT 'STATIC' NOT NULL,
	"daily_loss_breach_type" "breach_type" DEFAULT 'HARD' NOT NULL,
	"account_size_cents" integer NOT NULL,
	"starting_balance_cents" integer NOT NULL,
	"current_balance_cents" integer NOT NULL,
	"highest_eod_balance_cents" integer NOT NULL,
	"today_pnl_cents" integer DEFAULT 0 NOT NULL,
	"profit_target_cents" integer NOT NULL,
	"max_drawdown_cents" integer NOT NULL,
	"drawdown_lock_floor_offset_cents" integer DEFAULT 0 NOT NULL,
	"daily_loss_limit_cents" integer,
	"challenge_fee_cents" integer DEFAULT 0 NOT NULL,
	"reset_fee_cents" integer,
	"reset_count" integer DEFAULT 0 NOT NULL,
	"max_mini_contracts" integer,
	"max_micro_contracts" integer,
	"minimum_trading_days" integer,
	"days_traded" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_calendar_cache" (
	"cache_key" varchar(160) PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"provider_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid,
	"trading_account_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"category" varchar(50) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"provider" varchar(160),
	"description" varchar(240),
	"reference" varchar(160),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoreboard_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"overlay_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid,
	"layout" varchar(20) DEFAULT 'FULL' NOT NULL,
	"goal_label" varchar(100) DEFAULT 'FIRST REAL PAYOUT' NOT NULL,
	"trading_style" varchar(80) DEFAULT 'SCALPING' NOT NULL,
	"instruments_label" varchar(80) DEFAULT 'MNQ / MES' NOT NULL,
	"season_start_date" timestamp with time zone,
	"scoreboard_notes" text DEFAULT '' NOT NULL,
	"refresh_seconds" integer DEFAULT 5 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"show_balance" boolean DEFAULT true NOT NULL,
	"show_challenge_pnl" boolean DEFAULT true NOT NULL,
	"show_target_progress" boolean DEFAULT true NOT NULL,
	"show_trade_count" boolean DEFAULT true NOT NULL,
	"show_win_rate" boolean DEFAULT true NOT NULL,
	"show_average_r" boolean DEFAULT true NOT NULL,
	"show_real_money_net" boolean DEFAULT true NOT NULL,
	"show_real_payouts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid,
	"trading_account_id" uuid,
	"instrument" varchar(16) NOT NULL,
	"direction" "trade_direction" NOT NULL,
	"status" "trade_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"entry_price" numeric(18, 4) NOT NULL,
	"stop_price" numeric(18, 4),
	"target_price" numeric(18, 4),
	"exit_price" numeric(18, 4),
	"contracts" integer NOT NULL,
	"commission_fees_cents" integer DEFAULT 0 NOT NULL,
	"gross_pnl_cents" integer,
	"net_pnl_cents" integer,
	"initial_risk_cents" integer,
	"r_multiple" numeric(12, 4),
	"outcome" "trade_outcome",
	"setup" varchar(120),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"provider" varchar(140),
	"account_type" varchar(40) DEFAULT 'PROP' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(120),
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoreboard_settings" ADD CONSTRAINT "scoreboard_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoreboard_settings" ADD CONSTRAINT "scoreboard_settings_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_attachments" ADD CONSTRAINT "trade_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_attachments" ADD CONSTRAINT "trade_attachments_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenges_user_idx" ON "challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "challenges_account_idx" ON "challenges" USING btree ("trading_account_id");--> statement-breakpoint
CREATE INDEX "economic_calendar_cache_expires_idx" ON "economic_calendar_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_user_idx" ON "ledger_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_challenge_idx" ON "ledger_entries" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("trading_account_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_occurred_at_idx" ON "ledger_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_type_idx" ON "ledger_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "scoreboard_settings_user_unique" ON "scoreboard_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scoreboard_settings_overlay_key_unique" ON "scoreboard_settings" USING btree ("overlay_key");--> statement-breakpoint
CREATE INDEX "scoreboard_settings_challenge_idx" ON "scoreboard_settings" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trade_attachments_user_idx" ON "trade_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trade_attachments_trade_idx" ON "trade_attachments" USING btree ("trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_attachments_storage_key_unique" ON "trade_attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_challenge_idx" ON "trades" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "trades_account_idx" ON "trades" USING btree ("trading_account_id");--> statement-breakpoint
CREATE INDEX "trades_opened_at_idx" ON "trades" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "trading_accounts_user_idx" ON "trading_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");