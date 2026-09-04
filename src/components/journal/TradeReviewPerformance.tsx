"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateTradeReviewPerformance,
  shiftTradeReviewPerformanceAnchor,
  type FfzScore,
  type TradeReviewPerformancePeriod,
  type TradeReviewPerformancePoint,
} from "@/lib/journal/trade-review-performance";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./TradeReviewPerformance.module.css";

const PERIODS: TradeReviewPerformancePeriod[] = ["DAY", "WEEK", "MONTH"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  return value > 0 ? `+${money.format(value)}` : money.format(value);
}

function ratio(value: number | null) {
  if (value == null) return "—";
  if (value === Infinity) return "∞";
  return number.format(value);
}

function tone(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

function axisLabels(points: TradeReviewPerformancePoint[]) {
  if (points.length <= 5) return points.map((point) => point.label);

  const indexes = [
    0,
    Math.round((points.length - 1) * 0.25),
    Math.round((points.length - 1) * 0.5),
    Math.round((points.length - 1) * 0.75),
    points.length - 1,
  ];

  return Array.from(new Set(indexes)).map((index) => points[index]?.label ?? "");
}

function FfzScoreChart({ score, trades }: { score: FfzScore; trades: number }) {
  if (score.value == null || !score.breakdown) {
    return <div className={styles.chartEmpty}>No closed trades to score in this period.</div>;
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (score.value / 100);
  const statusLabel = score.status === "PRELIMINARY" ? "PRELIMINARY" : "ESTABLISHED";
  const breakdown = [
    ["PERFORMANCE", score.breakdown.performance],
    ["RISK", score.breakdown.risk],
    ["CONSISTENCY", score.breakdown.consistency],
    ["DISCIPLINE", score.breakdown.discipline],
  ] as const;

  return (
    <div className={styles.scoreBody}>
      <div className={styles.scoreGauge}>
        <svg viewBox="0 0 150 150" aria-hidden="true">
          <circle cx="75" cy="75" r={radius} className={styles.scoreTrack} />
          <circle
            cx="75"
            cy="75"
            r={radius}
            className={styles.scoreProgress}
            strokeDasharray={`${progress} ${circumference - progress}`}
          />
        </svg>
        <div className={styles.scoreValue}>
          <strong>{score.value}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div className={styles.scoreMeta}>
        <div className={styles.scoreStatus}>
          <strong>{statusLabel}</strong>
          <span>{trades < 10 ? `${trades}/10 trades` : `${trades} trades`}</span>
        </div>
        <small>
          {score.status === "PRELIMINARY"
            ? `Sample confidence ${Math.round(score.confidence * 100)}%. Score is damped toward 50 until 10 closed trades.`
            : "Full sample weighting is active for this period."}
        </small>
      </div>

      <div className={styles.scoreBreakdown}>
        {breakdown.map(([label, value]) => (
          <div key={label} className={styles.scoreRow}>
            <div>
              <span>{label}</span>
              <strong>{Math.round(value)}</strong>
            </div>
            <div className={styles.scoreBar}>
              <span style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CumulativeChart({ points }: { points: TradeReviewPerformancePoint[] }) {
  if (points.length === 0) {
    return <div className={styles.chartEmpty}>No closed trades in this period.</div>;
  }

  const width = 900;
  const height = 240;
  const padX = 26;
  const padY = 20;
  const rawValues = [0, ...points.map((point) => point.cumulativePnl)];
  let min = Math.min(...rawValues);
  let max = Math.max(...rawValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;

  const coords = points.map((point, index) => ({
    x:
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * (width - padX * 2),
    y: padY + ((max - point.cumulativePnl) / span) * (height - padY * 2),
    point,
  }));

  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const first = coords[0];
  const last = coords.at(-1);
  const labels = axisLabels(points);

  return (
    <>
      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} preserveAspectRatio="none">
          <defs>
            <linearGradient id="tradeReviewCumulativeStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#30d0f8" />
              <stop offset="100%" stopColor="#a070e8" />
            </linearGradient>
            <linearGradient id="tradeReviewCumulativeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30d0f8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#30d0f8" stopOpacity="0" />
            </linearGradient>
          </defs>

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

          <line
            x1={padX}
            x2={width - padX}
            y1={zeroY}
            y2={zeroY}
            className={styles.zeroLine}
          />

          <path
            d={`${path} L${last?.x ?? width - padX},${zeroY} L${first?.x ?? padX},${zeroY} Z`}
            fill="url(#tradeReviewCumulativeFill)"
          />
          <path
            d={path}
            fill="none"
            stroke="url(#tradeReviewCumulativeStroke)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />

          {coords.map(({ x, y, point }) => (
            <circle
              key={point.key}
              cx={x}
              cy={y}
              r={points.length > 14 ? 2.4 : 3.5}
              fill="#30d0f8"
              stroke="#071016"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${point.label}: ${signedMoney(point.cumulativePnl)} cumulative`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className={styles.axisLabels}>
        {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
      </div>
    </>
  );
}

function PnlBars({ points }: { points: TradeReviewPerformancePoint[] }) {
  if (points.length === 0) {
    return <div className={styles.chartEmpty}>No closed trades in this period.</div>;
  }

  const width = 900;
  const height = 240;
  const padX = 26;
  const padY = 20;
  const rawValues = [0, ...points.map((point) => point.pnl)];
  let min = Math.min(...rawValues);
  let max = Math.max(...rawValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);
  const slot = (width - padX * 2) / Math.max(1, points.length);
  const barWidth = Math.max(4, Math.min(30, slot * 0.62));
  const labels = axisLabels(points);

  return (
    <>
      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} preserveAspectRatio="none">
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

          <line
            x1={padX}
            x2={width - padX}
            y1={zeroY}
            y2={zeroY}
            className={styles.zeroLine}
          />

          {points.map((point, index) => {
            const valueY = padY + ((max - point.pnl) / span) * (height - padY * 2);
            const y = Math.min(valueY, zeroY);
            const barHeight = Math.max(1, Math.abs(valueY - zeroY));
            const x = padX + index * slot + (slot - barWidth) / 2;
            const fill = point.pnl > 0 ? "#45dbad" : point.pnl < 0 ? "#ff737f" : "#61737f";

            return (
              <rect
                key={point.key}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={fill}
                opacity="0.9"
              >
                <title>{`${point.label}: ${signedMoney(point.pnl)}${point.trades > 1 ? ` · ${point.trades} trades` : ""}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className={styles.axisLabels}>
        {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
      </div>
    </>
  );
}

export function TradeReviewPerformance({
  trades,
  anchorTimestamp,
  scopeLabel,
}: {
  trades: TradeApiModel[];
  anchorTimestamp: string;
  scopeLabel: string;
}) {
  const initialAnchor = new Date(anchorTimestamp);
  const [period, setPeriod] = useState<TradeReviewPerformancePeriod>("DAY");
  const [anchor, setAnchor] = useState(
    Number.isNaN(initialAnchor.getTime()) ? new Date() : initialAnchor,
  );

  useEffect(() => {
    const next = new Date(anchorTimestamp);
    if (!Number.isNaN(next.getTime())) setAnchor(next);
  }, [anchorTimestamp]);

  const performance = useMemo(
    () => calculateTradeReviewPerformance(trades, period, anchor),
    [trades, period, anchor],
  );

  const lastCumulative = performance.points.at(-1)?.cumulativePnl ?? 0;
  const secondChartTitle = period === "DAY" ? "NET P&L BY TRADE" : "NET DAILY P&L";
  const secondChartSubtitle = period === "DAY"
    ? "Realized result for each closed trade"
    : "Realized result for each calendar day";

  function movePeriod(direction: -1 | 1) {
    setAnchor((current) => shiftTradeReviewPerformanceAnchor(current, period, direction));
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span>PERFORMANCE OVERVIEW</span>
          <strong>Review the period around this trade</strong>
          <small>{scopeLabel}</small>
        </div>

        <div className={styles.controls}>
          <div className={styles.periods} aria-label="Performance period">
            {PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={period === item}
                className={period === item ? styles.activePeriod : undefined}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className={styles.navigator}>
            <button type="button" onClick={() => movePeriod(-1)} aria-label="Previous period">‹</button>
            <span>{performance.label}</span>
            <button type="button" onClick={() => movePeriod(1)} aria-label="Next period">›</button>
          </div>
        </div>
      </header>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>NET P&amp;L</span>
          <strong className={tone(performance.netPnl)}>{signedMoney(performance.netPnl)}</strong>
        </div>
        <div className={styles.metric}>
          <span>PROFIT FACTOR</span>
          <strong>{ratio(performance.profitFactor)}</strong>
        </div>
        <div className={styles.metric}>
          <span>WIN RATE</span>
          <strong>{performance.winRate == null ? "—" : `${number.format(performance.winRate)}%`}</strong>
        </div>
        <div className={styles.metric}>
          <span>TRADES</span>
          <strong>{performance.tradeCount}</strong>
        </div>
      </div>

      <div className={styles.charts}>
        <article className={`${styles.chartCard} ${styles.scoreCard}`}>
          <header className={styles.chartHeader}>
            <div>
              <span>FFZ SCORE</span>
              <small>Performance · risk · consistency · discipline</small>
            </div>
          </header>
          <FfzScoreChart score={performance.ffzScore} trades={performance.tradeCount} />
        </article>

        <article className={styles.chartCard}>
          <header className={styles.chartHeader}>
            <div>
              <span>CUMULATIVE NET P&amp;L</span>
              <small>{period === "DAY" ? "Intraday realized P&L, trade by trade" : "Daily realized P&L accumulated through the period"}</small>
            </div>
            <strong className={tone(lastCumulative)}>{signedMoney(lastCumulative)}</strong>
          </header>
          <CumulativeChart points={performance.points} />
        </article>

        <article className={styles.chartCard}>
          <header className={styles.chartHeader}>
            <div>
              <span>{secondChartTitle}</span>
              <small>{secondChartSubtitle}</small>
            </div>
            <strong className={tone(performance.netPnl)}>{signedMoney(performance.netPnl)}</strong>
          </header>
          <PnlBars points={performance.points} />
        </article>
      </div>
    </section>
  );
}
