-- Reference only. For the current local development database use `npm run db:push`.
-- This file documents Backend v1.2 additions.
ALTER TYPE "challenge_status" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "challenge_status" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "challenge_phase" ADD VALUE IF NOT EXISTS 'VERIFICATION';
ALTER TYPE "challenge_phase" ADD VALUE IF NOT EXISTS 'SIM_FUNDED';
ALTER TYPE "challenge_phase" ADD VALUE IF NOT EXISTS 'OTHER';

DO $$ BEGIN
  CREATE TYPE "breach_type" AS ENUM ('NONE', 'SOFT', 'HARD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "daily_loss_breach_type" "breach_type" DEFAULT 'HARD' NOT NULL;
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "today_pnl_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "drawdown_lock_floor_offset_cents" integer DEFAULT 0 NOT NULL;
