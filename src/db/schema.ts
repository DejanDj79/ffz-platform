import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const challengeStatusEnum = pgEnum("challenge_status", [
  "NOT_STARTED",
  "ACTIVE", // legacy API value; new UI uses IN_PROGRESS
  "IN_PROGRESS",
  "PAUSED",
  "PASSED",
  "FAILED",
  "FUNDED",
  "CLOSED",
]);

export const challengePhaseEnum = pgEnum("challenge_phase", [
  "EVALUATION",
  "VERIFICATION",
  "SIM_FUNDED",
  "FUNDED",
  "PAYOUT",
  "OTHER",
]);

export const drawdownTypeEnum = pgEnum("drawdown_type", [
  "STATIC",
  "EOD_TRAILING",
  "INTRADAY_TRAILING",
]);

export const breachTypeEnum = pgEnum("breach_type", [
  "NONE",
  "SOFT",
  "HARD",
]);


export const tradeDirectionEnum = pgEnum("trade_direction", [
  "LONG",
  "SHORT",
]);

export const tradeStatusEnum = pgEnum("trade_status", [
  "OPEN",
  "CLOSED",
]);

export const tradeOutcomeEnum = pgEnum("trade_outcome", [
  "WIN",
  "LOSS",
  "BREAKEVEN",
]);


export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "EXPENSE",
  "INCOME",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  }),
);


export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    userIdx: index("sessions_user_idx").on(table.userId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt),
  }),
);

export const tradingAccounts = pgTable(
  "trading_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    provider: varchar("provider", { length: 140 }),
    accountType: varchar("account_type", { length: 40 }).notNull().default("PROP"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("trading_accounts_user_idx").on(table.userId),
  }),
);

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tradingAccountId: uuid("trading_account_id").references(() => tradingAccounts.id, { onDelete: "set null" }),

    rulesPresetId: varchar("rules_preset_id", { length: 160 }),
    propFirm: varchar("prop_firm", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),

    status: challengeStatusEnum("status").notNull().default("NOT_STARTED"),
    phase: challengePhaseEnum("phase").notNull().default("EVALUATION"),
    drawdownType: drawdownTypeEnum("drawdown_type").notNull().default("STATIC"),
    dailyLossBreachType: breachTypeEnum("daily_loss_breach_type").notNull().default("HARD"),

    // Monetary amounts are stored as integer cents.
    accountSizeCents: integer("account_size_cents").notNull(),
    startingBalanceCents: integer("starting_balance_cents").notNull(),
    currentBalanceCents: integer("current_balance_cents").notNull(),
    highestEodBalanceCents: integer("highest_eod_balance_cents").notNull(),
    todayPnlCents: integer("today_pnl_cents").notNull().default(0),

    profitTargetCents: integer("profit_target_cents").notNull(),
    maxDrawdownCents: integer("max_drawdown_cents").notNull(),
    drawdownLockFloorOffsetCents: integer("drawdown_lock_floor_offset_cents").notNull().default(0),
    dailyLossLimitCents: integer("daily_loss_limit_cents"),

    challengeFeeCents: integer("challenge_fee_cents").notNull().default(0),
    resetFeeCents: integer("reset_fee_cents"),
    resetCount: integer("reset_count").notNull().default(0),

    maxMiniContracts: integer("max_mini_contracts"),
    maxMicroContracts: integer("max_micro_contracts"),

    minimumTradingDays: integer("minimum_trading_days"),
    daysTraded: integer("days_traded").notNull().default(0),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("challenges_user_idx").on(table.userId),
    statusIdx: index("challenges_status_idx").on(table.status),
    accountIdx: index("challenges_account_idx").on(table.tradingAccountId),
  }),
);


