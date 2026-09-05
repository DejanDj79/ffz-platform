"use client";

import Link from "next/link";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./WeeklyReviewEpisodeHandoff.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function localDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tradeTimestamp(trade: TradeApiModel) {
  return new Date(trade.closedAt ?? trade.openedAt);
}

function tradeDateLabel(trade: TradeApiModel) {
  return tradeTimestamp(trade).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pnlClass(value: number | null) {
  if (value == null || value === 0) return styles.neutral;
  return value > 0 ? styles.positive : styles.negative;
}

export function WeeklyReviewEpisodeHandoff({
  trades,
  weekStart,
  weekEnd,
}: {
  trades: TradeApiModel[];
  weekStart: Date;
  weekEnd: Date;
}) {
  const orderedTrades = [...trades].sort(
    (a, b) => tradeTimestamp(a).getTime() - tradeTimestamp(b).getTime(),
  );
  const inclusiveWeekEnd = new Date(weekEnd.getTime() - 1);
  const params = new URLSearchParams({
    from: localDateInputValue(weekStart),
    to: localDateInputValue(inclusiveWeekEnd),
    source: "weekly-review",
  });
  const episodeHref = `/creator/episodes?${params.toString()}`;

  return (
    <section className={styles.panel} aria-label="Build creator episode from Weekly Review">
      <header className={styles.header}>
        <div>
          <span>CREATOR · WEEKLY EPISODE</span>
          <strong>Build this week&apos;s episode</strong>
          <small>
            Every CLOSED Journal trade from this Monday–Sunday period is included automatically, in chronological order.
          </small>
        </div>
        <div className={styles.tradeCount}>
          <strong>{orderedTrades.length}</strong>
          <span>CLOSED TRADES</span>
        </div>
      </header>

      {orderedTrades.length === 0 ? (
        <div className={styles.empty}>No closed trades in this week yet.</div>
      ) : (
        <div className={styles.tradeGrid}>
          {orderedTrades.map((trade, index) => (
            <div className={styles.tradeCard} key={trade.id}>
              <span className={styles.tradeNumber}>{index + 1}</span>
              <span className={styles.tradeIdentity}>
                <strong>{trade.instrument} · {trade.direction}</strong>
                <small>{tradeDateLabel(trade)}</small>
                <small>{trade.setup || "No setup"}{trade.rMultiple == null ? "" : ` · ${trade.rMultiple.toFixed(2)}R`}</small>
              </span>
              <b className={pnlClass(trade.netPnl)}>
                {trade.netPnl == null ? "—" : money.format(trade.netPnl)}
              </b>
            </div>
          ))}
        </div>
      )}

      <footer className={styles.footer}>
        <p>
          Weekly episodes are complete by design: trades cannot be manually added, removed or excluded.
        </p>
        {orderedTrades.length > 0 ? (
          <Link className={styles.openButton} href={episodeHref}>
            BUILD WEEKLY EPISODE →
          </Link>
        ) : (
          <span className={`${styles.openButton} ${styles.disabledButton}`} aria-disabled="true">
            NO CLOSED TRADES YET
          </span>
        )}
      </footer>
    </section>
  );
}
