import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import {
  challenges,
  ledgerEntries,
  scoreboardSettings,
  tradingAccounts,
  trades,
  users,
} from "./schema";
import { tradingGuardrailSettings } from "./trading-guardrails-schema";
import { userPlans } from "./user-plans-schema";
import { weeklyFocuses } from "./weekly-focus-schema";
import { dollarsToCents } from "./money";
import { hashPassword } from "../lib/auth/password";
import type { TradingGuardrailSettings } from "../lib/trading/guardrails-types";

const DEMO_EMAIL = "month-demo@ffz.local";
const DEMO_PASSWORD = "FFZdemo2026!";
const DEMO_MONTH = "August 2026";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type Execution = "on-plan" | "deviated" | "unplanned";
type Mindset = "calm" | "focused" | "fomo" | "fear" | "frustrated" | "tired";

type TradeSpec = {
  pnl: number;
  risk?: number;
  instrument?: "MNQ" | "MES";
  direction?: "LONG" | "SHORT";
  setup?: string;
  execution?: Execution;
  mindset?: Mindset;
  planned?: boolean;
  nextGapMinutes?: number;
  note?: string;
};

type DaySpec = {
  day: number;
  challenge: "TRADEIFY" | "BG_EVAL" | "BG_FUNDED";
  trades: TradeSpec[];
};

function assertLocalSeedAllowed() {
  if (!process.argv.includes("--confirm-local")) {
    throw new Error(
      "Refusing to seed. Re-run with --confirm-local after verifying .env.local points to the local FFZ database.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed while NODE_ENV=production.");
  }

  const rawDatabaseUrl = process.env.DATABASE_URL;
  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname) || databaseName !== "ffz_platform") {
    throw new Error(
      `Refusing to seed non-local database ${databaseUrl.hostname}/${databaseName}. Expected localhost/ffz_platform.`,
    );
  }
}

function etDate(day: number, hour: number, minute: number) {
  // August is EDT (UTC-4). Seed timestamps stay deterministic and do not depend
  // on the machine timezone.
  return new Date(Date.UTC(2026, 7, day, hour + 4, minute, 0));
}

function disciplineTags(
  execution: Execution,
  mindset: Mindset,
  planned: boolean,
  extra: string[],
) {
  return [
    ...(planned ? ["FFZ:planned"] : []),
    `FFZ:execution:${execution}`,
    `FFZ:mindset:${mindset}`,
    ...extra,
  ];
}