export const trades = pgTable(
  "trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    challengeId: uuid("challenge_id").references(
      () => challenges.id,
      { onDelete: "set null" },
    ),

    tradingAccountId: uuid("trading_account_id").references(
      () => tradingAccounts.id,
      { onDelete: "set null" },
    ),

    instrument: varchar("instrument", { length: 16 }).notNull(),
    direction: tradeDirectionEnum("direction").notNull(),
    status: tradeStatusEnum("status").notNull().default("OPEN"),

    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    entryPrice: numeric("entry_price", { precision: 18, scale: 4 }).notNull(),
    stopPrice: numeric("stop_price", { precision: 18, scale: 4 }),
    targetPrice: numeric("target_price", { precision: 18, scale: 4 }),
    exitPrice: numeric("exit_price", { precision: 18, scale: 4 }),

    contracts: integer("contracts").notNull(),

    commissionFeesCents: integer("commission_fees_cents").notNull().default(0),
    grossPnlCents: integer("gross_pnl_cents"),
    netPnlCents: integer("net_pnl_cents"),
    initialRiskCents: integer("initial_risk_cents"),

    rMultiple: numeric("r_multiple", { precision: 12, scale: 4 }),
    outcome: tradeOutcomeEnum("outcome"),

    setup: varchar("setup", { length: 120 }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("trades_user_idx").on(table.userId),
    challengeIdx: index("trades_challenge_idx").on(table.challengeId),
    accountIdx: index("trades_account_idx").on(table.tradingAccountId),
    openedAtIdx: index("trades_opened_at_idx").on(table.openedAt),
  }),
);


export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    challengeId: uuid("challenge_id").references(
      () => challenges.id,
      { onDelete: "set null" },
    ),

    tradingAccountId: uuid("trading_account_id").references(
      () => tradingAccounts.id,
      { onDelete: "set null" },
    ),

    entryType: ledgerEntryTypeEnum("entry_type").notNull(),

    // Kept as varchar instead of a PostgreSQL enum so new ledger
    // categories can be added later without a database enum migration.
    category: varchar("category", { length: 50 }).notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    // Always stored as a positive amount; entryType determines cash direction.
    amountCents: integer("amount_cents").notNull(),

    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    provider: varchar("provider", { length: 160 }),
    description: varchar("description", { length: 240 }),
    reference: varchar("reference", { length: 160 }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("ledger_entries_user_idx").on(table.userId),
    challengeIdx: index("ledger_entries_challenge_idx").on(table.challengeId),
    accountIdx: index("ledger_entries_account_idx").on(table.tradingAccountId),
    occurredAtIdx: index("ledger_entries_occurred_at_idx").on(table.occurredAt),
    typeIdx: index("ledger_entries_type_idx").on(table.entryType),
  }),
);


export const scoreboardSettings = pgTable(
  "scoreboard_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Public OBS URL identifier. It contains no password/session data and
    // can be regenerated by the owner at any time.
    overlayKey: uuid("overlay_key").defaultRandom().notNull(),

    challengeId: uuid("challenge_id").references(
      () => challenges.id,
      { onDelete: "set null" },
    ),

    layout: varchar("layout", { length: 20 }).notNull().default("COMPACT"),
    goalLabel: varchar("goal_label", { length: 100 })
      .notNull()
      .default("FIRST REAL PAYOUT"),

    refreshSeconds: integer("refresh_seconds").notNull().default(5),
    isEnabled: boolean("is_enabled").notNull().default(true),

    showBalance: boolean("show_balance").notNull().default(true),
    showChallengePnl: boolean("show_challenge_pnl").notNull().default(true),
    showTargetProgress: boolean("show_target_progress").notNull().default(true),
    showTradeCount: boolean("show_trade_count").notNull().default(true),
    showWinRate: boolean("show_win_rate").notNull().default(true),
    showAverageR: boolean("show_average_r").notNull().default(true),
    showRealMoneyNet: boolean("show_real_money_net").notNull().default(true),
    showRealPayouts: boolean("show_real_payouts").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("scoreboard_settings_user_unique").on(table.userId),
    overlayKeyUnique: uniqueIndex("scoreboard_settings_overlay_key_unique").on(
      table.overlayKey,
    ),
    challengeIdx: index("scoreboard_settings_challenge_idx").on(
      table.challengeId,
    ),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type TradingAccountRow = typeof tradingAccounts.$inferSelect;
export type NewTradingAccountRow = typeof tradingAccounts.$inferInsert;
export type ChallengeRow = typeof challenges.$inferSelect;
export type NewChallengeRow = typeof challenges.$inferInsert;

export type TradeRow = typeof trades.$inferSelect;
export type NewTradeRow = typeof trades.$inferInsert;

export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntryRow = typeof ledgerEntries.$inferInsert;

export type ScoreboardSettingsRow = typeof scoreboardSettings.$inferSelect;
export type NewScoreboardSettingsRow = typeof scoreboardSettings.$inferInsert;
