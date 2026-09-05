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

  if (!focus || focus.status !== "ACTIVE") return null;

  return (
    <aside className={styles.reminder} aria-label="This week's trading focus">
      <div className={styles.focusLine}>
        <div className={styles.label}>
          <span>THIS WEEK&apos;S FOCUS</span>
          <b>ACTIVE</b>
        </div>
        <strong>{focus.primaryFocus}</strong>
        <small>{focus.rule}</small>
      </div>
      <Link className={styles.link} href="/weekly-review">Open Weekly Review →</Link>
    </aside>
  );
}
