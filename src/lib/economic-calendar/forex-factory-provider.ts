import {
  normalizeForexFactoryEvent,
  sortEconomicEvents,
} from "./calendar-utils";
import type {
  EconomicCalendarEvent,
  ForexFactoryEvent,
} from "./types";

const FOREX_FACTORY_WEEKLY_JSON =
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export type ProviderFetchResult = {
  events: EconomicCalendarEvent[];
};

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

export async function fetchForexFactoryEconomicCalendar(
  input: {
    from: string;
    to: string;
  },
): Promise<ProviderFetchResult> {
  const response = await fetch(
    FOREX_FACTORY_WEEKLY_JSON,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "FuturesFromZero/1.0 EconomicCalendar",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const retryAfter =
      response.headers.get("Retry-After");

    if (response.status === 429) {
      throw new Error(
        retryAfter
          ? `FOREX_FACTORY_RATE_LIMIT:${retryAfter}`
          : "FOREX_FACTORY_RATE_LIMIT",
      );
    }

    throw new Error(
      `FOREX_FACTORY_HTTP_${response.status}`,
    );
  }

  const json =
    (await response.json()) as ForexFactoryEvent[];

  if (!Array.isArray(json)) {
    throw new Error(
      "FOREX_FACTORY_INVALID_RESPONSE",
    );
  }

  const normalized = json
    .map(normalizeForexFactoryEvent)
    .filter(
      (
        event,
      ): event is EconomicCalendarEvent =>
        event !== null,
    );

  // Keep only the period the FFZ service asked for.
  // The provider feed itself is a weekly export.
  const events = normalized.filter(
    (event) => {
      const key = dateKey(event.date);
      return key >= input.from && key <= input.to;
    },
  );

  return {
    events: sortEconomicEvents(events),
  };
}
