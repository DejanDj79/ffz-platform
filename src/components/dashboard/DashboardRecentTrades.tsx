"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Challenge } from "@/lib/challenges/types";
import {
  EXECUTION_REVIEW_OPTIONS,
  MINDSET_REVIEW_OPTIONS,
  readDisciplineReview,
} from "@/lib/journal/discipline";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./DashboardRecentTrades.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}

function tone(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], {
    month: "short",
    day: "2-digit",
  });
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function optionLabel<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | null,
) {
  if (!value) return "Not reviewed";
  return options.find((option) => option.value === value)?.label ?? value;
}

function DayPnlChart({
  trade,
  trades,
}: {
  trade: TradeApiModel;
  trades: TradeApiModel[];
}) {
  const dayTrades = useMemo(() => {
    const selectedDay = dayKey(trade.closedAt ?? trade.openedAt);
    return trades
      .filter(
        (item) =>
          item.status === "CLOSED" &&
          item.netPnl != null &&
          dayKey(item.closedAt ?? item.openedAt) === selectedDay,
      )
      .sort(
        (a, b) =>
          new Date(a.closedAt ?? a.openedAt).getTime() -
          new Date(b.closedAt ?? b.openedAt).getTime(),
      );
  }, [trade, trades]);

  const width = 560;
  const height = 245;
  const padX = 28;
  const padY = 26;

  let cumulative = 0;
  const points = dayTrades.map((item) => {
    cumulative += item.netPnl ?? 0;
    return {
      id: item.id,
      value: cumulative,
      label: formatTime(item.closedAt ?? item.openedAt),
    };
  });

  const values = [0, ...points.map((point) => point.value)];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;

  const coords = [
    { id: "baseline", value: 0, label: "Start" },
    ...points,
  ].map((point, index, all) => ({
    ...point,
    x: padX + (index / Math.max(1, all.length - 1)) * (width - padX * 2),
    y: padY + ((max - point.value) / span) * (height - padY * 2),
  }));

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const zeroY = padY + ((max - 0) / span) * (height - padY * 2);
  const zeroOffset = ((zeroY - padY) / (height - padY * 2)) * 100;
  const last = points.at(-1)?.value ?? 0;

  return (
    <div className={styles.chartBlock}>
      <div className={styles.chartHeader}>
        <div>
          <span>DAY P&amp;L</span>
          <small>{dayTrades.length} closed trade{dayTrades.length === 1 ? "" : "s"} · cumulative session result</small>
        </div>
        <strong className={tone(last)}>{signedMoney(last)}</strong>
      </div>

      <div className={styles.chartStage}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Daily cumulative net P&L">
          <defs>
            <linearGradient id="dashboardRecentStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#30d0f8" />
              <stop offset="100%" stopColor="#a070e8" />
            </linearGradient>
            <linearGradient
              id="dashboardRecentFill"
              x1="0"
              y1={padY}
              x2="0"
              y2={height - padY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#31d7a1" stopOpacity="0.18" />
              <stop offset={`${zeroOffset}%`} stopColor="#31d7a1" stopOpacity="0.035" />
              <stop offset={`${zeroOffset}%`} stopColor="#ff6675" stopOpacity="0.035" />
              <stop offset="100%" stopColor="#ff6675" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((grid) => (
            <line
              key={grid}
              x1={padX}
              x2={width - padX}
              y1={padY + grid * (height - padY * 2)}
              y2={padY + grid * (height - padY * 2)}
              className={styles.chartGridLine}
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
            d={`${path} L${coords.at(-1)?.x ?? width - padX},${zeroY} L${coords[0]?.x ?? padX},${zeroY} Z`}
            fill="url(#dashboardRecentFill)"
          />
          <path
            d={path}
            fill="none"
            stroke="url(#dashboardRecentStroke)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />

          {coords.slice(1).map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.id === trade.id ? 5 : 3}
              className={point.id === trade.id ? styles.selectedChartPoint : styles.chartPoint}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${point.label} · ${signedMoney(point.value)} cumulative`}</title>
            </circle>
          ))}
        </svg>

        <div className={styles.chartScale}>
          <span>{money.format(max)}</span>
          <span>0</span>
          <span>{money.format(min)}</span>
        </div>
      </div>
    </div>
  );
}

function TradeModal({
  trade,
  trades,
  challenges,
  onClose,
}: {
  trade: TradeApiModel;
  trades: TradeApiModel[];
  challenges: Challenge[];
  onClose: () => void;
}) {
  const review = readDisciplineReview(trade.tags);
  const challenge = challenges.find((item) => item.id === trade.challengeId) ?? null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${trade.instrument} trade details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <span>{formatDate(trade.closedAt ?? trade.openedAt)}</span>
            <strong>{trade.instrument} · {trade.direction}</strong>
            <em className={tone(trade.netPnl)}>
              {trade.netPnl == null ? "—" : signedMoney(trade.netPnl)}
            </em>
          </div>
          <button type="button" onClick={onClose} aria-label="Close trade details">×</button>
        </header>

        <div className={styles.modalMain}>
          <div className={styles.tradeSummary}>
            <div className={styles.summaryGrid}>
              <div><span>NET P&amp;L</span><strong className={tone(trade.netPnl)}>{trade.netPnl == null ? "—" : signedMoney(trade.netPnl)}</strong></div>
              <div><span>R MULTIPLE</span><strong className={tone(trade.rMultiple)}>{trade.rMultiple == null ? "—" : `${trade.rMultiple > 0 ? "+" : ""}${number.format(trade.rMultiple)}R`}</strong></div>
              <div><span>GROSS P&amp;L</span><strong className={tone(trade.grossPnl)}>{trade.grossPnl == null ? "—" : signedMoney(trade.grossPnl)}</strong></div>
              <div><span>COMMISSIONS</span><strong>{money.format(trade.commissionFees)}</strong></div>
              <div><span>CONTRACTS</span><strong>{trade.contracts}</strong></div>
              <div><span>OUTCOME</span><strong>{trade.outcome ?? "—"}</strong></div>
              <div><span>EXECUTION</span><strong>{optionLabel(EXECUTION_REVIEW_OPTIONS, review.execution)}</strong></div>
              <div><span>MINDSET</span><strong>{optionLabel(MINDSET_REVIEW_OPTIONS, review.mindset)}</strong></div>
            </div>

            <div className={styles.summaryWideRows}>
              <div><span>SETUP</span><strong>{trade.setup || "Not set"}</strong></div>
              <div><span>ACCOUNT</span><strong>{challenge ? `${challenge.name} · ${challenge.propFirm}` : "No challenge"}</strong></div>
            </div>
          </div>

          <DayPnlChart trade={trade} trades={trades} />
        </div>

        <div className={styles.detailTableWrap}>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th>OPEN</th>
                <th>CLOSE</th>
                <th>SYMBOL</th>
                <th>SIDE</th>
                <th>ENTRY</th>
                <th>EXIT</th>
                <th>NET P&amp;L</th>
                <th>R MULTIPLE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatTime(trade.openedAt)}</td>
                <td>{formatTime(trade.closedAt)}</td>
                <td><strong>{trade.instrument}</strong></td>
                <td>{trade.direction}</td>
                <td>{number.format(trade.entryPrice)}</td>
                <td>{trade.exitPrice == null ? "—" : number.format(trade.exitPrice)}</td>
                <td className={tone(trade.netPnl)}>{trade.netPnl == null ? "—" : signedMoney(trade.netPnl)}</td>
                <td className={tone(trade.rMultiple)}>{trade.rMultiple == null ? "—" : `${number.format(trade.rMultiple)}R`}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" onClick={onClose}>CLOSE</button>
          <Link href={`/journal/review?trade=${trade.id}`}>OPEN IN TRADE REVIEW</Link>
        </footer>
      </section>
    </div>
  );
}

export function DashboardRecentTrades({
  trades,
  challenges,
  loading,
}: {
  trades: TradeApiModel[];
  challenges: Challenge[];
  loading: boolean;
}) {
  const [selectedTrade, setSelectedTrade] = useState<TradeApiModel | null>(null);

  const recentTrades = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "CLOSED" && trade.closedAt != null)
        .sort(
          (a, b) =>
            new Date(b.closedAt ?? b.openedAt).getTime() -
            new Date(a.closedAt ?? a.openedAt).getTime(),
        )
        .slice(0, 5),
    [trades],
  );

  return (
    <>
      <div className={styles.recentTable}>
        <div className={styles.tableHeader}>
          <span>DATE</span>
          <span>SYMBOL</span>
          <span>NET P&amp;L</span>
        </div>

        {loading ? (
          <div className={styles.empty}>Loading trades...</div>
        ) : recentTrades.length === 0 ? (
          <div className={styles.empty}>No closed trades yet.</div>
        ) : (
          recentTrades.map((trade) => (
            <button
              key={trade.id}
              type="button"
              className={styles.tradeRow}
              onClick={() => setSelectedTrade(trade)}
            >
              <span>{formatShortDate(trade.closedAt ?? trade.openedAt)}</span>
              <strong>{trade.instrument}</strong>
              <em className={tone(trade.netPnl)}>
                {trade.netPnl == null ? "—" : signedMoney(trade.netPnl)}
              </em>
            </button>
          ))
        )}
      </div>

      {selectedTrade && (
        <TradeModal
          trade={selectedTrade}
          trades={trades}
          challenges={challenges}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </>
  );
}
