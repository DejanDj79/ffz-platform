import type { TradeApiModel } from "@/lib/journal/types";
import type {
  ScoreboardCalendarDay,
  ScoreboardPerformance,
} from "./types";

type ChallengeLike = {
  id: string;
  name: string;
  propFirm: string;
  status: string;
  phase: string;

  accountSize: number;
  startingBalance: number;
  currentBalance: number;

  profitTarget: number;
  maxDrawdown: number;
  dailyLossLimit: number | null;

  daysTraded: number;
  createdAt: string;
};

const STATUS_PRIORITY = [
  "ACTIVE",
  "IN_PROGRESS",
  "FUNDED",
  "NOT_STARTED",
  "PAUSED",
  "PASSED",
];

const SCOREBOARD_TIME_ZONE = "Europe/Belgrade";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function selectScoreboardChallenge<T extends ChallengeLike>(
  challenges: T[],
  selectedId: string | null,
): T | null {
  if (selectedId) {
    const selected = challenges.find(
      (challenge) => challenge.id === selectedId,
    );

    if (selected) return selected;
  }

  for (const status of STATUS_PRIORITY) {
    const match = challenges.find(
      (challenge) => challenge.status === status,
    );

    if (match) return match;
  }

  return challenges[0] ?? null;
}

export function calculateScoreboardChallenge(
  challenge: ChallengeLike | null,
) {
  if (!challenge) return null;

  const pnl = challenge.currentBalance - challenge.startingBalance;

  const targetRemaining = Math.max(
    0,
    challenge.profitTarget - pnl,
  );

  const targetProgressPct =
    challenge.profitTarget > 0
      ? clamp((pnl / challenge.profitTarget) * 100, 0, 100)
      : 0;

  const percentOfAccount = (amount: number | null) => {
    if (amount == null || challenge.accountSize <= 0) return null;
    return round((amount / challenge.accountSize) * 100, 2);
  };

  return {
    id: challenge.id,
    name: challenge.name,
    propFirm: challenge.propFirm,
    status: challenge.status,
    phase: challenge.phase,

    accountSize: challenge.accountSize,
    startingBalance: challenge.startingBalance,
    currentBalance: challenge.currentBalance,
    pnl,

    profitTarget: challenge.profitTarget,
    profitTargetPct: percentOfAccount(challenge.profitTarget) ?? 0,

    maxDrawdown: challenge.maxDrawdown,
    maxDrawdownPct: percentOfAccount(challenge.maxDrawdown) ?? 0,

    dailyLossLimit: challenge.dailyLossLimit,
    dailyLossLimitPct: percentOfAccount(challenge.dailyLossLimit),

    daysTraded: challenge.daysTraded,

    targetRemaining,
    targetProgressPct,

    createdAt: challenge.createdAt,
  };
}

export function calculateScoreboardPerformance(
  trades: TradeApiModel[],
): ScoreboardPerformance {
  const values = trades
    .filter(
      (trade) =>
        trade.status === "CLOSED" &&
        trade.netPnl != null,
    )
    .map((trade) => trade.netPnl as number);

  const wins = values.filter((value) => value > 0);
  const losses = values.filter((value) => value < 0);

  return {
    bestTrade: values.length > 0 ? round(Math.max(...values)) : null,
    worstTrade: values.length > 0 ? round(Math.min(...values)) : null,

    averageWin:
      wins.length > 0
        ? round(
            wins.reduce((sum, value) => sum + value, 0) /
              wins.length,
          )
        : null,

    averageLoss:
      losses.length > 0
        ? round(
            losses.reduce((sum, value) => sum + value, 0) /
              losses.length,
          )
        : null,
  };
}

function zonedParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCOREBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
}

function dateKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

export function buildMonthlyScoreboardCalendar(
  trades: TradeApiModel[],
  now = new Date(),
) {
  const today = zonedParts(now);
  const daysInMonth = new Date(
    Date.UTC(today.year, today.month, 0),
  ).getUTCDate();

  const pnlByDay = new Map<number, number>();

  for (const trade of trades) {
    if (
      trade.status !== "CLOSED" ||
      trade.netPnl == null
    ) {
      continue;
    }

    const opened = new Date(trade.openedAt);
    const parts = zonedParts(opened);

    if (
      parts.year !== today.year ||
      parts.month !== today.month
    ) {
      continue;
    }

    pnlByDay.set(
      parts.day,
      (pnlByDay.get(parts.day) ?? 0) + trade.netPnl,
    );
  }

  const days: ScoreboardCalendarDay[] = Array.from(
    { length: 31 },
    (_, index) => {
      const day = index + 1;

      if (day > daysInMonth) {
        return {
          day,
          pnl: 0,
          status: "OUTSIDE_MONTH" as const,
        };
      }

      if (day > today.day) {
        return {
          day,
          pnl: 0,
          status: "FUTURE" as const,
        };
      }

      const pnl = round(pnlByDay.get(day) ?? 0);

      if (!pnlByDay.has(day)) {
        return {
          day,
          pnl: 0,
          status: "NO_TRADE" as const,
        };
      }

      return {
        day,
        pnl,
        status:
          pnl > 0
            ? ("PROFIT" as const)
            : pnl < 0
              ? ("LOSS" as const)
              : ("NO_TRADE" as const),
      };
    },
  );

  return {
    label: monthLabel(today.year, today.month),
    days,
  };
}

export function calculateJourneyDay(
  startDateIso: string | null,
  now = new Date(),
) {
  if (!startDateIso) return 1;

  const start = new Date(startDateIso);

  if (Number.isNaN(start.getTime())) return 1;

  const startParts = zonedParts(start);
  const nowParts = zonedParts(now);

  const startUtc = Date.UTC(
    startParts.year,
    startParts.month - 1,
    startParts.day,
  );

  const nowUtc = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day,
  );

  return Math.max(
    1,
    Math.floor((nowUtc - startUtc) / 86_400_000) + 1,
  );
}
