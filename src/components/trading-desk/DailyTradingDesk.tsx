"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import type { Challenge } from "@/lib/challenges/types";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/api-client";
import type { EconomicCalendarPayload } from "@/lib/economic-calendar/types";
import { fetchTrades } from "@/lib/journal/api-client";
import type { TradeApiModel } from "@/lib/journal/types";
import {
  calculateDeskGuardrails,
  localDateKey,
  summarizeTradingDay,
} from "@/lib/trading-desk/summary";
import styles from "./DailyTradingDesk.module.css";

type DeskSettings = {
  accountId: string;
  maxRiskPerTrade: number;
  maxLosingTrades: number;
};

const SETTINGS_KEY = "ffz-trading-desk-settings-v1";

const DEFAULT_SETTINGS: DeskSettings = {
  accountId: "",
  maxRiskPerTrade: 100,
  maxLosingTrades: 3,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function normalizeSettings(input: Partial<DeskSettings>): DeskSettings {
  return {
    accountId: typeof input.accountId === "string" ? input.accountId : "",
    maxRiskPerTrade: Number.isFinite(input.maxRiskPerTrade)
      ? Math.max(0, input.maxRiskPerTrade ?? DEFAULT_SETTINGS.maxRiskPerTrade)
      : DEFAULT_SETTINGS.maxRiskPerTrade,
    maxLosingTrades: Number.isFinite(input.maxLosingTrades)
      ? Math.max(1, Math.floor(input.maxLosingTrades ?? DEFAULT_SETTINGS.maxLosingTrades))
      : DEFAULT_SETTINGS.maxLosingTrades,
  };
}

function formatTime(value: string | Date | null, timeZone?: string) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function countdownLabel(eventDate: string, now: Date) {
  const deltaMs = new Date(eventDate).getTime() - now.getTime();
  if (deltaMs <= 0) return "released";

  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `in ${hours}h ${remainder}m` : `in ${hours}h`;
}

export function DailyTradingDesk() {
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettings] = useState<DeskSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [calendar, setCalendar] = useState<EconomicCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const dateKey = localDateKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      setSettings(raw ? normalizeSettings(JSON.parse(raw) as Partial<DeskSettings>) : DEFAULT_SETTINGS);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [hydrated, settings]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    setCalendarError(null);

    const [challengeResult, tradeResult, calendarResult] = await Promise.allSettled([
      fetchChallenges(),
      fetchTrades(),
      fetchEconomicCalendar(),
    ]);

    if (challengeResult.status === "fulfilled") {
      setChallenges(challengeResult.value);
    } else {
      setError("Unable to load challenge data.");
    }

    if (tradeResult.status === "fulfilled") {
      setTrades(tradeResult.value);
    } else {
      setError((current) => current ?? "Unable to load Journal trades.");
    }

    if (calendarResult.status === "fulfilled") {
      setCalendar(calendarResult.value);
    } else {
      setCalendarError("Economic calendar is temporarily unavailable.");
    }

    setLastSyncedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!hydrated || challenges.length === 0) return;

    const accountIsValid = settings.accountId === "ALL"
      || settings.accountId === "NONE"
      || challenges.some((challenge) => challenge.id === settings.accountId);

    if (accountIsValid) return;

    const preferred = challenges.find((challenge) => challenge.status === "IN_PROGRESS") ?? challenges[0];
    setSettings((current) => ({ ...current, accountId: preferred?.id ?? "ALL" }));
  }, [challenges, hydrated, settings.accountId]);

  const selectedChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === settings.accountId) ?? null,
    [challenges, settings.accountId],
  );

  const challengeMetrics = useMemo(
    () => selectedChallenge ? calculateChallengeMetrics(selectedChallenge) : null,
    [selectedChallenge],
  );

  const accountFilter = settings.accountId || "ALL";

  const daySummary = useMemo(
    () => summarizeTradingDay(trades, now, accountFilter),
    [accountFilter, now, trades],
  );

  const challengeDailyLossRemaining = selectedChallenge && selectedChallenge.dailyLossLimit > 0
    ? Math.max(0, selectedChallenge.dailyLossLimit + Math.min(0, daySummary.netPnl))
    : null;

  const guardrails = useMemo(
    () => calculateDeskGuardrails({
      summary: daySummary,
      maxRiskPerTrade: settings.maxRiskPerTrade,
      maxLosingTrades: settings.maxLosingTrades,
      challengeRemainingDrawdown: challengeMetrics?.remainingDrawdown ?? null,
      challengeRemainingDailyLoss: challengeDailyLossRemaining,
      challengeFailed: selectedChallenge?.status === "FAILED",
    }),
    [challengeDailyLossRemaining, challengeMetrics?.remainingDrawdown, daySummary, selectedChallenge?.status, settings.maxLosingTrades, settings.maxRiskPerTrade],
  );

  const tradedInstruments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trade of daySummary.trades) {
      counts.set(trade.instrument, (counts.get(trade.instrument) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [daySummary.trades]);

  const highImpactEvents = useMemo(() => {
    if (!calendar) return [];

    return calendar.events
      .filter((event) =>
        event.impact === "High"
        && (event.currency === "USD" || event.country === "US")
        && localDateKey(event.date) === dateKey,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendar, dateKey]);

  const nextHighEvent = highImpactEvents.find(
    (event) => new Date(event.date).getTime() >= now.getTime(),
  ) ?? null;

  const statusClass = guardrails.status === "STOP"
    ? styles.stopStatus
    : guardrails.status === "CAUTION"
      ? styles.cautionStatus
      : styles.goStatus;

  function updateSettings<K extends keyof DeskSettings>(key: K, value: DeskSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className={styles.page}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button type="button" onClick={() => void load(true)}>Retry</button>
        </div>
      )}

      <section className={styles.monitorHeader}>
        <div className={styles.monitorIdentity}>
          <span className={styles.eyebrow}>LIVE RISK MONITOR</span>
          <strong>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</strong>
          <small>
            Local {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            <i>·</i>
            NY {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now)}
          </small>
        </div>

        <div className={styles.headerControls}>
          <label className={styles.accountPicker}>
            <span>ACCOUNT / CHALLENGE</span>
            <select value={settings.accountId} onChange={(event) => updateSettings("accountId", event.target.value)}>
              {!settings.accountId && <option value="">Loading account…</option>}
              <option value="ALL">All Journal accounts</option>
              <option value="NONE">Personal / no challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.name} · {challenge.status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.syncBlock}>
            <small>{lastSyncedAt ? `Synced ${formatTime(lastSyncedAt)}` : "Waiting for data"}</small>
            <button type="button" onClick={() => void load(true)} disabled={refreshing}>
              {refreshing ? "SYNCING…" : "SYNC DATA"}
            </button>
          </div>
        </div>
      </section>

      <section className={`${styles.guardrailBanner} ${statusClass}`}>
        <div>
          <span>RISK STATE</span>
          <strong>
            {guardrails.status === "STOP"
              ? "STOP TRADING"
              : guardrails.status === "CAUTION"
                ? "CAUTION — PROTECT THE DAY"
                : "INSIDE DAILY RISK LIMITS"}
          </strong>
        </div>
        <p>{guardrails.reasons[0]}</p>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>TODAY P&amp;L</span>
          <strong className={daySummary.netPnl > 0 ? styles.positive : daySummary.netPnl < 0 ? styles.negative : ""}>
            {signedMoney(daySummary.netPnl)}
          </strong>
          <small>Closed Journal trades</small>
        </article>

        <article className={styles.kpiCard}>
          <span>TRADES TODAY</span>
          <strong>{daySummary.totalTrades}</strong>
          <small>{daySummary.closedTrades} closed · {daySummary.openTrades} open</small>
        </article>

        <article className={styles.kpiCard}>
          <span>LOSING TRADES</span>
          <strong className={daySummary.losses >= settings.maxLosingTrades ? styles.negative : ""}>
            {daySummary.losses} / {settings.maxLosingTrades}
          </strong>
          <small>{guardrails.remainingLossSlots} loss slot{guardrails.remainingLossSlots === 1 ? "" : "s"} remaining</small>
        </article>

        <article className={styles.kpiCard}>
          <span>LOSS BUDGET</span>
          <strong>{money.format(guardrails.grossLossRemaining)}</strong>
          <small>{money.format(daySummary.grossLoss)} used of {money.format(guardrails.maxPlannedLoss)}</small>
        </article>

        <article className={styles.kpiCard}>
          <span>REMAINING DD</span>
          <strong>{challengeMetrics ? money.format(challengeMetrics.remainingDrawdown) : "—"}</strong>
          <small>{selectedChallenge ? selectedChallenge.name : "No single challenge selected"}</small>
        </article>

        <article className={styles.kpiCard}>
          <span>DAILY LOSS BUFFER</span>
          <strong>{challengeDailyLossRemaining == null ? "NO RULE" : money.format(challengeDailyLossRemaining)}</strong>
          <small>{selectedChallenge?.dailyLossLimit ? `${money.format(selectedChallenge.dailyLossLimit)} firm limit` : "No firm daily-loss rule"}</small>
        </article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>TODAY AT A GLANCE</span>
                <small>Automatically derived from Journal trades for the selected account.</small>
              </div>
            </header>

            <div className={styles.todayBody}>
              <div className={styles.outcomeGrid}>
                <div><span>WINS</span><strong className={styles.positive}>{daySummary.wins}</strong></div>
                <div><span>LOSSES</span><strong className={styles.negative}>{daySummary.losses}</strong></div>
                <div><span>BREAKEVEN</span><strong>{daySummary.breakeven}</strong></div>
                <div><span>OPEN</span><strong>{daySummary.openTrades}</strong></div>
              </div>

              <div className={styles.instrumentSection}>
                <span>INSTRUMENTS TRADED TODAY</span>
                <div className={styles.instrumentChips}>
                  {tradedInstruments.length === 0 && <small>No trades recorded today.</small>}
                  {tradedInstruments.map(([instrument, count]) => (
                    <b key={instrument}>{instrument}<i>{count}</i></b>
                  ))}
                </div>
              </div>

              <div className={styles.quickLinks}>
                <Link href="/journal">Open Journal</Link>
                <Link href="/tools/risk-calculator">Risk Calculator</Link>
                <Link href="/economic-calendar">Full Calendar</Link>
              </div>
            </div>
          </article>

          <article className={`${styles.panel} ${styles.compactPanel}`}>
            <header className={styles.panelHeader}>
              <div>
                <span>PERSONAL RISK RULES</span>
                <small>Set these once. They stay saved and are applied automatically every day.</small>
              </div>
            </header>

            <div className={styles.rulesBody}>
              <label>
                <span>MAX RISK / TRADE</span>
                <div className={styles.moneyField}>
                  <b>$</b>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={settings.maxRiskPerTrade}
                    onChange={(event) => updateSettings("maxRiskPerTrade", Math.max(0, Number(event.target.value) || 0))}
                  />
                </div>
              </label>

              <label>
                <span>MAX LOSING TRADES / DAY</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={settings.maxLosingTrades}
                  onChange={(event) => updateSettings("maxLosingTrades", Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                />
              </label>

              <div className={styles.ruleSummary}>
                <span>PLANNED DAILY LOSS BUDGET</span>
                <strong>{money.format(settings.maxRiskPerTrade * settings.maxLosingTrades)}</strong>
                <small>{settings.maxLosingTrades} × {money.format(settings.maxRiskPerTrade)}</small>
              </div>
            </div>
          </article>
        </div>

        <div className={styles.rightColumn}>
          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>CHALLENGE PROTECTION</span>
                <small>Current prop-firm limits for the selected challenge.</small>
              </div>
            </header>

            <div className={styles.guardrailsBody}>
              <div className={styles.guardrailRow}><span>Current balance</span><strong>{selectedChallenge ? money.format(selectedChallenge.currentBalance) : "—"}</strong></div>
              <div className={styles.guardrailRow}><span>Drawdown floor</span><strong>{challengeMetrics ? money.format(challengeMetrics.drawdownFloor) : "—"}</strong></div>
              <div className={styles.guardrailRow}><span>Remaining drawdown</span><strong>{challengeMetrics ? money.format(challengeMetrics.remainingDrawdown) : "—"}</strong></div>
              <div className={styles.guardrailRow}><span>Firm daily-loss limit</span><strong>{selectedChallenge?.dailyLossLimit ? money.format(selectedChallenge.dailyLossLimit) : "No rule"}</strong></div>
              <div className={styles.guardrailRow}><span>Challenge health</span><strong className={challengeMetrics?.health === "DANGER" ? styles.negative : challengeMetrics?.health === "CAUTION" ? styles.cautionText : challengeMetrics ? styles.positive : ""}>{challengeMetrics?.health ?? "—"}</strong></div>
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>USD HIGH-IMPACT NEWS</span>
                <small>{calendar?.stale ? "Cached feed · provider currently stale" : "Next Forex Factory event today"}</small>
              </div>
              {nextHighEvent && <strong className={styles.nextEvent}>{countdownLabel(nextHighEvent.date, now)}</strong>}
            </header>

            <div className={styles.newsList}>
              {calendarError && <div className={styles.newsEmpty}>{calendarError}</div>}
              {!calendarError && !nextHighEvent && (
                <div className={styles.newsEmpty}>{loading ? "Loading economic calendar…" : "No upcoming USD high-impact events today."}</div>
              )}

              {nextHighEvent && (
                <div className={styles.newsItem} key={nextHighEvent.id}>
                  <div className={styles.newsTime}>
                    <strong>{formatTime(nextHighEvent.date, "America/New_York")}</strong>
                    <small>NY · {formatTime(nextHighEvent.date)} local</small>
                  </div>
                  <div className={styles.newsTitle}>
                    <strong>{nextHighEvent.title}</strong>
                    <small>Forecast {nextHighEvent.forecast ?? "—"} · Previous {nextHighEvent.previous ?? "—"}</small>
                  </div>
                  <span>{countdownLabel(nextHighEvent.date, now)}</span>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
