"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  calculateJournalAnalytics,
  type JournalAnalyticsFilters,
  type JournalBreakdownRow,
} from "@/lib/journal/analytics";
import { fetchTrades } from "@/lib/journal/api-client";
import {
  ALL_SETUPS,
  calculateSetupTimeOfDayBreakdown,
  filterTradesBySetup,
  setupOptionsFromTrades,
} from "@/lib/journal/setup-analytics";
import type { TradeApiModel } from "@/lib/journal/types";
import { SetupAnalyticsPanel } from "./SetupAnalyticsPanel";
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
  const zeroOffset = ((zeroY - padY) / (height - padY * 2)) * 100;

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.equityChart} preserveAspectRatio="none">
        <defs>
          <linearGradient id="journalAnalyticsStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#30d0f8" />
            <stop offset="100%" stopColor="#a070e8" />
          </linearGradient>
          <linearGradient
            id="journalAnalyticsFill"
            x1="0"
            y1={padY}
            x2="0"
            y2={height - padY}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#31d7a1" stopOpacity="0.16" />
            <stop offset={`${zeroOffset}%`} stopColor="#31d7a1" stopOpacity="0.04" />
            <stop offset={`${zeroOffset}%`} stopColor="#ff6675" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ff6675" stopOpacity="0.16" />
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
          <line
            x1={padX}
            x2={width - padX}
            y1={zeroY}
            y2={zeroY}
            className={styles.zeroLine}
          />
        )}

        <path
          d={`${path} L${coords.at(-1)?.x ?? width - padX},${zeroY} L${coords[0]?.x ?? padX},${zeroY} Z`}
          fill="url(#journalAnalyticsFill)"
        />
        <path d={path} fill="none" stroke="url(#journalAnalyticsStroke)" strokeWidth="3" />
      </svg>

      <div className={styles.chartLabels}>
        <span>{money.format(max)}</span>
        <strong className={tone(last)}>{signedMoney(last)}</strong>
        <span>{money.format(min)}</span>
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  subtitle,
  rows,
  empty,
  limit,
}: {
  title: string;
  subtitle: string;
  rows: JournalBreakdownRow[];
  empty: string;
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;

  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>{title}</span>
          <small>{subtitle}</small>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className={styles.tableEmpty}>{empty}</div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.breakdownTable}>
            <thead>
              <tr>
                <th>GROUP</th>
                <th>TRADES</th>
                <th>WIN RATE</th>
                <th>AVG R</th>
                <th>NET P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.trades}</td>
                  <td>{row.winRate == null ? "—" : `${row.winRate}%`}</td>
                  <td>{row.averageR == null ? "—" : `${row.averageR > 0 ? "+" : ""}${number.format(row.averageR)}R`}</td>
                  <td className={tone(row.netPnl)}>{signedMoney(row.netPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function JournalAnalytics() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filters, setFilters] = useState<JournalAnalyticsFilters>(defaultFilters);
  const [selectedSetup, setSelectedSetup] = useState(ALL_SETUPS);
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

  const setupOptions = useMemo(
    () => setupOptionsFromTrades(trades),
    [trades],
  );

  const setupScopedTrades = useMemo(
    () => filterTradesBySetup(trades, selectedSetup),
    [selectedSetup, trades],
  );

  const analytics = useMemo(
    () => calculateJournalAnalytics(setupScopedTrades, filters),
    [setupScopedTrades, filters],
  );

  const comparisonAnalytics = useMemo(
    () => calculateJournalAnalytics(trades, filters),
    [trades, filters],
  );

  const timeOfDayRows = useMemo(
    () => calculateSetupTimeOfDayBreakdown(analytics.filteredTrades),
    [analytics.filteredTrades],
  );

  function resetFilters() {
    setFilters(defaultFilters);
    setSelectedSetup(ALL_SETUPS);
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
        <div className={styles.filters}>
          <label>
            <span>PERIOD</span>
            <select
              value={filters.period}
              onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as JournalAnalyticsFilters["period"] }))}
            >
              <option value="ALL">All time</option>
              <option value="30D">Last 30 days</option>
              <option value="90D">Last 90 days</option>
              <option value="YTD">Year to date</option>
            </select>
          </label>

          <label>
            <span>CHALLENGE</span>
            <select
              value={filters.challengeId}
              onChange={(event) => setFilters((current) => ({ ...current, challengeId: event.target.value }))}
            >
              <option value="ALL">All accounts</option>
              <option value="NONE">Personal / no challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>{challenge.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>SETUP</span>
            <select value={selectedSetup} onChange={(event) => setSelectedSetup(event.target.value)}>
              <option value={ALL_SETUPS}>All setups</option>
              {setupOptions.map((setup) => (
                <option key={setup} value={setup}>{setup}</option>
              ))}
            </select>
          </label>

          <label>
            <span>INSTRUMENT</span>
            <select
              value={filters.instrument}
              onChange={(event) => setFilters((current) => ({ ...current, instrument: event.target.value as JournalAnalyticsFilters["instrument"] }))}
            >
              <option value="ALL">All</option>
              <option value="MNQ">MNQ</option>
              <option value="MES">MES</option>
              <option value="NQ">NQ</option>
              <option value="ES">ES</option>
            </select>
          </label>

          <label>
            <span>DIRECTION</span>
            <select
              value={filters.direction}
              onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value as JournalAnalyticsFilters["direction"] }))}
            >
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
          <span>PROFIT FACTOR</span>
          <strong>{ratio(analytics.profitFactor)}</strong>
          <small>Gross wins / gross losses</small>
        </article>

        <article className={styles.kpiCard}>
          <span>WIN RATE</span>
          <strong>{analytics.winRate == null ? "—" : `${analytics.winRate}%`}</strong>
          <small>{analytics.wins}W · {analytics.losses}L · {analytics.breakeven}BE</small>
        </article>

        <article className={styles.kpiCard}>
          <span>AVERAGE R</span>
          <strong>{analytics.averageR == null ? "—" : `${analytics.averageR > 0 ? "+" : ""}${number.format(analytics.averageR)}R`}</strong>
          <small>Risk-adjusted trade result</small>
        </article>

        <article className={styles.kpiCard}>
          <span>EXPECTANCY</span>
          <strong className={tone(analytics.expectancy)}>{analytics.expectancy == null ? "—" : signedMoney(analytics.expectancy)}</strong>
          <small>Average net P&amp;L per closed trade</small>
        </article>
      </section>

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

      <section className={styles.performanceStrip}>
        <article><span>AVG WIN</span><strong className={styles.positive}>{analytics.averageWin == null ? "—" : money.format(analytics.averageWin)}</strong></article>
        <article><span>AVG LOSS</span><strong className={styles.negative}>{analytics.averageLoss == null ? "—" : money.format(analytics.averageLoss)}</strong></article>
        <article><span>BEST TRADE</span><strong className={styles.positive}>{analytics.bestTrade == null ? "—" : money.format(analytics.bestTrade)}</strong></article>
        <article><span>WORST TRADE</span><strong className={styles.negative}>{analytics.worstTrade == null ? "—" : money.format(analytics.worstTrade)}</strong></article>
        <article><span>STREAKS</span><strong>{analytics.maxWinStreak}W / {analytics.maxLossStreak}L</strong></article>
      </section>

      <SetupAnalyticsPanel
        selectedSetup={selectedSetup}
        comparisonRows={comparisonAnalytics.bySetup}
        timeOfDayRows={timeOfDayRows}
        onSelectSetup={setSelectedSetup}
      />

      <section className={styles.breakdownGrid}>
        <BreakdownTable
          title="EXECUTION DISCIPLINE"
          subtitle="Performance when you follow, bend or ignore the plan"
          rows={analytics.byExecution}
          empty="Review closed trades in Journal to compare on-plan, deviated and unplanned execution."
        />
        <BreakdownTable
          title="MINDSET PERFORMANCE"
          subtitle="Results grouped by your post-trade mindset review"
          rows={analytics.byMindset}
          empty="Add mindset reviews in Journal to see how state and performance relate."
        />
      </section>

      <section className={`${styles.breakdownGrid} ${styles.secondaryBreakdowns}`}>
        <BreakdownTable
          title="INSTRUMENT PERFORMANCE"
          subtitle="Where your P&L is actually coming from"
          rows={analytics.byInstrument}
          empty="No instrument data for this filter."
        />
        <BreakdownTable
          title="DIRECTION PERFORMANCE"
          subtitle="Long versus short execution"
          rows={analytics.byDirection}
          empty="No direction data for this filter."
        />
        <BreakdownTable
          title="DAY OF WEEK"
          subtitle="Closed-trade performance by weekday"
          rows={analytics.byWeekday}
          empty="No weekday data for this filter."
        />
        <BreakdownTable
          title="TAG PERFORMANCE"
          subtitle="Performance of your trade classifications"
          rows={analytics.byTag}
          empty="Add tags such as A+, scalp or trend to unlock this view."
          limit={10}
        />
      </section>

      <article className={`${styles.panel} ${styles.readoutPanel}`}>
        <header className={styles.panelHeader}>
          <div>
            <span>ANALYTICS READOUT</span>
            <small>How to interpret the current sample</small>
          </div>
        </header>
        <div className={styles.readoutBody}>
          <div>
            <span>SAMPLE SIZE</span>
            <strong>{analytics.closedCount}</strong>
            <small>closed trades in current filters</small>
          </div>
          <p>
            Setup, tag, instrument, direction, weekday and discipline statistics use only closed trades. Open trades stay visible in the total count but do not affect P&amp;L metrics.
          </p>
          <p>
            Time-of-day analytics use each trade&apos;s entry timestamp converted to America/New_York. Discipline analytics only include trades with an explicit Execution or Mindset review, so missing reviews are never guessed.
          </p>
          {loading && <small className={styles.loading}>Refreshing journal data…</small>}
        </div>
      </article>
    </main>
  );
}
