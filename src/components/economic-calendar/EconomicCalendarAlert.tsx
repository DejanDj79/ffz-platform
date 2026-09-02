"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/api-client";
import {
  countdownText,
} from "@/lib/economic-calendar/client-utils";
import type {
  EconomicCalendarPayload,
} from "@/lib/economic-calendar/types";
import styles from "./EconomicCalendarAlert.module.css";

export function EconomicCalendarAlert() {
  const [payload, setPayload] =
    useState<EconomicCalendarPayload | null>(
      null,
    );

  const [now, setNow] =
    useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next =
          await fetchEconomicCalendar();

        if (!cancelled) {
          setPayload(next);
        }
      } catch {
        // Calendar page itself shows provider errors.
        // The global alert should fail silently.
      }
    }

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
      cancelled = true;
      window.clearInterval(dataTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const event = useMemo(() => {
    if (!payload) return null;

    const nowMs = now.getTime();

    return (
      payload.events.find((item) => {
        if (item.impact !== "High") {
          return false;
        }

        if (
          item.country !== "US" &&
          item.currency !== "USD"
        ) {
          return false;
        }

        const diff =
          new Date(
            item.date,
          ).getTime() - nowMs;

        return (
          diff <= 60 * 60 * 1000 &&
          diff >= -15 * 60 * 1000
        );
      }) ?? null
    );
  }, [payload, now]);

  if (!event) return null;

  const diff =
    new Date(event.date).getTime() -
    now.getTime();

  return (
    <Link
      href="/economic-calendar"
      className={
        styles.alert
      }
    >
      <span
        className={
          styles.alertImpact
        }
      >
        <i />
        HIGH IMPACT
      </span>

      <strong>{event.title}</strong>

      <span
        className={
          styles.alertCountdown
        }
      >
        {diff > 0 ? "IN " : ""}
        {countdownText(
          event.date,
          now,
        )}
      </span>

      <small>
        OPEN ECONOMIC CALENDAR →
      </small>
    </Link>
  );
}
