import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customRulePresets } from "@/db/custom-rule-presets-schema";
import type { CustomRulePreset, CustomRulePresetInput } from "./custom-types";

function toModel(row: typeof customRulePresets.$inferSelect): CustomRulePreset {
  return {
    id: row.id,
    name: row.name,
    propFirm: row.propFirm,
    variants: row.variants,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCustomRulePresets(userId: string) {
  const rows = await db.select().from(customRulePresets)
    .where(eq(customRulePresets.userId, userId))
    .orderBy(desc(customRulePresets.updatedAt));
  return rows.map(toModel);
}

export async function getCustomRulePreset(userId: string, presetId: string) {
  const rows = await db.select().from(customRulePresets)
    .where(and(eq(customRulePresets.userId, userId), eq(customRulePresets.id, presetId)))
    .limit(1);
  return rows[0] ? toModel(rows[0]) : null;
}

export async function createCustomRulePreset(userId: string, input: CustomRulePresetInput) {
  const rows = await db.insert(customRulePresets).values({
    userId,
    name: input.name,
    propFirm: input.propFirm,
    variants: input.variants,
    updatedAt: new Date(),
  }).returning();
  return toModel(rows[0]);
}

export async function updateCustomRulePreset(
  userId: string,
  presetId: string,
  input: Partial<CustomRulePresetInput>,
) {
  const values: Partial<typeof customRulePresets.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.propFirm !== undefined) values.propFirm = input.propFirm;
  if (input.variants !== undefined) values.variants = input.variants;

  const rows = await db.update(customRulePresets).set(values)
    .where(and(eq(customRulePresets.userId, userId), eq(customRulePresets.id, presetId)))
    .returning();
  return rows[0] ? toModel(rows[0]) : null;
}

export async function deleteCustomRulePreset(userId: string, presetId: string) {
  const rows = await db.delete(customRulePresets)
    .where(and(eq(customRulePresets.userId, userId), eq(customRulePresets.id, presetId)))
    .returning({ id: customRulePresets.id });
  return rows[0] ?? null;
}
