"use client";

import { useEffect, useMemo, useState } from "react";
import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  calculateJournalAnalytics,
  type JournalAnalyticsFilters,
} from "@/lib/journal/analytics";
import { fetchTrades } from "@/lib/journal/api-client";
import type { TradeApiModel } from "@/lib/journal/types";
import { TradingCalendar } from "./TradingCalendar";
import styles from "./JournalAnalytics.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const defaultFilters: JournalAnalyticsFilters = {
  period: "ALL",
  instrument: "ALL",
  direction: "ALL",
  challengeId: "ALL",
};

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function tone(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

function ratio(value: number | null) {
  if (value == null) return "—";
  if (value === Infinity) return "∞";
  return number.format(value);
}

function EquityCurve({
  points,
}: {
  points: ReturnType<typeof calculateJournalAnalytics>["equityCurve"];
}) {
  if (points.length === 0) {
    return <div className={styles.chartEmpty}>No closed trades in this filter.</div>;
  }

  const width = 900;
  const height = 260;
  const padX = 22;
  const padY = 24;
  const values = [0, ...points.map((point) => point.cumulativePnl)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const coords = points.map((point, index) => ({
    x:
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * (width - padX * 2),
    y:
      padY +
      ((max - point.cumulativePnl) / span) * (height - padY * 2),
  }));

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const last = points.at(-1)?.cumulativePnl ?? 0;
  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.equityChart} preserveAspectRatio="none">
        <defs>
          <linearGradient id="freeJournalStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#30d0f8" />
            <stop offset="100%" stopColor="#a070e8" />
          </linearGradient>
          <linearGradient id="freeJournalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d0f8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#30d0f8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.2, 0.4, 0.6, 0.8].map((ratioValue) => (
          <line
            key={ratioValue}
            x1={padX}
            x2={width - padX}
            y1={height * ratioValue}
            y2={height * ratioValue}
            className={styles.gridLine}
          />
        ))}

        {zeroY >= 0 && zeroY <= height && (
          <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} className={styles.zeroLine} />
        )}

        <path
          d={`${path} L${coords.at(-1)?.x ?? width - padX},${height - padY} L${coords[0]?.x ?? padX},${height - padY} Z`}
          fill="url(#freeJournalFill)"
        />
        <path d={path} fill="none" stroke="url(#freeJournalStroke)" strokeWidth="3" />
      </svg>

      <div className={styles.chartLabels}>
        <span>{money.format(max)}</span>
        <strong className={tone(last)}>{signedMoney(last)}</strong>
        <span>{money.format(min)}</span>
      </div>
    </div>
  );
}

export function FreeJournalAnalytics() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filters, setFilters] = useState<JournalAnalyticsFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [nextTrades, nextChallenges] = await Promise.all([
        fetchTrades(),
        fetchChallenges(),
      ]);
      setTrades(nextTrades);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Journal Analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const analytics = useMemo(
    () => calculateJournalAnalytics(trades, filters),
    [trades, filters],
  );

  function resetFilters() {
    setFilters(defaultFilters);
  }

  return (
    <main className={styles.page}>
      {error && (
        <div className={styles.error}>
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Retry</button>
        </div>
      )}

      <section className={styles.filterPanel}>
        <div>
          <span className={styles.eyebrow}>FFZ FREE</span>
          <strong>Performance Analytics</strong>
          <small>Core performance metrics stay free. Setup and time-of-day edge analysis are available with FFZ Pro.</small>
        </div>

        <div className={styles.filters}>
          <label>
            <span>PERIOD</span>
            <select value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as JournalAnalyticsFilters["period"] }))}>
              <option value="ALL">All time</option>
              <option value="30D">Last 30 days</option>
              <option value="90D">Last 90 days</option>
              <option value="YTD">Year to date</option>
            </select>
          </label>

          <label>
            <span>CHALLENGE</span>
            <select value={filters.challengeId} onChange={(event) => setFilters((current) => ({ ...current, challengeId: event.target.value }))}>
              <option value="ALL">All accounts</option>
              <option value="NONE">Personal / no challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>{challenge.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>INSTRUMENT</span>
            <select value={filters.instrument} onChange={(event) => setFilters((current) => ({ ...current, instrument: event.target.value as JournalAnalyticsFilters["instrument"] }))}>
              <option value="ALL">All</option>
              <option value="MNQ">MNQ</option>
              <option value="MES">MES</option>
              <option value="NQ">NQ</option>
              <option value="ES">ES</option>
            </select>
          </label>

          <label>
            <span>DIRECTION</span>
            <select value={filters.direction} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value as JournalAnalyticsFilters["direction"] }))}>
              <option value="ALL">Long + Short</option>
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </label>

          <button type="button" onClick={resetFilters}>RESET</button>
        </div>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>NET P&amp;L</span>
          <strong className={tone(analytics.netPnl)}>{signedMoney(analytics.netPnl)}</strong>
          <small>{analytics.closedCount} closed · {analytics.totalTrades} total</small>
        </article>
        <article className={styles.kpiCard}>
          <span>WIN RATE</span>
          <strong>{analytics.winRate == null ? "—" : `${analytics.winRate}%`}</strong>
          <small>{analytics.wins}W · {analytics.losses}L · {analytics.breakeven}BE</small>
        </article>
        <article className={styles.kpiCard}>
          <span>PROFIT FACTOR</span>
          <strong>{ratio(analytics.profitFactor)}</strong>
          <small>Gross wins / gross losses</small>
        </article>
        <article className={styles.kpiCard}>
          <span>AVG WIN</span>
          <strong className={styles.positive}>{analytics.averageWin == null ? "—" : money.format(analytics.averageWin)}</strong>
          <small>Average net result of winning trades</small>
        </article>
        <article className={styles.kpiCard}>
          <span>AVG LOSS</span>
          <strong className={styles.negative}>{analytics.averageLoss == null ? "—" : money.format(analytics.averageLoss)}</strong>
          <small>Average net result of losing trades</small>
        </article>
      </section>

      <div className={styles.proGateSpacing}>
        <ProFeatureGate
          title="Discover where your trading edge actually comes from"
          description="FFZ Pro unlocks setup comparison and New York time-of-day analytics without removing any of your existing Journal data."
          features={["Setup Edge comparison", "Setup-focused page filtering", "Time-of-day performance", "Expectancy and average R by setup"]}
        />
      </div>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>EQUITY CURVE</span>
              <small>Cumulative net P&amp;L for the current filters</small>
            </div>
            <strong className={tone(analytics.netPnl)}>{signedMoney(analytics.netPnl)}</strong>
          </header>
          <EquityCurve points={analytics.equityCurve} />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>TRADING CALENDAR</span>
              <small>Daily P&amp;L and trade count by calendar day</small>
            </div>
          </header>
          <TradingCalendar points={analytics.dailyPnl} />
        </article>
      </section>

      {loading && <small className={styles.loading}>Refreshing journal data…</small>}
    </main>
  );
}