const DAYS: DaySpec[] = [
  {
    day: 3,
    challenge: "TRADEIFY",
    trades: [
      { pnl: 120, risk: 90, setup: "Opening Range Breakout", mindset: "focused", note: "Clean opening drive and disciplined exit." },
      { pnl: -90, risk: 90, setup: "VWAP Reclaim", direction: "SHORT", mindset: "calm" },
      { pnl: 80, risk: 85, setup: "Pullback Continuation", mindset: "focused" },
    ],
  },
  {
    day: 4,
    challenge: "TRADEIFY",
    trades: [
      { pnl: -95, risk: 90, setup: "Opening Range Breakout", mindset: "focused", nextGapMinutes: 8 },
      { pnl: -110, risk: 120, setup: "Liquidity Sweep", direction: "SHORT", execution: "deviated", mindset: "frustrated", planned: false, nextGapMinutes: 6, note: "Re-entered too quickly and increased risk after the first loss." },
      { pnl: -80, risk: 100, setup: "VWAP Reclaim", execution: "unplanned", mindset: "fomo", planned: false, nextGapMinutes: 18 },
      { pnl: 65, risk: 85, setup: "Pullback Continuation", mindset: "calm" },
    ],
  },
  {
    day: 5,
    challenge: "TRADEIFY",
    trades: [
      { pnl: -100, risk: 95, setup: "Liquidity Sweep", direction: "SHORT", mindset: "tired", nextGapMinutes: 12 },
      { pnl: -120, risk: 105, setup: "Opening Range Breakout", execution: "deviated", mindset: "frustrated", planned: false, note: "Second loss closed the evaluation." },
    ],
  },
  {
    day: 6,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 150, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: 120, risk: 85, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 7,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 95, risk: 85, setup: "Opening Range Breakout", mindset: "focused" },
      { pnl: -80, risk: 85, setup: "Liquidity Sweep", direction: "SHORT", mindset: "calm" },
      { pnl: 130, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
    ],
  },
  {
    day: 10,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 180, risk: 95, setup: "Opening Range Breakout", mindset: "focused" },
      { pnl: 130, risk: 90, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
      { pnl: -90, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
    ],
  },
  {
    day: 11,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 220, risk: 95, setup: "Liquidity Sweep", direction: "SHORT", mindset: "focused" },
      { pnl: 95, risk: 85, setup: "VWAP Reclaim", mindset: "calm" },
    ],
  },
  {
    day: 12,
    challenge: "BG_EVAL",
    trades: [
      { pnl: -100, risk: 95, setup: "Opening Range Breakout", mindset: "calm", nextGapMinutes: 22 },
      { pnl: 160, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: 100, risk: 85, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 13,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 250, risk: 100, setup: "Liquidity Sweep", direction: "SHORT", mindset: "focused" },
      { pnl: -95, risk: 90, setup: "VWAP Reclaim", mindset: "calm" },
      { pnl: 180, risk: 95, setup: "Opening Range Breakout", mindset: "focused" },
    ],
  },
  {
    day: 14,
    challenge: "BG_EVAL",
    trades: [
      { pnl: 300, risk: 100, setup: "Opening Range Breakout", mindset: "focused", note: "Best evaluation trade; waited for confirmation instead of chasing." },
      { pnl: 200, risk: 95, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 17,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 110, risk: 85, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: -95, risk: 90, setup: "Liquidity Sweep", direction: "SHORT", mindset: "calm" },
      { pnl: 140, risk: 90, setup: "Pullback Continuation", mindset: "focused" },
    ],
  },
  {
    day: 18,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: -100, risk: 95, setup: "Opening Range Breakout", mindset: "focused", nextGapMinutes: 9 },
      { pnl: -90, risk: 100, setup: "VWAP Reclaim", execution: "deviated", mindset: "frustrated", planned: false, nextGapMinutes: 28 },
      { pnl: 80, risk: 80, setup: "Pullback Continuation", mindset: "calm" },
    ],
  },
  {
    day: 19,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 160, risk: 90, setup: "Liquidity Sweep", direction: "SHORT", mindset: "focused" },
      { pnl: 130, risk: 85, setup: "VWAP Reclaim", mindset: "calm" },
    ],
  },
  {
    day: 20,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: -85, risk: 85, setup: "Opening Range Breakout", mindset: "calm" },
      { pnl: 120, risk: 85, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: 90, risk: 80, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 21,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 200, risk: 95, setup: "Opening Range Breakout", mindset: "focused" },
      { pnl: -95, risk: 90, setup: "Liquidity Sweep", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 24,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: -100, risk: 90, setup: "Opening Range Breakout", mindset: "focused", nextGapMinutes: 7 },
      { pnl: -90, risk: 120, setup: "Liquidity Sweep", direction: "SHORT", execution: "deviated", mindset: "frustrated", planned: false, nextGapMinutes: 5, note: "Risk escalation after the first loss; exactly the pattern the weekly review should flag." },
      { pnl: -110, risk: 105, setup: "VWAP Reclaim", execution: "unplanned", mindset: "fomo", planned: false, nextGapMinutes: 9 },
      { pnl: 130, risk: 90, setup: "Pullback Continuation", mindset: "calm" },
    ],
  },
  {
    day: 25,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 180, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: 110, risk: 85, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm" },
    ],
  },
  {
    day: 26,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 90, risk: 80, setup: "Opening Range Breakout", mindset: "focused" },
      { pnl: -80, risk: 80, setup: "Liquidity Sweep", direction: "SHORT", mindset: "calm" },
      { pnl: 150, risk: 90, setup: "VWAP Reclaim", mindset: "focused" },
    ],
  },
  {
    day: 27,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: -95, risk: 90, setup: "Opening Range Breakout", mindset: "calm" },
      { pnl: 200, risk: 95, setup: "Liquidity Sweep", direction: "SHORT", mindset: "focused" },
    ],
  },
  {
    day: 28,
    challenge: "BG_FUNDED",
    trades: [
      { pnl: 250, risk: 100, setup: "VWAP Reclaim", mindset: "focused" },
      { pnl: 160, risk: 90, setup: "Pullback Continuation", direction: "SHORT", mindset: "calm", note: "Finished the month without forcing another trade." },
    ],
  },
];

