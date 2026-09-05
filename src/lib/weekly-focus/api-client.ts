"use client";

import type { SaveWeeklyFocusInput, WeeklyFocusApiModel } from "./types";

async function parseResponse(response: Response) {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : `Weekly focus request failed (${response.status}).`,
    );
  }
  return json.data as WeeklyFocusApiModel | null;
}

export async function fetchWeeklyFocus(weekStart: string) {
  return parseResponse(
    await fetch(`/api/weekly-focus?weekStart=${encodeURIComponent(weekStart)}`, {
      cache: "no-store",
    }),
  );
}

export async function saveWeeklyFocusViaApi(input: SaveWeeklyFocusInput) {
  const result = await parseResponse(
    await fetch("/api/weekly-focus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  if (!result) throw new Error("Weekly focus response was empty.");
  return result;
}
