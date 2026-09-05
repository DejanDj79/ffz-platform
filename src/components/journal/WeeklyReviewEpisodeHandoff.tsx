"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MAX_EPISODE_TRADE_SELECTION } from "@/lib/creator/episode-selection";
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

function defaultTradeIds(trades: TradeApiModel[]) {
  if (trades.length === 0) return [];

  const ranked = trades
    .filter((trade) => trade.netPnl != null)
    .sort((a, b) => (b.netPnl ?? 0) - (a.netPnl ?? 0));

  if (ranked.length === 0) return trades.slice(0, 2).map((trade) => trade.id);

  const ids = [ranked[0].id];
  const worst = ranked[ranked.length - 1];
  if (worst.id !== ranked[0].id) ids.push(worst.id);
  return ids;
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
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>(() => defaultTradeIds(trades));
  const selectedSet = useMemo(() => new Set(selectedTradeIds), [selectedTradeIds]);

  const episodeHref = useMemo(() => {
    if (selectedTradeIds.length === 0) return null;

    const inclusiveWeekEnd = new Date(weekEnd.getTime() - 1);
    const params = new URLSearchParams({
      from: localDateInputValue(weekStart),
      to: localDateInputValue(inclusiveWeekEnd),
      trades: selectedTradeIds.join(","),
      source: "weekly-review",
    });

    return `/creator/episodes?${params.toString()}`;
  }, [selectedTradeIds, weekEnd, weekStart]);

  function toggleTrade(tradeId: string) {
    setSelectedTradeIds((current) => {
      if (current.includes(tradeId)) {
        return current.filter((id) => id !== tradeId);
      }
      if (current.length >= MAX_EPISODE_TRADE_SELECTION) return current;
      return [...current, tradeId];
    });
  }

  return (
    <section className={styles.panel} aria-label="Build creator episode from Weekly Review">
      <header className={styles.header}>
        <div>
          <span>CREATOR · EPISODE HANDOFF</span>
          <strong>Build episode from this week</strong>
          <small>
            Pick the trades you want to explain. FFZ carries this week and your selection into Episode Builder.
          </small>
        </div>
        <div className={styles.selectionCount}>
          <strong>{selectedTradeIds.length}</strong>
          <span>/ {MAX_EPISODE_TRADE_SELECTION} SELECTED</span>
        </div>
      </header>

      {trades.length === 0 ? (
        <div className={styles.empty}>No closed trades in this week to send to Episode Builder.</div>
      ) : (
        <div className={styles.tradeGrid}>
          {trades.map((trade) => {
            const selected = selectedSet.has(trade.id);
            const limitReached = !selected && selectedTradeIds.length >= MAX_EPISODE_TRADE_SELECTION;

            return (
              <button
                key={trade.id}
                type="button"
                className={`${styles.tradeCard} ${selected ? styles.selected : ""}`}
                onClick={() => toggleTrade(trade.id)}
                aria-pressed={selected}
                disabled={limitReached}
              >
                <span className={styles.check}>{selected ? "✓" : ""}</span>
                <span className={styles.tradeIdentity}>
                  <strong>{trade.instrument} · {trade.direction}</strong>
                  <small>{tradeDateLabel(trade)}</small>
                  <small>{trade.setup || "No setup"}{trade.rMultiple == null ? "" : ` · ${trade.rMultiple.toFixed(2)}R`}</small>
                </span>
                <b className={pnlClass(trade.netPnl)}>
                  {trade.netPnl == null ? "—" : money.format(trade.netPnl)}
                </b>
              </button>
            );
          })}
        </div>
      )}

      <footer className={styles.footer}>
        <p>
          Weekly metrics stay based on the full week; only the review queue is curated by your selected trades.
        </p>
        {episodeHref ? (
          <Link className={styles.openButton} href={episodeHref}>
            OPEN IN EPISODE BUILDER →
          </Link>
        ) : (
          <span className={`${styles.openButton} ${styles.disabledButton}`} aria-disabled="true">
            SELECT AT LEAST ONE TRADE
          </span>
        )}
      </footer>
    </section>
  );
}
