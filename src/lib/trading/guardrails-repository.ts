import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tradingGuardrailSettings } from "@/db/schema";
import { DEFAULT_TRADING_GUARDRAILS } from "./guardrails";
import type {
  TradingGuardrailSettings,
  TradingGuardrailSettingsApiModel,
} from "./guardrails-types";
import { tradingGuardrailSettingsSchema } from "./guardrails-validation";

function toApiModel(
  row: typeof tradingGuardrailSettings.$inferSelect,
): TradingGuardrailSettingsApiModel {
  const settings = tradingGuardrailSettingsSchema.parse(row.settings);
  return {
    ...settings,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getTradingGuardrailSettings(
  userId: string,
): Promise<TradingGuardrailSettingsApiModel> {
  const rows = await db
    .select()
    .from(tradingGuardrailSettings)
    .where(eq(tradingGuardrailSettings.userId, userId))
    .limit(1);

  if (!rows[0]) {
    return {
      ...DEFAULT_TRADING_GUARDRAILS,
      id: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  return toApiModel(rows[0]);
}

export async function saveTradingGuardrailSettings(
  userId: string,
  input: TradingGuardrailSettings,
): Promise<TradingGuardrailSettingsApiModel> {
  const settings = tradingGuardrailSettingsSchema.parse(input);
  const now = new Date();

  const rows = await db
    .insert(tradingGuardrailSettings)
    .values({
      userId,
      settings,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tradingGuardrailSettings.userId,
      set: {
        settings,
        updatedAt: now,
      },
    })
    .returning();

  if (!rows[0]) {
    throw new Error("Unable to save trading guardrails.");
  }

  return toApiModel(rows[0]);
}