const GUARDRAILS: TradingGuardrailSettings = {
  maxRiskPerTrade: { enabled: true, value: 100, severity: "BLOCKED" },
  maxDailyLosses: { enabled: true, value: 2, severity: "BLOCKED" },
  maxTradesPerDay: { enabled: true, value: 3, severity: "CAUTION" },
  maxContracts: { enabled: true, value: 1 },
  minRewardRisk: { enabled: true, value: 1.5, severity: "CAUTION" },
  noNewTradesAfter: { enabled: true, timeEt: "12:00", severity: "CAUTION" },
  highImpactNews: { enabled: true, beforeMinutes: 15, afterMinutes: 15, severity: "BLOCKED" },
  mediumImpactNews: { enabled: false, beforeMinutes: 10, afterMinutes: 10, severity: "INFO" },
  majorNewsOverride: {
    enabled: true,
    beforeMinutes: 30,
    afterMinutes: 30,
    severity: "BLOCKED",
    keywords: ["FOMC", "CPI", "NFP", "Powell"],
  },
};

async function main() {
  assertLocalSeedAllowed();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing[0]) {
    await db.delete(users).where(eq(users.id, existing[0].id));
    console.log(`Removed previous ${DEMO_EMAIL} demo dataset.`);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [demoUser] = await db.insert(users).values({
    email: DEMO_EMAIL,
    passwordHash,
    displayName: "FFZ Month Demo",
    role: "CREATOR",
  }).returning();

  await db.insert(userPlans).values({ userId: demoUser.id, plan: "PRO" });
  await db.insert(tradingGuardrailSettings).values({ userId: demoUser.id, settings: GUARDRAILS });

  const [tradeifyAccount] = await db.insert(tradingAccounts).values({
    userId: demoUser.id,
    name: "Tradeify Select 25K · Failed Eval",
    provider: "Tradeify",
    accountType: "PROP",
    currency: "USD",
    isActive: 0,
  }).returning();

  const [bgEvalAccount] = await db.insert(tradingAccounts).values({
    userId: demoUser.id,
    name: "Blue Guardian 25K · Passed Eval",
    provider: "Blue Guardian Futures",
    accountType: "PROP",
    currency: "USD",
    isActive: 0,
  }).returning();

  const [bgFundedAccount] = await db.insert(tradingAccounts).values({
    userId: demoUser.id,
    name: "Blue Guardian 25K · Funded",
    provider: "Blue Guardian Futures",
    accountType: "PROP",
    currency: "USD",
    isActive: 1,
  }).returning();

  const [tradeifyChallenge] = await db.insert(challenges).values({
    userId: demoUser.id,
    tradingAccountId: tradeifyAccount.id,
    rulesPresetId: "TRADEIFY_SELECT_25K",
    propFirm: "Tradeify",
    name: "Select 25K · August Attempt",
    status: "FAILED",
    phase: "EVALUATION",
    drawdownType: "EOD_TRAILING",
    dailyLossBreachType: "NONE",
    accountSizeCents: dollarsToCents(25_000),
    startingBalanceCents: dollarsToCents(25_000),
    currentBalanceCents: dollarsToCents(24_665),
    highestEodBalanceCents: dollarsToCents(25_110),
    profitTargetCents: dollarsToCents(1_500),
    maxDrawdownCents: dollarsToCents(1_000),
    drawdownLockFloorOffsetCents: dollarsToCents(-999_999),
    dailyLossLimitCents: null,
    challengeFeeCents: dollarsToCents(109),
    resetFeeCents: dollarsToCents(60),
    maxMiniContracts: 1,
    maxMicroContracts: 10,
    minimumTradingDays: 3,
    daysTraded: 3,
    notes: "Local demo: first August evaluation failed after an undisciplined loss sequence.",
    createdAt: etDate(1, 9, 0),
  }).returning();

  const [bgEvalChallenge] = await db.insert(challenges).values({
    userId: demoUser.id,
    tradingAccountId: bgEvalAccount.id,
    rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
    propFirm: "Blue Guardian Futures",
    name: "Standard 25K · Passed Evaluation",
    status: "PASSED",
    phase: "EVALUATION",
    drawdownType: "EOD_TRAILING",
    dailyLossBreachType: "NONE",
    accountSizeCents: dollarsToCents(25_000),
    startingBalanceCents: dollarsToCents(25_000),
    currentBalanceCents: dollarsToCents(26_945),
    highestEodBalanceCents: dollarsToCents(26_945),
    profitTargetCents: dollarsToCents(1_500),
    maxDrawdownCents: dollarsToCents(1_500),
    drawdownLockFloorOffsetCents: 0,
    dailyLossLimitCents: null,
    challengeFeeCents: dollarsToCents(79),
    resetFeeCents: dollarsToCents(104),
    maxMiniContracts: 1,
    maxMicroContracts: 10,
    minimumTradingDays: 0,
    daysTraded: 7,
    notes: "Local demo: second evaluation passed with a cleaner, more selective week.",
    createdAt: etDate(6, 8, 45),
  }).returning();

  const [bgFundedChallenge] = await db.insert(challenges).values({
    userId: demoUser.id,
    tradingAccountId: bgFundedAccount.id,
    rulesPresetId: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
    propFirm: "Blue Guardian Futures",
    name: "Standard 25K · Funded Account",
    status: "FUNDED",
    phase: "FUNDED",
    drawdownType: "EOD_TRAILING",
    dailyLossBreachType: "NONE",
    accountSizeCents: dollarsToCents(25_000),
    startingBalanceCents: dollarsToCents(25_000),
    currentBalanceCents: dollarsToCents(26_360),
    highestEodBalanceCents: dollarsToCents(26_360),
    profitTargetCents: 0,
    maxDrawdownCents: dollarsToCents(1_500),
    drawdownLockFloorOffsetCents: 0,
    dailyLossLimitCents: null,
    challengeFeeCents: 0,
    resetFeeCents: dollarsToCents(104),
    maxMiniContracts: 1,
    maxMicroContracts: 10,
    minimumTradingDays: 0,
    daysTraded: 10,
    notes: "Local demo: funded phase with one rough behavior day and a first payout at month-end.",
    createdAt: etDate(17, 8, 45),
  }).returning();

  const challengeMap = {
    TRADEIFY: { challenge: tradeifyChallenge, account: tradeifyAccount },
    BG_EVAL: { challenge: bgEvalChallenge, account: bgEvalAccount },
    BG_FUNDED: { challenge: bgFundedChallenge, account: bgFundedAccount },
  } as const;

  let tradeNumber = 0;
  for (const day of DAYS) {
    let nextOpenMinuteEt = 9 * 60 + 35;

    for (const spec of day.trades) {
      tradeNumber += 1;
      const binding = challengeMap[day.challenge];
      const instrument = spec.instrument ?? (tradeNumber % 4 === 0 ? "MES" : "MNQ");
      const direction = spec.direction ?? (tradeNumber % 3 === 0 ? "SHORT" : "LONG");
      const execution = spec.execution ?? "on-plan";
      const mindset = spec.mindset ?? (tradeNumber % 2 === 0 ? "calm" : "focused");
      const planned = spec.planned ?? true;
      const riskDollars = spec.risk ?? 90;
      const commissionCents = instrument === "MNQ" ? 404 : 472;
      const netPnlCents = dollarsToCents(spec.pnl);
      const grossPnlCents = netPnlCents + commissionCents;
      const grossPnlDollars = grossPnlCents / 100;
      const pointValue = instrument === "MNQ" ? 2 : 5;
      const basePrice = instrument === "MNQ"
        ? 20_100 + day.day * 6 + tradeNumber * 1.25
        : 5_540 + day.day * 1.4 + tradeNumber * 0.35;
      const movement = grossPnlDollars / pointValue;
      const stopDistance = riskDollars / pointValue;
      const targetDistance = riskDollars * 1.7 / pointValue;
      const entryPrice = Number(basePrice.toFixed(2));
      const exitPrice = Number((direction === "LONG" ? entryPrice + movement : entryPrice - movement).toFixed(2));
      const stopPrice = Number((direction === "LONG" ? entryPrice - stopDistance : entryPrice + stopDistance).toFixed(2));
      const targetPrice = Number((direction === "LONG" ? entryPrice + targetDistance : entryPrice - targetDistance).toFixed(2));
      const openedHour = Math.floor(nextOpenMinuteEt / 60);
      const openedMinute = nextOpenMinuteEt % 60;
      const duration = 8 + (tradeNumber % 5) * 2;
      const closeMinuteEt = nextOpenMinuteEt + duration;
      const closedHour = Math.floor(closeMinuteEt / 60);
      const closedMinute = closeMinuteEt % 60;
      const extraTags = [
        tradeNumber % 3 === 0 ? "NY Open" : "A+ Setup",
        spec.setup === "Liquidity Sweep" ? "Reversal" : "Trend",
      ];

      await db.insert(trades).values({
        userId: demoUser.id,
        challengeId: binding.challenge.id,
        tradingAccountId: binding.account.id,
        instrument,
        direction,
        status: "CLOSED",
        openedAt: etDate(day.day, openedHour, openedMinute),
        closedAt: etDate(day.day, closedHour, closedMinute),
        entryPrice: entryPrice.toFixed(4),
        stopPrice: stopPrice.toFixed(4),
        targetPrice: targetPrice.toFixed(4),
        exitPrice: exitPrice.toFixed(4),
        contracts: 1,
        commissionFeesCents: commissionCents,
        grossPnlCents,
        netPnlCents,
        initialRiskCents: dollarsToCents(riskDollars),
        rMultiple: (spec.pnl / riskDollars).toFixed(4),
        outcome: spec.pnl > 0 ? "WIN" : spec.pnl < 0 ? "LOSS" : "BREAKEVEN",
        setup: spec.setup ?? "VWAP Reclaim",
        tags: disciplineTags(execution, mindset, planned, extraTags),
        notes: spec.note ?? `Demo ${DEMO_MONTH} trade ${tradeNumber}. Review entry quality, risk and execution rather than the result alone.`,
        createdAt: etDate(day.day, openedHour, openedMinute),
        updatedAt: etDate(day.day, closedHour, closedMinute),
      });

      nextOpenMinuteEt = closeMinuteEt + (spec.nextGapMinutes ?? 24);
    }
  }

  await db.insert(trades).values({
    userId: demoUser.id,
    challengeId: bgFundedChallenge.id,
    tradingAccountId: bgFundedAccount.id,
    instrument: "MNQ",
    direction: "LONG",
    status: "OPEN",
    openedAt: new Date("2026-09-07T13:35:00.000Z"),
    closedAt: null,
    entryPrice: "20580.0000",
    stopPrice: "20535.0000",
    targetPrice: "20660.0000",
    exitPrice: null,
    contracts: 1,
    commissionFeesCents: 0,
    grossPnlCents: null,
    netPnlCents: null,
    initialRiskCents: dollarsToCents(90),
    rMultiple: null,
    outcome: null,
    setup: "Opening Range Breakout",
    tags: ["__FFZ_PLANNED__", "A+ Setup", "NY Open"],
    notes: "Carry-forward demo plan for the next session: only take the opening range setup after confirmation.",
  });

  await db.insert(ledgerEntries).values([
    {
      userId: demoUser.id,
      challengeId: tradeifyChallenge.id,
      tradingAccountId: tradeifyAccount.id,
      entryType: "EXPENSE",
      category: "CHALLENGE_FEE",
      occurredAt: etDate(1, 10, 0),
      amountCents: dollarsToCents(109),
      currency: "USD",
      provider: "Tradeify",
      description: "Select 25K evaluation",
      reference: "DEMO-TRD-EVAL-0801",
      notes: "Dummy local ledger entry.",
    },
    {
      userId: demoUser.id,
      challengeId: bgEvalChallenge.id,
      tradingAccountId: bgEvalAccount.id,
      entryType: "EXPENSE",
      category: "CHALLENGE_FEE",
      occurredAt: etDate(6, 8, 30),
      amountCents: dollarsToCents(79),
      currency: "USD",
      provider: "Blue Guardian Futures",
      description: "Standard 25K evaluation",
      reference: "DEMO-BG-EVAL-0806",
      notes: "Dummy local ledger entry.",
    },
    {
      userId: demoUser.id,
      challengeId: bgFundedChallenge.id,
      tradingAccountId: bgFundedAccount.id,
      entryType: "EXPENSE",
      category: "ACTIVATION_FEE",
      occurredAt: etDate(17, 8, 20),
      amountCents: dollarsToCents(129),
      currency: "USD",
      provider: "Blue Guardian Futures",
      description: "Funded account activation",
      reference: "DEMO-BG-ACT-0817",
      notes: "Dummy activation cost used to exercise Prop Journey economics.",
    },
    {
      userId: demoUser.id,
      challengeId: bgFundedChallenge.id,
      tradingAccountId: bgFundedAccount.id,
      entryType: "EXPENSE",
      category: "DATA_FEE",
      occurredAt: etDate(24, 8, 0),
      amountCents: dollarsToCents(29),
      currency: "USD",
      provider: "Market Data",
      description: "Monthly market data",
      reference: "DEMO-DATA-AUG",
      notes: "Dummy monthly operating cost.",
    },
    {
      userId: demoUser.id,
      challengeId: bgFundedChallenge.id,
      tradingAccountId: bgFundedAccount.id,
      entryType: "INCOME",
      category: "PAYOUT",
      occurredAt: etDate(31, 10, 0),
      amountCents: dollarsToCents(650),
      currency: "USD",
      provider: "Blue Guardian Futures",
      description: "First funded payout",
      reference: "DEMO-PAYOUT-0831",
      notes: "Dummy payout used for Ledger, Prop Journey, Episode Builder and Scoreboard validation.",
    },
  ]);

  await db.insert(weeklyFocuses).values([
    {
      userId: demoUser.id,
      weekStart: "2026-08-03",
      primaryFocus: "Slow down after the first loss",
      rule: "Wait at least 15 minutes and re-check the setup before taking another trade after a loss.",
      whyItMatters: "The first evaluation showed rapid re-entry and risk escalation after losses.",
      sourceSignalKey: "RAPID_REENTRY",
      status: "PARTIAL",
    },
    {
      userId: demoUser.id,
      weekStart: "2026-08-10",
      primaryFocus: "Trade only A+ setups",
      rule: "No entry unless the setup and invalidation are clear before the order is placed.",
      whyItMatters: "The cleaner evaluation week came from fewer impulsive decisions.",
      sourceSignalKey: "PLAN_BREAKDOWN",
      status: "ACHIEVED",
    },
    {
      userId: demoUser.id,
      weekStart: "2026-08-17",
      primaryFocus: "Protect the funded account",
      rule: "Keep risk at or below $100 and never increase size after a loss.",
      whyItMatters: "Funded trading should prioritize survival over speed.",
      sourceSignalKey: "RISK_ESCALATION",
      status: "ACHIEVED",
    },
    {
      userId: demoUser.id,
      weekStart: "2026-08-24",
      primaryFocus: "Stop after two losing trades",
      rule: "After the second losing trade of the day, trading is finished.",
      whyItMatters: "The Aug 24 sequence shows how quickly a controlled day can turn into overtrading.",
      sourceSignalKey: "DAILY_LOSS_COUNT",
      status: "MISSED",
    },
    {
      userId: demoUser.id,
      weekStart: "2026-08-31",
      primaryFocus: "Respect the two-loss stop",
      rule: "After the second losing trade, close the platform and stop trading for the day.",
      whyItMatters: "The goal is to remove the decision entirely once the daily loss limit is reached.",
      sourceSignalKey: "DAILY_LOSS_COUNT",
      status: "ACTIVE",
    },
  ]);

  await db.insert(scoreboardSettings).values({
    userId: demoUser.id,
    challengeId: bgFundedChallenge.id,
    layout: "FULL",
    goalLabel: "FIRST $1K PAYOUT",
    tradingStyle: "SCALPING",
    instrumentsLabel: "MNQ / MES",
    seasonStartDate: new Date("2026-08-01T00:00:00.000Z"),
    scoreboardNotes: [
      "Passed the second evaluation after cleaning up execution.",
      "Funded month exposed one clear overtrading day.",
      "Next focus: respect the two-loss daily stop.",
    ].join("\n"),
    refreshSeconds: 5,
    isEnabled: true,
    showBalance: true,
    showChallengePnl: true,
    showTargetProgress: true,
    showTradeCount: true,
    showWinRate: true,
    showAverageR: true,
    showRealMoneyNet: true,
    showRealPayouts: true,
  });

  console.log("");
  console.log(`FFZ local month demo seeded: ${DEMO_MONTH}`);
  console.log(`User:     ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Trades:   ${tradeNumber} closed + 1 planned`);
  console.log("Accounts: 1 failed evaluation + 1 passed evaluation + 1 funded account");
  console.log("Ledger:   4 expenses + 1 payout");
  console.log("Focuses:  4 historical + 1 active weekly focus");
  console.log("");
  console.log("This seed only deletes/recreates the dedicated month-demo user.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
