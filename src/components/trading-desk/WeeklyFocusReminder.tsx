"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWeeklyFocus } from "@/lib/weekly-focus/api-client";
import type { WeeklyFocusApiModel } from "@/lib/weekly-focus/types";
import { weeklyFocusWeekStartKey } from "@/lib/weekly-focus/week";
import styles from "./WeeklyFocusReminder.module.css";

export function WeeklyFocusReminder() {
  const [focus, setFocus] = useState<WeeklyFocusApiModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    const weekStart = weeklyFocusWeekStartKey(new Date());

    fetchWeeklyFocus(weekStart)
      .then((value) => {
        if (!cancelled) setFocus(value);
      })
      .catch(() => {
        if (!cancelled) setFocus(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeFocus = focus?.status === "ACTIVE" ? focus : null;

  return (
    <div className={styles.focusColumn} aria-label="This week's trading focus">
      <div className={styles.label}>
        <span>THIS WEEK&apos;S FOCUS</span>
        {activeFocus && <b>ACTIVE</b>}
      </div>
      <strong>{activeFocus?.primaryFocus ?? "No active focus"}</strong>
      <small>{activeFocus?.rule ?? "Set one concrete behavior for this trading week."}</small>
      <Link className={styles.link} href="/weekly-review">Open Weekly Review →</Link>
    </div>
  );
}
