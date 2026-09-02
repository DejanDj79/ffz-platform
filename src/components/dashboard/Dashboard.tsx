"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import { fetchTrades } from "@/lib/journal/api-client";
import type { TradeApiModel } from "@/lib/journal/types";
import { fetchLedgerEntries } from "@/lib/ledger/api-client";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/api-client";
import type { EconomicCalendarPayload } from "@/lib/economic-calendar/types";
import {
  countdownText,
  filterEconomicEvents,
  localEventTime,
  nextHighImpactEvent,
} from "@/lib/economic-calendar/client-utils";
import { CATEGORY_LABELS } from "@/lib/ledger/presentation";
import {
  calculateDashboardSummary,
  type EquityPoint,
} from "@/lib/dashboard/summary";
import styles from "./Dashboard.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

type RecentItem = {
  id: string;
  timestamp: string;
  kind: "TRADE" | "LEDGER";
  title: string;
  sub: string;
  amount: number | null;
  tone: "positive" | "negative" | "neutral";
  href: string;
};

function recentActivity(
  trades: TradeApiModel[],
  ledgerEntries: LedgerEntryApiModel[],
): RecentItem[] {
  const tradeItems: RecentItem[] = trades.map((trade) => ({
    id: `trade-${trade.id}`,
    timestamp: trade.closedAt ?? trade.openedAt,
    kind: "TRADE",
    title: `${trade.instrument} ${trade.direction}`,
    sub:
      trade.status === "OPEN"
        ? `Open · ${trade.contracts} contract${trade.contracts === 1 ? "" : "s"}`
        : `${trade.outcome ?? "Closed"} · ${
            trade.rMultiple == null
              ? "—"
              : `${trade.rMultiple > 0 ? "+" : ""}${number.format(trade.rMultiple)}R`
          }${trade.setup ? ` · ${trade.setup}` : ""}`,
    amount: trade.netPnl,
    tone:
      trade.netPnl == null
        ? "neutral"
        : trade.netPnl > 0
          ? "positive"
          : trade.netPnl < 0
            ? "negative"
            : "neutral",
    href: "/journal",
  }));

  const ledgerItems: RecentItem[] = ledgerEntries.map((entry) => ({
    id: `ledger-${entry.id}`,
    timestamp: entry.occurredAt,
    kind: "LEDGER",
    title: CATEGORY_LABELS[entry.category],
    sub: entry.provider || entry.description || "Real Money Ledger",
    amount: entry.entryType === "INCOME" ? entry.amount : -entry.amount,
    tone: entry.entryType === "INCOME" ? "positive" : "negative",
    href: "/ledger",
  }));

  return [...tradeItems, ...ledgerItems]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 7);
}

function challengeStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function toneClass(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

function formatSignedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}

