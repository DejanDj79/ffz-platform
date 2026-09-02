"use client";

import type {
  EconomicCalendarPayload,
} from "./types";

export async function fetchEconomicCalendar(): Promise<EconomicCalendarPayload> {
  const response = await fetch(
    "/api/economic-calendar",
    {
      cache: "no-store",
    },
  );

  const json = await response.json();

  if (!response.ok) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Economic Calendar request failed (${response.status}).`;

    throw new Error(message);
  }

  return json.data as EconomicCalendarPayload;
}
