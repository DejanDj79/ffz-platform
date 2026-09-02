import {
  cacheKeyForRange,
  getCalendarFetchRange,
  providerCacheTtlMs,
} from "./calendar-utils";
import {
  getEconomicCalendarCache,
  saveEconomicCalendarCache,
} from "./cache-repository";
import {
  fetchForexFactoryEconomicCalendar,
} from "./forex-factory-provider";
import type {
  EconomicCalendarPayload,
} from "./types";

const refreshes = new Map<
  string,
  Promise<EconomicCalendarPayload>
>();

function toPayload(
  input: {
    events: EconomicCalendarPayload["events"];
    range: EconomicCalendarPayload["range"];
    fetchedAt: Date;
    expiresAt: Date;
    stale: boolean;
  },
): EconomicCalendarPayload {
  return {
    events: input.events,
    range: input.range,
    provider: "Forex Factory",
    fetchedAt:
      input.fetchedAt.toISOString(),
    expiresAt:
      input.expiresAt.toISOString(),
    stale: input.stale,
  };
}

async function refreshCalendar(
  input: {
    cacheKey: string;
    range: {
      from: string;
      to: string;
    };
    staleCache: Awaited<
      ReturnType<
        typeof getEconomicCalendarCache
      >
    >;
    now: Date;
  },
): Promise<EconomicCalendarPayload> {
  try {
    const provider =
      await fetchForexFactoryEconomicCalendar(
        input.range,
      );

    const fetchedAt = new Date();
    const expiresAt = new Date(
      fetchedAt.getTime() +
        providerCacheTtlMs(fetchedAt),
    );

    const payload = {
      events: provider.events,
      range: input.range,
    };

    await saveEconomicCalendarCache({
      cacheKey: input.cacheKey,
      payload,
      providerFetchedAt: fetchedAt,
      expiresAt,
    });

    return toPayload({
      events: provider.events,
      range: input.range,
      fetchedAt,
      expiresAt,
      stale: false,
    });
  } catch (error) {
    if (input.staleCache) {
      return toPayload({
        events:
          input.staleCache.payload.events,
        range:
          input.staleCache.payload.range,
        fetchedAt:
          input.staleCache.providerFetchedAt,
        expiresAt:
          input.staleCache.expiresAt,
        stale: true,
      });
    }

    throw error;
  }
}

export async function getEconomicCalendar(
  now = new Date(),
): Promise<EconomicCalendarPayload> {
  const range =
    getCalendarFetchRange(now);

  const cacheKey = cacheKeyForRange(
    range.from,
    range.to,
  );

  const cached =
    await getEconomicCalendarCache(
      cacheKey,
    );

  if (
    cached &&
    cached.expiresAt.getTime() >
      now.getTime()
  ) {
    return toPayload({
      events: cached.payload.events,
      range: cached.payload.range,
      fetchedAt:
        cached.providerFetchedAt,
      expiresAt: cached.expiresAt,
      stale: false,
    });
  }

  const existingRefresh =
    refreshes.get(cacheKey);

  if (existingRefresh) {
    return existingRefresh;
  }

  const refresh = refreshCalendar({
    cacheKey,
    range,
    staleCache: cached,
    now,
  }).finally(() => {
    refreshes.delete(cacheKey);
  });

  refreshes.set(cacheKey, refresh);

  return refresh;
}
