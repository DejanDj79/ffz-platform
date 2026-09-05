"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTrades } from "@/lib/journal/api-client";
import {
  calculateWeeklyReview,
  shiftWeeklyReviewAnchor,
  type WeeklyReviewBreakdownRow,
} from "@/lib/journal/weekly-review";
import type { TradeApiModel } from "@/lib/journal/types";
import { BehaviorSignalsPanel } from "./BehaviorSignalsPanel";
import styles from "./WeeklyReview.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function ratio(value: number | null) {
  if (value == null) return "—";
  if (value === Infinity) return "∞";
  return number.format(value);
}

function toneClass(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

function isSameWeek(anchor: Date, reference: Date) {
  const current = calculateWeeklyReview([], anchor);
  return reference.getTime() >= current.start.getTime() && reference.getTime() < current.end.getTime();
}

function WeeklyPnlChart({ points }: { points: ReturnType<typeof calculateWeeklyReview>["dailyPoints"] }) {
  if (points.length === 0) {
    return <div className={styles.chartEmpty}>No closed trades in this week.</div>;
  }

  const width = 760;
  const height = 250;
  const padX = 30;
  const padY = 22;
  const values = [0, ...points.map((point) => point.pnl)];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);
  const slot = (width - padX * 2) / Math.max(1, points.length);
  const barWidth = Math.min(46, slot * 0.52);

  return (
    <div className={styles.pnlChart}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Daily net P&L for selected week">
        {[0.25, 0.5, 0.75].map((grid) => (
          <line
            key={grid}
            x1={padX}
            x2={width - padX}
            y1={height * grid}
            y2={height * grid}
            className={styles.gridLine}
          />
        ))}
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} className={styles.zeroLine} />

        {points.map((point, index) => {
          const valueY = padY + ((max - point.pnl) / span) * (height - padY * 2);
          const y = Math.min(valueY, zeroY);
          const barHeight = Math.max(1, Math.abs(valueY - zeroY));
          const x = padX + index * slot + (slot - barWidth) / 2;
          const className = point.pnl > 0
            ? styles.chartBarPositive
            : point.pnl < 0
              ? styles.chartBarNegative
              : styles.chartBarNeutral;

          return (
            <rect
              key={point.key}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="3"
              className={className}
            >
              <title>{`${point.label}: ${signedMoney(point.pnl)} · ${point.trades} trades`}</title>
            </rect>
          );
        })}
      </svg>
      <div className={styles.dayLabels}>
        {points.map((point) => (
          <span key={point.key} className={point.trades > 0 ? styles.tradedDay : undefined}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: WeeklyReviewBreakdownRow[];
}) {
  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <span>{title}</span>
          <small>{subtitle}</small>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className={styles.panelEmpty}>No closed trades in this week.</div>
      ) : (
        <div className={styles.breakdownRows}>
          {rows.map((row) => (
            <div key={row.key} className={styles.breakdownRow}>
              <div>
                <strong>{row.label}</strong>
                <small>{row.trades} {row.trades === 1 ? "trade" : "trades"}</small>
              </div>
              <div>
                <span>{row.winRate == null ? "—" : `${number.format(row.winRate)}% WR`}</span>
                <strong className={toneClass(row.netPnl)}>{signedMoney(row.netPnl)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function WeeklyReview() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchTrades();
        if (!cancelled) setTrades(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load Weekly Review.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const review = useMemo(
    () => calculateWeeklyReview(trades, anchor),
    [trades, anchor],
  );

  const currentWeek = isSameWeek(anchor, new Date());
  const score = review.ffzScore.value;

  if (loading) {
    return <div className={styles.state}>Loading weekly trading review…</div>;
  }

  if (error && trades.length === 0) {
    return <div className={`${styles.state} ${styles.error}`}>{error}</div>;
  }

  return (
    <main className={styles.page}>
      {error && <p className={styles.inlineError}>{error}</p>}

      <section className={styles.weekToolbar}>
        <div>
          <span>WEEKLY REVIEW</span>
          <strong>{review.label}</strong>
          <small>Performance, risk, discipline and behavior in one weekly retrospective.</small>
        </div>
        <div className={styles.weekNavigator}>
          <button type="button" onClick={() => setAnchor((value) => shiftWeeklyReviewAnchor(value, -1))} aria-label="Previous week">‹</button>
          <button
            type="button"
            className={styles.thisWeek}
            onClick={() => setAnchor(new Date())}
            disabled={currentWeek}
          >
            THIS WEEK
          </button>
          <button type="button" onClick={() => setAnchor((value) => shiftWeeklyReviewAnchor(value, 1))} aria-label="Next week">›</button>
        </div>
      </section>

      <section className={styles.scorecard} aria-label="Weekly scorecard">
        <div className={styles.metric}>
          <span>NET P&amp;L</span>
          <strong className={toneClass(review.netPnl)}>{signedMoney(review.netPnl)}</strong>
        </div>
        <div className={styles.metric}>
          <span>FFZ SCORE</span>
          <strong>{score == null ? "—" : score}</strong>
          <small>{review.ffzScore.status === "PRELIMINARY" ? "PRELIMINARY" : review.ffzScore.status === "ESTABLISHED" ? "ESTABLISHED" : "NO DATA"}</small>
        </div>
        <div className={styles.metric}>
          <span>PROFIT FACTOR</span>
          <strong>{ratio(review.profitFactor)}</strong>
        </div>
        <div className={styles.metric}>
          <span>WIN RATE</span>
          <strong>{review.winRate == null ? "—" : `${number.format(review.winRate)}%`}</strong>
        </div>
        <div className={styles.metric}>
          <span>TRADES</span>
          <strong>{review.tradeCount}</strong>
        </div>
        <div className={styles.metric}>
          <span>AVG R</span>
          <strong className={toneClass(review.averageR)}>{review.averageR == null ? "—" : `${review.averageR > 0 ? "+" : ""}${number.format(review.averageR)}R`}</strong>
        </div>
        <div className={styles.metric}>
          <span>MAX DRAWDOWN</span>
          <strong className={review.maxDrawdown > 0 ? styles.negative : styles.neutral}>{money.format(review.maxDrawdown)}</strong>
        </div>
      </section>

      <section className={styles.overviewGrid}>
        <article className={`${styles.panel} ${styles.pnlPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <span>DAILY NET P&amp;L</span>
              <small>Monday through Sunday realized performance</small>
            </div>
            <strong className={toneClass(review.netPnl)}>{signedMoney(review.netPnl)}</strong>
          </header>
          <WeeklyPnlChart points={review.dailyPoints} />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>WEEK HIGHLIGHTS</span>
              <small>Fast context before the deeper review</small>
            </div>
          </header>
          <div className={styles.highlights}>
            {review.highlights.map((highlight) => (
              <div key={highlight.label} className={styles.highlight}>
                <span>{highlight.label}</span>
                <strong className={highlight.tone === "positive" ? styles.positive : highlight.tone === "negative" ? styles.negative : styles.neutral}>
                  {highlight.value}
                </strong>
                <small>{highlight.detail}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.behaviorGrid}>
        <BreakdownPanel
          title="EXECUTION"
          subtitle="On-plan discipline versus deviations"
          rows={review.execution}
        />
        <BreakdownPanel
          title="MINDSET"
          subtitle="Only explicitly reviewed mindset tags"
          rows={review.mindset}
        />
        <BreakdownPanel
          title="TRADE ORIGIN"
          subtitle="FFZ planned trades versus other origins"
          rows={review.origin}
        />
      </section>

      <BehaviorSignalsPanel trades={review.closedTrades} />

      <section className={styles.lowerGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span>POST-LOSS BEHAVIOR</span>
              <small>The immediate same-day trade after a losing trade</small>
            </div>
          </header>
          <div className={styles.postLossMetrics}>
            <div>
              <span>FOLLOW-UPS</span>
              <strong>{review.postLoss.followUps}</strong>
              <small>{review.postLoss.losses} losses total</small>
            </div>
            <div>
              <span>NEXT-TRADE AVG</span>
              <strong className={toneClass(review.postLoss.averageNextPnl)}>
                {review.postLoss.averageNextPnl == null ? "—" : signedMoney(review.postLoss.averageNextPnl)}
              </strong>
              <small>realized net P&amp;L</small>
            </div>
            <div>
              <span>NEXT-TRADE WIN RATE</span>
              <strong>{review.postLoss.followUpWinRate == null ? "—" : `${number.format(review.postLoss.followUpWinRate)}%`}</strong>
              <small>same-day follow-ups</small>
            </div>
            <div>
              <span>AVG RE-ENTRY TIME</span>
              <strong>{review.postLoss.averageMinutesToNextTrade == null ? "—" : `${number.format(review.postLoss.averageMinutesToNextTrade)}m`}</strong>
              <small>from prior loss close</small>
            </div>
            <div>
              <span>RAPID RE-ENTRY</span>
              <strong className={review.postLoss.rapidReEntries > 0 ? styles.warningText : styles.neutral}>{review.postLoss.rapidReEntries}</strong>
              <small>opened within 15m</small>
            </div>
            <div>
              <span>EXECUTION ISSUES</span>
              <strong className={review.postLoss.deviatedOrUnplanned > 0 ? styles.warningText : styles.neutral}>{review.postLoss.deviatedOrUnplanned}</strong>
              <small>Deviated / Unplanned follow-ups</small>
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.findingsPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <span>WEEKLY FINDINGS</span>
              <small>Deterministic observations from your actual journal data</small>
            </div>
          </header>
          <div className={styles.findings}>
            {review.findings.map((finding, index) => (
              <div key={`${finding.text}-${index}`} className={`${styles.finding} ${styles[finding.tone]}`}>
                <i />
                <p>{finding.text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
