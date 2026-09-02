import {
  describe,
  expect,
  it,
} from "vitest";
import {
  getCalendarFetchRange,
  normalizeForexFactoryEvent,
  parseForexFactoryInstant,
  providerCacheTtlMs,
} from "@/lib/economic-calendar/calendar-utils";
import {
  countdownText,
  filterEconomicEvents,
  nextHighImpactEvent,
} from "@/lib/economic-calendar/client-utils";
import type {
  EconomicCalendarEvent,
} from "@/lib/economic-calendar/types";

function event(
  overrides: Partial<EconomicCalendarEvent> = {},
): EconomicCalendarEvent {
  return {
    id: "evt-1",
    category: "macro",
    date: "2026-09-02T14:00:00.000Z",
    title: "Test Event",
    description: null,
    country: "US",
    currency: "USD",
    impact: "High",
    previous: "1.0%",
    forecast: "2.0%",
    actual: null,
    unit: null,
    ...overrides,
  };
}

describe("Economic Calendar — Forex Factory", () => {
  it("normalizes an offset timestamp to UTC", () => {
    expect(
      parseForexFactoryInstant(
        "2026-09-02T08:30:00-04:00",
      ),
    ).toBe(
      "2026-09-02T12:30:00.000Z",
    );
  });

  it("maps the public Forex Factory export", () => {
    const result =
      normalizeForexFactoryEvent({
        title: "CPI y/y",
        country: "USD",
        date:
          "2026-09-02T08:30:00-04:00",
        impact: "High",
        forecast: "2.9%",
        previous: "2.8%",
        actual: "3.0%",
      });

    expect(result).not.toBeNull();
    expect(result?.currency).toBe("USD");
    expect(result?.country).toBe("US");
    expect(result?.impact).toBe("High");
    expect(result?.forecast).toBe("2.9%");
    expect(result?.actual).toBe("3.0%");
  });

  it("ignores holiday/non-economic rows", () => {
    expect(
      normalizeForexFactoryEvent({
        title: "Bank Holiday",
        country: "USD",
        date:
          "2026-09-02T00:00:00-04:00",
        impact: "Holiday",
        forecast: "",
        previous: "",
      }),
    ).toBeNull();
  });

  it("uses a 15 minute provider cache in US-market hours", () => {
    expect(
      providerCacheTtlMs(
        new Date(
          "2026-09-02T14:00:00Z",
        ),
      ),
    ).toBe(15 * 60 * 1000);

    expect(
      providerCacheTtlMs(
        new Date(
          "2026-09-02T04:00:00Z",
        ),
      ),
    ).toBe(30 * 60 * 1000);
  });

  it("fetches the current week and preserves tomorrow on Sunday", () => {
    expect(
      getCalendarFetchRange(
        new Date(
          "2026-09-02T10:00:00Z",
        ),
      ),
    ).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });

    expect(
      getCalendarFetchRange(
        new Date(
          "2026-09-06T10:00:00Z",
        ),
      ),
    ).toEqual({
      from: "2026-08-31",
      to: "2026-09-07",
    });
  });

  it("filters by impact and US relevance", () => {
    const events = [
      event(),
      event({
        id: "medium",
        impact: "Medium",
      }),
      event({
        id: "eu",
        country: null,
        currency: "EUR",
      }),
    ];

    const result =
      filterEconomicEvents(
        events,
        {
          window: "TODAY",
          impacts: new Set(["High"]),
          usOnly: true,
          now: new Date(
            "2026-09-02T10:00:00Z",
          ),
        },
      );

    expect(
      result.map((item) => item.id),
    ).toEqual(["evt-1"]);
  });

  it("finds the next high-impact US event", () => {
    const result =
      nextHighImpactEvent(
        [
          event({
            id: "past",
            date:
              "2026-09-02T09:00:00Z",
          }),
          event({
            id: "next",
            date:
              "2026-09-02T14:00:00Z",
          }),
        ],
        {
          usOnly: true,
          now: new Date(
            "2026-09-02T10:00:00Z",
          ),
        },
      );

    expect(result?.id).toBe("next");
  });

  it("renders countdown text", () => {
    expect(
      countdownText(
        "2026-09-02T10:30:45Z",
        new Date(
          "2026-09-02T10:00:00Z",
        ),
      ),
    ).toBe("30m 45s");
  });
});
