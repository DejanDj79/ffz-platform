"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/api-client";
import {
  countdownText,
  filterEconomicEvents,
  formatEconomicValue,
  localEventTime,
  nextHighImpactEvent,
  type CalendarWindow,
} from "@/lib/economic-calendar/client-utils";
import type {
  EconomicCalendarEvent,
  EconomicCalendarPayload,
  EconomicImpact,
} from "@/lib/economic-calendar/types";
import styles from "./EconomicCalendar.module.css";

const IMPACTS: EconomicImpact[] = [
  "High",
  "Medium",
  "Low",
];

function ImpactDots({
  impact,
}: {
  impact: EconomicImpact;
}) {
  const count =
    impact === "High"
      ? 3
      : impact === "Medium"
        ? 2
        : 1;

  return (
    <span
      className={`${styles.impactDots} ${
        styles[
          `impact${impact}` as
            | "impactHigh"
            | "impactMedium"
            | "impactLow"
        ]
      }`}
      aria-label={`${impact} impact`}
    >
      {Array.from(
        { length: 3 },
        (_, index) => (
          <i
            key={index}
            className={
              index < count
                ? styles.dotActive
                : ""
            }
          />
        ),
      )}
    </span>
  );
}

export function EconomicCalendar() {
  const [payload, setPayload] =
    useState<EconomicCalendarPayload | null>(
      null,
    );

  const [windowMode, setWindowMode] =
    useState<CalendarWindow>("TODAY");

  const [impacts, setImpacts] =
    useState<Set<EconomicImpact>>(
      () =>
        new Set<EconomicImpact>([
          "High",
          "Medium",
        ]),
    );

  const [usOnly, setUsOnly] =
    useState(true);

  const [now, setNow] =
    useState(() => new Date());

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  async function load() {
    setError(null);

    try {
      const next =
        await fetchEconomicCalendar();

      setPayload(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Economic Calendar.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const dataTimer =
      window.setInterval(
        () => void load(),
        60_000,
      );

    const clockTimer =
      window.setInterval(
        () => setNow(new Date()),
        1_000,
      );

    return () => {
      window.clearInterval(dataTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!payload) return [];

    return filterEconomicEvents(
      payload.events,
      {
        window: windowMode,
        impacts,
        usOnly,
        now,
      },
    );
  }, [
    payload,
    windowMode,
    impacts,
    usOnly,
    now,
  ]);

  const nextHigh = useMemo(() => {
    if (!payload) return null;

    return nextHighImpactEvent(
      payload.events,
      {
        usOnly,
        now,
      },
    );
  }, [payload, usOnly, now]);

  const todayEvents = useMemo(() => {
    if (!payload) return [];

    return filterEconomicEvents(
      payload.events,
      {
        window: "TODAY",
        impacts: new Set([
          "High",
          "Medium",
          "Low",
        ]),
        usOnly,
        now,
      },
    );
  }, [payload, usOnly, now]);

  const todayCounts = useMemo(() => {
    return {
      High: todayEvents.filter(
        (event) =>
          event.impact === "High",
      ).length,

      Medium: todayEvents.filter(
        (event) =>
          event.impact === "Medium",
      ).length,

      Low: todayEvents.filter(
        (event) =>
          event.impact === "Low",
      ).length,
    };
  }, [todayEvents]);

  function toggleImpact(
    impact: EconomicImpact,
  ) {
    setImpacts((current) => {
      const next = new Set(current);

      if (next.has(impact)) {
        next.delete(impact);
      } else {
        next.add(impact);
      }

      return next;
    });
  }

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      EconomicCalendarEvent[]
    >();

    for (const event of filtered) {
      const key =
        new Date(
          event.date,
        ).toLocaleDateString(
          [],
          {
            weekday: "long",
            month: "long",
            day: "numeric",
          },
        );

      const list =
        groups.get(key) ?? [];

      list.push(event);
      groups.set(key, list);
    }

    return Array.from(
      groups.entries(),
    );
  }, [filtered]);

  return (
    <main className={styles.page}>
      <section className={styles.summaryGrid}>
        <article
          className={`${styles.summaryCard} ${
            todayCounts.High > 0
              ? styles.riskHigh
              : todayCounts.Medium > 0
                ? styles.riskMedium
                : styles.riskLow
          }`}
        >
          <span>TODAY&apos;S MARKET RISK</span>

          <strong>
            {todayCounts.High > 0
              ? "HIGH IMPACT DAY"
              : todayCounts.Medium > 0
                ? "MEDIUM IMPACT DAY"
                : "LOW IMPACT DAY"}
          </strong>

          <small>
            {usOnly
              ? "US / USD events"
              : "All countries"}
          </small>
        </article>

        <article className={styles.summaryCard}>
          <span>HIGH IMPACT TODAY</span>
          <strong>
            {todayCounts.High}
          </strong>
          <small>
            {todayCounts.High === 1
              ? "event"
              : "events"}
          </small>
        </article>

        <article className={styles.summaryCard}>
          <span>MEDIUM IMPACT TODAY</span>
          <strong>
            {todayCounts.Medium}
          </strong>
          <small>
            {todayCounts.Medium === 1
              ? "event"
              : "events"}
          </small>
        </article>

        <article
          className={`${styles.summaryCard} ${styles.nextHighCard}`}
        >
          <span>NEXT HIGH IMPACT</span>

          {nextHigh ? (
            <>
              <strong>
                {nextHigh.title}
              </strong>

              <small>
                {
                  localEventTime(
                    nextHigh.date,
                  ).date
                }
                {" · "}
                {
                  localEventTime(
                    nextHigh.date,
                  ).time
                }
                {" · "}
                {countdownText(
                  nextHigh.date,
                  now,
                )}
              </small>
            </>
          ) : (
            <>
              <strong>NONE FOUND</strong>
              <small>
                in loaded calendar range
              </small>
            </>
          )}
        </article>
      </section>

      <section className={styles.calendarPanel}>
        <header className={styles.calendarHeader}>
          <div>
            <span>ECONOMIC CALENDAR</span>
            <small>
              Scheduled macro events that can move
              futures prices.
            </small>
          </div>

          <div className={styles.sourceStatus}>
            <i
              className={
                payload?.stale
                  ? styles.staleDot
                  : styles.liveDot
              }
            />

            <span>
              {payload?.stale
                ? "STALE CACHE"
                : "FOREX FACTORY"}
            </span>

            {payload && (
              <small>
                updated{" "}
                {new Date(
                  payload.fetchedAt,
                ).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute:
                      "2-digit",
                  },
                )}
              </small>
            )}
          </div>
        </header>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <span>Period</span>

            <div
              className={styles.segmented}
            >
              {(
                [
                  ["TODAY", "Today"],
                  [
                    "TOMORROW",
                    "Tomorrow",
                  ],
                  [
                    "WEEK",
                    "This Week",
                  ],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    windowMode === value
                      ? styles.selected
                      : ""
                  }
                  onClick={() =>
                    setWindowMode(value)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span>Impact</span>

            <div
              className={styles.impactFilters}
            >
              {IMPACTS.map((impact) => (
                <button
                  key={impact}
                  type="button"
                  className={
                    impacts.has(impact)
                      ? styles.selected
                      : ""
                  }
                  onClick={() =>
                    toggleImpact(impact)
                  }
                >
                  <ImpactDots
                    impact={impact}
                  />
                  {impact}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span>Market</span>

            <div
              className={styles.segmented}
            >
              <button
                type="button"
                className={
                  usOnly
                    ? styles.selected
                    : ""
                }
                onClick={() =>
                  setUsOnly(true)
                }
              >
                US / USD
              </button>

              <button
                type="button"
                className={
                  !usOnly
                    ? styles.selected
                    : ""
                }
                onClick={() =>
                  setUsOnly(false)
                }
              >
                All
              </button>
            </div>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={loading}
          >
            {loading
              ? "LOADING..."
              : "REFRESH"}
          </button>
        </div>

        {error ? (
          <div className={styles.errorState}>
            <strong>
              ECONOMIC CALENDAR OFFLINE
            </strong>
            <span>{error}</span>
          </div>
        ) : loading && !payload ? (
          <div className={styles.emptyState}>
            Loading Economic Calendar...
          </div>
        ) : grouped.length === 0 ? (
          <div className={styles.emptyState}>
            No events match the current
            filters.
          </div>
        ) : (
          <div className={styles.eventGroups}>
            {grouped.map(
              ([dateLabel, events]) => (
                <section
                  key={dateLabel}
                  className={
                    styles.eventGroup
                  }
                >
                  <div
                    className={
                      styles.dateDivider
                    }
                  >
                    <span>
                      {dateLabel}
                    </span>
                    <i />
                    <small>
                      {events.length}{" "}
                      {events.length === 1
                        ? "event"
                        : "events"}
                    </small>
                  </div>

                  <div
                    className={
                      styles.eventTableHeader
                    }
                  >
                    <span>TIME</span>
                    <span>IMPACT</span>
                    <span>EVENT</span>
                    <span>ACTUAL</span>
                    <span>FORECAST</span>
                    <span>PREVIOUS</span>
                  </div>

                  <div
                    className={
                      styles.eventList
                    }
                  >
                    {events.map(
                      (event) => (
                        <EconomicEventRow
                          key={event.id}
                          event={event}
                          now={now}
                        />
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function EconomicEventRow({
  event,
  now,
}: {
  event: EconomicCalendarEvent;
  now: Date;
}) {
  const eventTime =
    new Date(event.date);

  const diff =
    eventTime.getTime() -
    now.getTime();

  const isUpcoming =
    diff > 0;

  const isSoon =
    isUpcoming &&
    diff <= 60 * 60 * 1000;

  const isRecent =
    diff <= 0 &&
    diff >= -15 * 60 * 1000;

  const time =
    localEventTime(event.date);

  return (
    <article
      className={`${styles.eventRow} ${
        event.impact === "High"
          ? styles.rowHigh
          : event.impact === "Medium"
            ? styles.rowMedium
            : styles.rowLow
      } ${
        isSoon || isRecent
          ? styles.rowActive
          : ""
      }`}
    >
      <div className={styles.timeCell}>
        <strong>{time.time}</strong>
        {(isSoon || isRecent) && (
          <small>
            {countdownText(
              event.date,
              now,
            )}
          </small>
        )}
      </div>

      <div className={styles.impactCell}>
        <ImpactDots
          impact={event.impact}
        />
        <span>{event.impact}</span>
      </div>

      <div className={styles.eventCell}>
        <strong>{event.title}</strong>

        <small>
          {event.country ?? "—"}
          {event.currency
            ? ` · ${event.currency}`
            : ""}
        </small>
      </div>

      <ValueCell
        value={event.actual}
        unit={event.unit}
        actual
      />

      <ValueCell
        value={event.forecast}
        unit={event.unit}
      />

      <ValueCell
        value={event.previous}
        unit={event.unit}
      />
    </article>
  );
}

function ValueCell({
  value,
  unit,
  actual = false,
}: {
  value: number | string | null;
  unit: string | null;
  actual?: boolean;
}) {
  return (
    <div
      className={`${styles.valueCell} ${
        actual &&
        value != null
          ? styles.actualValue
          : ""
      }`}
    >
      {formatEconomicValue(
        value,
        unit,
      )}
    </div>
  );
}
