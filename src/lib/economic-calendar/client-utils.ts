import type {
  EconomicCalendarEvent,
  EconomicImpact,
} from "./types";

export type CalendarWindow =
  | "TODAY"
  | "TOMORROW"
  | "WEEK";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(
  date: Date,
  days: number,
) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localWeekBounds(now: Date) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const weekday = start.getDay();

  const mondayOffset =
    weekday === 0 ? -6 : 1 - weekday;

  start.setDate(
    start.getDate() + mondayOffset,
  );

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function eventMatchesWindow(
  event: EconomicCalendarEvent,
  window: CalendarWindow,
  now = new Date(),
) {
  const date = new Date(event.date);

  if (window === "TODAY") {
    return (
      localDateKey(date) ===
      localDateKey(now)
    );
  }

  if (window === "TOMORROW") {
    return (
      localDateKey(date) ===
      localDateKey(
        addLocalDays(now, 1),
      )
    );
  }

  const { start, end } =
    localWeekBounds(now);

  return (
    date.getTime() >= start.getTime() &&
    date.getTime() <= end.getTime()
  );
}

export function filterEconomicEvents(
  events: EconomicCalendarEvent[],
  input: {
    window: CalendarWindow;
    impacts: Set<EconomicImpact>;
    usOnly: boolean;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();

  return events.filter((event) => {
    if (
      !eventMatchesWindow(
        event,
        input.window,
        now,
      )
    ) {
      return false;
    }

    if (!input.impacts.has(event.impact)) {
      return false;
    }

    if (
      input.usOnly &&
      event.country !== "US" &&
      event.currency !== "USD"
    ) {
      return false;
    }

    return true;
  });
}

export function nextHighImpactEvent(
  events: EconomicCalendarEvent[],
  input: {
    usOnly: boolean;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();

  return (
    events.find((event) => {
      if (event.impact !== "High") {
        return false;
      }

      if (
        input.usOnly &&
        event.country !== "US" &&
        event.currency !== "USD"
      ) {
        return false;
      }

      return (
        new Date(event.date).getTime() >=
        now.getTime()
      );
    }) ?? null
  );
}

export function countdownText(
  targetIso: string,
  now = new Date(),
) {
  const target = new Date(targetIso);
  const diff =
    target.getTime() - now.getTime();

  if (diff <= 0) {
    const elapsed =
      Math.abs(diff);

    if (elapsed < 60_000) {
      return "NOW";
    }

    const minutes = Math.floor(
      elapsed / 60_000,
    );

    return `${minutes}m AGO`;
  }

  const totalSeconds = Math.floor(
    diff / 1000,
  );

  const days = Math.floor(
    totalSeconds / 86_400,
  );

  const hours = Math.floor(
    (totalSeconds % 86_400) / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds =
    totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${String(
    seconds,
  ).padStart(2, "0")}s`;
}

export function formatEconomicValue(
  value: number | string | null,
  unit: string | null,
) {
  if (value == null || value === "") {
    return "—";
  }

  const rendered =
    typeof value === "number"
      ? new Intl.NumberFormat(
          "en-US",
          {
            maximumFractionDigits: 3,
          },
        ).format(value)
      : String(value);

  if (!unit) return rendered;

  if (
    unit === "%" ||
    unit.toLowerCase() === "percent"
  ) {
    return `${rendered}%`;
  }

  return `${rendered} ${unit}`;
}

export function localEventTime(
  iso: string,
) {
  const date = new Date(iso);

  return {
    time: date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ),

    date: date.toLocaleDateString(
      [],
      {
        weekday: "short",
        month: "short",
        day: "numeric",
      },
    ),
  };
}