function EquityChart({ points }: { points: EquityPoint[] }) {
  const width = 720;
  const height = 210;
  const padX = 18;
  const padY = 18;

  if (points.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        Close trades in the Journal to build your equity curve.
      </div>
    );
  }

  const values = [0, ...points.map((point) => point.value)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const chartPoints = [
    { timestamp: points[0].timestamp, value: 0 },
    ...points,
  ].slice(-40);

  const coords = chartPoints.map((point, index) => {
    const x =
      padX +
      (index / Math.max(1, chartPoints.length - 1)) * (width - padX * 2);
    const y =
      padY +
      ((max - point.value) / span) * (height - padY * 2);
    return { x, y };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);
  const last = points.at(-1)?.value ?? 0;

  return (
    <div className={styles.chartWrap}>
      <svg
        className={styles.equityChart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Journal cumulative net P&L equity curve"
      >
        <defs>
          <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#30d0f8" />
            <stop offset="100%" stopColor="#a070e8" />
          </linearGradient>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d0f8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#30d0f8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padY + ratio * (height - padY * 2)}
            y2={padY + ratio * (height - padY * 2)}
            className={styles.chartGridLine}
          />
        ))}

        {zeroY >= padY && zeroY <= height - padY && (
          <line
            x1={padX}
            x2={width - padX}
            y1={zeroY}
            y2={zeroY}
            className={styles.zeroLine}
          />
        )}

        <path
          d={`${path} L${coords.at(-1)?.x ?? width - padX},${height - padY} L${coords[0]?.x ?? padX},${height - padY} Z`}
          fill="url(#equityFill)"
        />
        <path d={path} fill="none" stroke="url(#equityStroke)" strokeWidth="3" />
      </svg>

      <div className={styles.chartScale}>
        <span>{money.format(max)}</span>
        <strong className={toneClass(last)}>{formatSignedMoney(last)}</strong>
        <span>{money.format(min)}</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryApiModel[]>([]);
  const [calendar, setCalendar] = useState<EconomicCalendarPayload | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [nextChallenges, nextTrades, nextLedger] = await Promise.all([
        fetchChallenges(),
        fetchTrades(),
        fetchLedgerEntries(),
      ]);

      setChallenges(nextChallenges);
      setTrades(nextTrades);
      setLedgerEntries(nextLedger);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Dashboard.");
    } finally {
      setLoading(false);
    }

    try {
      setCalendar(await fetchEconomicCalendar());
    } catch {
      setCalendar(null);
    }
  }

  useEffect(() => {
    void loadDashboard();

    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    const calendarRefresh = window.setInterval(async () => {
      try {
        setCalendar(await fetchEconomicCalendar());
      } catch {
        // Calendar is supplemental. Keep the trading dashboard usable.
      }
    }, 60_000);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(calendarRefresh);
    };
  }, []);

  const summary = useMemo(
    () => calculateDashboardSummary(challenges, trades, ledgerEntries, now),
    [challenges, trades, ledgerEntries, now],
  );

  const activity = useMemo(
    () => recentActivity(trades, ledgerEntries),
    [trades, ledgerEntries],
  );

  const challenge = summary.challenge.challenge;

  const todayEvents = useMemo(() => {
    if (!calendar) return [];
    return filterEconomicEvents(calendar.events, {
      window: "TODAY",
      impacts: new Set(["High", "Medium", "Low"]),
      usOnly: true,
      now,
    });
  }, [calendar, now]);

  const highImpactToday = todayEvents.filter((event) => event.impact === "High").length;
  const mediumImpactToday = todayEvents.filter((event) => event.impact === "Medium").length;

  const nextHigh = useMemo(
    () =>
      calendar
        ? nextHighImpactEvent(calendar.events, {
            usOnly: true,
            now,
          })
        : null,
    [calendar, now],
  );

  const challengeHealthClass =
    summary.challenge.health === "DANGER"
      ? styles.healthDanger
      : summary.challenge.health === "CAUTION"
        ? styles.healthCaution
        : styles.healthSafe;

  return (
    <main className={styles.page}>
      {error && (
        <div className={styles.error}>
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </div>
      )}

      <section className={styles.topBar}>
        <div>
          <span className={styles.eyebrow}>TRADING COMMAND CENTER</span>
          <h1>Dashboard</h1>
          <p>Challenge health, trading performance, market risk and real money in one view.</p>
        </div>

        <div className={styles.topActions}>
          <Link href="/tools/risk-calculator">CALCULATE RISK</Link>
          <Link href="/journal">LOG TRADE</Link>
        </div>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>TODAY P&amp;L</span>
          <strong className={toneClass(summary.performance.todayPnl)}>
            {formatSignedMoney(summary.performance.todayPnl)}
          </strong>
          <small>Closed journal trades today</small>
        </article>

        <article className={styles.kpiCard}>
          <span>MONTH P&amp;L</span>
          <strong className={toneClass(summary.performance.monthPnl)}>
            {formatSignedMoney(summary.performance.monthPnl)}
          </strong>
          <small>Current calendar month</small>
        </article>

        <article className={styles.kpiCard}>
          <span>WIN RATE</span>
          <strong>
            {summary.journal.winRate == null ? "—" : `${summary.journal.winRate}%`}
          </strong>
          <small>
            {summary.journal.wins}W · {summary.journal.losses}L · {summary.journal.breakeven}BE
          </small>
        </article>

        <article className={styles.kpiCard}>
          <span>PROFIT FACTOR</span>
          <strong>
            {summary.journal.profitFactor == null
              ? "—"
              : summary.journal.profitFactor === Infinity
                ? "∞"
                : number.format(summary.journal.profitFactor)}
          </strong>
          <small>{summary.journal.closedTrades} closed trades</small>
        </article>
      </section>

      <section className={styles.commandGrid}>
        <article className={`${styles.panel} ${styles.challengePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>ACTIVE CHALLENGE</span>
              <small>{challenge ? `${challenge.propFirm} · ${challenge.phase.replaceAll("_", " ")}` : "No challenge selected"}</small>
            </div>
            {challenge && (
              <div className={styles.challengeBadges}>
                <span className={`${styles.healthBadge} ${challengeHealthClass}`}>
                  {summary.challenge.health}
                </span>
                <span className={styles.statusBadge}>{challengeStatusLabel(challenge.status)}</span>
              </div>
            )}
          </div>

          {challenge ? (
            <div className={styles.challengeBody}>
              <div className={styles.challengeTitleRow}>
                <div>
                  <h2>{challenge.name}</h2>
                  <p>{money.format(challenge.accountSize)} account</p>
                </div>
                <div className={styles.balanceBlock}>
                  <span>CURRENT BALANCE</span>
                  <strong>{money.format(challenge.currentBalance)}</strong>
                  <small className={toneClass(summary.challenge.pnl)}>
                    {formatSignedMoney(summary.challenge.pnl)} from start
                  </small>
                </div>
              </div>

              <div className={styles.challengeMetricGrid}>
                <div>
                  <span>TARGET REMAINING</span>
                  <strong>{money.format(summary.challenge.targetRemaining)}</strong>
                </div>
                <div>
                  <span>DRAWDOWN BUFFER</span>
                  <strong>{money.format(summary.challenge.remainingDrawdown)}</strong>
                </div>
                <div>
                  <span>DRAWDOWN FLOOR</span>
                  <strong>{money.format(summary.challenge.drawdownFloor)}</strong>
                </div>
                <div>
                  <span>DAILY LOSS BUFFER</span>
                  <strong>
                    {summary.challenge.remainingDailyLoss == null
                      ? "NO LIMIT"
                      : money.format(summary.challenge.remainingDailyLoss)}
                  </strong>
                </div>
              </div>

              <div className={styles.barGroup}>
                <div className={styles.barLabel}>
                  <span>Profit target</span>
                  <b>{number.format(summary.challenge.targetProgressPct)}%</b>
                </div>
                <div className={styles.progressTrack}>
                  <i style={{ width: `${summary.challenge.targetProgressPct}%` }} />
                </div>

                <div className={styles.barLabel}>
                  <span>Drawdown buffer remaining</span>
                  <b>{number.format(summary.challenge.remainingDrawdownPct)}%</b>
                </div>
                <div className={`${styles.progressTrack} ${styles.drawdownTrack}`}>
                  <i style={{ width: `${Math.min(100, summary.challenge.remainingDrawdownPct)}%` }} />
                </div>
              </div>

              <Link href="/challenges" className={styles.panelLink}>
                OPEN CHALLENGE PLANNER →
              </Link>
            </div>
          ) : (
            <div className={styles.emptyPanel}>
              <p>Create a challenge to track target progress and drawdown health.</p>
              <Link href="/challenges">CREATE CHALLENGE →</Link>
            </div>
          )}
        </article>

        <article className={`${styles.panel} ${styles.marketPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>MARKET RISK</span>
              <small>US / USD economic events</small>
            </div>
            <Link href="/economic-calendar">CALENDAR →</Link>
          </div>

          <div className={styles.marketRiskBody}>
            <div className={styles.marketRiskStatus}>
              <span>TODAY</span>
              <strong
                className={
                  highImpactToday > 0
                    ? styles.riskHigh
                    : mediumImpactToday > 0
                      ? styles.riskMedium
                      : styles.riskLow
                }
              >
                {calendar
                  ? highImpactToday > 0
                    ? "HIGH IMPACT"
                    : mediumImpactToday > 0
                      ? "MEDIUM IMPACT"
                      : "LOW IMPACT"
                  : "UNAVAILABLE"}
              </strong>
              <small>{highImpactToday} high · {mediumImpactToday} medium</small>
            </div>

            <div className={styles.nextEvent}>
              <span>NEXT HIGH IMPACT</span>
              {nextHigh ? (
                <>
                  <strong>{nextHigh.title}</strong>
                  <small>
                    {localEventTime(nextHigh.date).time} · {countdownText(nextHigh.date, now)}
                  </small>
                </>
              ) : (
                <>
                  <strong>NONE FOUND</strong>
                  <small>in loaded calendar range</small>
                </>
              )}
            </div>
          </div>

          <div className={styles.quickActions}>
            <Link href="/tools/risk-calculator">
              <span>01</span>
              <div><strong>Risk Calculator</strong><small>Size the next setup</small></div>
            </Link>
            <Link href="/journal">
              <span>02</span>
              <div><strong>Journal</strong><small>Log or review trades</small></div>
            </Link>
            <Link href="/ledger">
              <span>03</span>
              <div><strong>Real Money</strong><small>Fees, resets and payouts</small></div>
            </Link>
          </div>
        </article>
      </section>

      <section className={styles.performanceGrid}>
        <article className={`${styles.panel} ${styles.chartPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>JOURNAL EQUITY CURVE</span>
              <small>Cumulative closed-trade net P&amp;L</small>
            </div>
            <strong className={toneClass(summary.journal.netPnl)}>
              {formatSignedMoney(summary.journal.netPnl)}
            </strong>
          </div>
          <EquityChart points={summary.performance.equityCurve} />
        </article>

        <article className={`${styles.panel} ${styles.performancePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>PERFORMANCE</span>
              <small>Closed-trade quality metrics</small>
            </div>
          </div>

          <div className={styles.performanceStats}>
            <div><span>EXPECTANCY</span><strong className={toneClass(summary.performance.expectancy)}>{summary.performance.expectancy == null ? "—" : money.format(summary.performance.expectancy)}</strong></div>
            <div><span>AVERAGE R</span><strong>{summary.journal.averageR == null ? "—" : `${summary.journal.averageR > 0 ? "+" : ""}${number.format(summary.journal.averageR)}R`}</strong></div>
            <div><span>AVG WIN</span><strong className={styles.positive}>{summary.performance.averageWin == null ? "—" : money.format(summary.performance.averageWin)}</strong></div>
            <div><span>AVG LOSS</span><strong className={styles.negative}>{summary.performance.averageLoss == null ? "—" : money.format(summary.performance.averageLoss)}</strong></div>
            <div><span>BEST TRADE</span><strong className={styles.positive}>{summary.performance.bestTrade == null ? "—" : money.format(summary.performance.bestTrade)}</strong></div>
            <div><span>WORST TRADE</span><strong className={styles.negative}>{summary.performance.worstTrade == null ? "—" : money.format(summary.performance.worstTrade)}</strong></div>
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={`${styles.panel} ${styles.activityPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>RECENT ACTIVITY</span>
              <small>Latest trades and real-money events</small>
            </div>
            <button type="button" onClick={() => void loadDashboard()} disabled={loading}>
              {loading ? "LOADING" : "REFRESH"}
            </button>
          </div>

          <div className={styles.activityList}>
            {loading ? (
              <div className={styles.empty}>Loading dashboard...</div>
            ) : activity.length === 0 ? (
              <div className={styles.empty}>No journal or ledger activity yet.</div>
            ) : (
              activity.map((item) => (
                <Link key={item.id} href={item.href} className={styles.activityRow}>
                  <span className={`${styles.activityIcon} ${item.kind === "TRADE" ? styles.tradeIcon : styles.ledgerIcon}`}>
                    {item.kind === "TRADE" ? "T" : "$"}
                  </span>
                  <span className={styles.activityText}>
                    <strong>{item.title}</strong>
                    <small>{item.sub}</small>
                  </span>
                  <span className={styles.activityDate}>
                    {new Date(item.timestamp).toLocaleDateString()}
                    <small>{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                  </span>
                  <strong className={item.tone === "positive" ? styles.positive : item.tone === "negative" ? styles.negative : styles.neutral}>
                    {item.amount == null ? "OPEN" : formatSignedMoney(item.amount)}
                  </strong>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.moneyPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span>REAL MONEY</span>
              <small>Actual cash flow outside trading P&amp;L</small>
            </div>
            <Link href="/ledger">LEDGER →</Link>
          </div>

          <div className={styles.moneyBody}>
            <span>NET CASH FLOW</span>
            <strong className={toneClass(summary.ledger.netCashFlow)}>
              {formatSignedMoney(summary.ledger.netCashFlow)}
            </strong>
            <p>Money received minus challenge fees, resets and other paid costs.</p>

            <div className={styles.moneyStats}>
              <div><span>PAID</span><strong className={styles.negative}>{money.format(summary.ledger.totalExpenses)}</strong></div>
              <div><span>RECEIVED</span><strong className={styles.positive}>{money.format(summary.ledger.totalIncome)}</strong></div>
              <div><span>PAYOUTS</span><strong>{money.format(summary.ledger.payouts)}</strong></div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
