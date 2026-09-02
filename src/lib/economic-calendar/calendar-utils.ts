import { createHash } from "node:crypto";
import type {
  EconomicCalendarEvent,
  EconomicImpact,
  ForexFactoryEvent,
} from "./types";

const IMPACTS = new Set<EconomicImpact>([
  "Low",
  "Medium",
  "High",
]);

function isoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getCalendarFetchRange(
  now = new Date(),
) {
  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );

  const weekday = today.getUTCDay();
  const mondayOffset =
    weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(today);
  monday.setUTCDate(
    monday.getUTCDate() + mondayOffset,
  );

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const end =
    tomorrow.getTime() > sunday.getTime()
      ? tomorrow
      : sunday;

  return {
    from: isoDateUtc(monday),
    to: isoDateUtc(end),
  };
}

export function providerCacheTtlMs(
  now = new Date(),
) {
  const utcHour = now.getUTCHours();

  // The public weekly export is rate-limited.
  // 15 min during US-market hours is deliberately conservative.
  if (utcHour >= 11 && utcHour < 22) {
    return 15 * 60 * 1000;
  }

  return 30 * 60 * 1000;
}

export function parseForexFactoryInstant(
  value: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_PROVIDER_DATE");
  }

  return date.toISOString();
}

function nullableText(
  value: string | null | undefined,
) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function idForEvent(
  event: ForexFactoryEvent,
  normalizedDate: string,
) {
  return createHash("sha256")
    .update(
      [
        normalizedDate,
        event.country,
        event.title,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 24);
}

export function normalizeForexFactoryEvent(
  event: ForexFactoryEvent,
): EconomicCalendarEvent | null {
  if (
    !IMPACTS.has(
      event.impact as EconomicImpact,
    )
  ) {
    // Forex Factory can also return Holiday / non-economic rows.
    // v1 only displays Low / Medium / High economic events.
    return null;
  }

  const date =
    parseForexFactoryInstant(event.date);

  const currency =
    nullableText(event.country);

  return {
    id: `ff-${idForEvent(event, date)}`,
    category: "macro",
    date,
    title: event.title,
    description: null,

    // The public FF export names this field `country`, but its values
    // are currency codes such as USD, EUR, GBP, JPY.
    country:
      currency === "USD" ? "US" : null,
    currency,
    impact:
      event.impact as EconomicImpact,

    previous:
      nullableText(event.previous),
    forecast:
      nullableText(event.forecast),
    actual:
      nullableText(event.actual),
    unit: null,
  };
}

export function sortEconomicEvents(
  events: EconomicCalendarEvent[],
) {
  return [...events].sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime(),
  );
}

export function cacheKeyForRange(
  from: string,
  to: string,
) {
  return `forexfactory-economic:${from}:${to}`;
}
