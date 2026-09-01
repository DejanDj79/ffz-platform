import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges } from "@/db/schema";
import { centsToDollars, dollarsToCents } from "@/db/money";
import type {
  ChallengeApiModel,
  CreateChallengeApiInput,
  UpdateChallengeApiInput,
} from "./api-types";

function toApiModel(row: typeof challenges.$inferSelect): ChallengeApiModel {
  return {
    id: row.id,
    rulesPresetId: row.rulesPresetId,
    propFirm: row.propFirm,
    name: row.name,
    status: row.status,
    phase: row.phase,
    drawdownType: row.drawdownType,
    dailyLossBreachType: row.dailyLossBreachType,

    accountSize: centsToDollars(row.accountSizeCents) ?? 0,
    startingBalance: centsToDollars(row.startingBalanceCents) ?? 0,
    currentBalance: centsToDollars(row.currentBalanceCents) ?? 0,
    highestEodBalance: centsToDollars(row.highestEodBalanceCents) ?? 0,
    todayPnl: centsToDollars(row.todayPnlCents) ?? 0,

    profitTarget: centsToDollars(row.profitTargetCents) ?? 0,
    maxDrawdown: centsToDollars(row.maxDrawdownCents) ?? 0,
    drawdownLockFloorOffset: centsToDollars(row.drawdownLockFloorOffsetCents) ?? 0,
    dailyLossLimit: centsToDollars(row.dailyLossLimitCents),

    challengeFee: centsToDollars(row.challengeFeeCents) ?? 0,
    resetFee: centsToDollars(row.resetFeeCents),
    resetCount: row.resetCount,

    maxMiniContracts: row.maxMiniContracts,
    maxMicroContracts: row.maxMicroContracts,
    minimumTradingDays: row.minimumTradingDays,
    daysTraded: row.daysTraded,
    notes: row.notes,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listChallenges(userId: string) {
  const rows = await db.select().from(challenges)
    .where(eq(challenges.userId, userId))
    .orderBy(desc(challenges.createdAt));
  return rows.map(toApiModel);
}

export async function getChallenge(userId: string, challengeId: string) {
  const rows = await db.select().from(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, challengeId)))
    .limit(1);
  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function createChallenge(userId: string, input: CreateChallengeApiInput) {
  const rows = await db.insert(challenges).values({
    userId,
    rulesPresetId: input.rulesPresetId,
    propFirm: input.propFirm,
    name: input.name,
    status: input.status,
    phase: input.phase,
    drawdownType: input.drawdownType,
    dailyLossBreachType: input.dailyLossBreachType,

    accountSizeCents: dollarsToCents(input.accountSize),
    startingBalanceCents: dollarsToCents(input.startingBalance),
    currentBalanceCents: dollarsToCents(input.currentBalance),
    highestEodBalanceCents: dollarsToCents(input.highestEodBalance),
    todayPnlCents: dollarsToCents(input.todayPnl),

    profitTargetCents: dollarsToCents(input.profitTarget),
    maxDrawdownCents: dollarsToCents(input.maxDrawdown),
    drawdownLockFloorOffsetCents: dollarsToCents(input.drawdownLockFloorOffset),
    dailyLossLimitCents: input.dailyLossLimit == null ? null : dollarsToCents(input.dailyLossLimit),

    challengeFeeCents: dollarsToCents(input.challengeFee),
    resetFeeCents: input.resetFee == null ? null : dollarsToCents(input.resetFee),
    resetCount: input.resetCount,
    maxMiniContracts: input.maxMiniContracts,
    maxMicroContracts: input.maxMicroContracts,
    minimumTradingDays: input.minimumTradingDays,
    daysTraded: input.daysTraded,
    notes: input.notes,
    updatedAt: new Date(),
  }).returning();

  return toApiModel(rows[0]);
}

export async function updateChallenge(userId: string, challengeId: string, input: UpdateChallengeApiInput) {
  const values: Partial<typeof challenges.$inferInsert> = { updatedAt: new Date() };

  if (input.rulesPresetId !== undefined) values.rulesPresetId = input.rulesPresetId;
  if (input.propFirm !== undefined) values.propFirm = input.propFirm;
  if (input.name !== undefined) values.name = input.name;
  if (input.status !== undefined) values.status = input.status;
  if (input.phase !== undefined) values.phase = input.phase;
  if (input.drawdownType !== undefined) values.drawdownType = input.drawdownType;
  if (input.dailyLossBreachType !== undefined) values.dailyLossBreachType = input.dailyLossBreachType;

  if (input.accountSize !== undefined) values.accountSizeCents = dollarsToCents(input.accountSize);
  if (input.startingBalance !== undefined) values.startingBalanceCents = dollarsToCents(input.startingBalance);
  if (input.currentBalance !== undefined) values.currentBalanceCents = dollarsToCents(input.currentBalance);
  if (input.highestEodBalance !== undefined) values.highestEodBalanceCents = dollarsToCents(input.highestEodBalance);
  if (input.todayPnl !== undefined) values.todayPnlCents = dollarsToCents(input.todayPnl);
  if (input.profitTarget !== undefined) values.profitTargetCents = dollarsToCents(input.profitTarget);
  if (input.maxDrawdown !== undefined) values.maxDrawdownCents = dollarsToCents(input.maxDrawdown);
  if (input.drawdownLockFloorOffset !== undefined) values.drawdownLockFloorOffsetCents = dollarsToCents(input.drawdownLockFloorOffset);
  if (input.dailyLossLimit !== undefined) values.dailyLossLimitCents = input.dailyLossLimit == null ? null : dollarsToCents(input.dailyLossLimit);
  if (input.challengeFee !== undefined) values.challengeFeeCents = dollarsToCents(input.challengeFee);
  if (input.resetFee !== undefined) values.resetFeeCents = input.resetFee == null ? null : dollarsToCents(input.resetFee);
  if (input.resetCount !== undefined) values.resetCount = input.resetCount;
  if (input.maxMiniContracts !== undefined) values.maxMiniContracts = input.maxMiniContracts;
  if (input.maxMicroContracts !== undefined) values.maxMicroContracts = input.maxMicroContracts;
  if (input.minimumTradingDays !== undefined) values.minimumTradingDays = input.minimumTradingDays;
  if (input.daysTraded !== undefined) values.daysTraded = input.daysTraded;
  if (input.notes !== undefined) values.notes = input.notes;

  const rows = await db.update(challenges).set(values)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, challengeId)))
    .returning();

  return rows[0] ? toApiModel(rows[0]) : null;
}

export async function deleteChallenge(userId: string, challengeId: string) {
  const rows = await db.delete(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, challengeId)))
    .returning({ id: challenges.id });
  return rows[0] ?? null;
}
