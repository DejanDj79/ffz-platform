import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { economicCalendarCache } from "@/db/schema";
import type {
  EconomicCalendarEvent,
} from "./types";

export type EconomicCalendarCachePayload = {
  events: EconomicCalendarEvent[];
  range: {
    from: string;
    to: string;
  };
};

export async function getEconomicCalendarCache(
  cacheKey: string,
) {
  const rows = await db
    .select()
    .from(economicCalendarCache)
    .where(
      eq(
        economicCalendarCache.cacheKey,
        cacheKey,
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  return {
    cacheKey: row.cacheKey,
    payload:
      row.payload as EconomicCalendarCachePayload,
    providerFetchedAt:
      row.providerFetchedAt,
    expiresAt: row.expiresAt,
  };
}

export async function saveEconomicCalendarCache(
  input: {
    cacheKey: string;
    payload: EconomicCalendarCachePayload;
    providerFetchedAt: Date;
    expiresAt: Date;
  },
) {
  await db
    .insert(economicCalendarCache)
    .values({
      cacheKey: input.cacheKey,
      payload: input.payload,
      providerFetchedAt:
        input.providerFetchedAt,
      expiresAt: input.expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: economicCalendarCache.cacheKey,
      set: {
        payload: input.payload,
        providerFetchedAt:
          input.providerFetchedAt,
        expiresAt: input.expiresAt,
        updatedAt: new Date(),
      },
    });
}
