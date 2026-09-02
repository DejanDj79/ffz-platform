"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import { fetchTrades } from "@/lib/journal/api-client";
import type { TradeApiModel } from "@/lib/journal/types";
import { fetchLedgerEntries } from "@/lib/ledger/api-client";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import { CATEGORY_LABELS } from "@/lib/ledger/presentation";
import {
  calculateDashboardSummary,
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

type RecentItem =
  | {
      id: string;
      timestamp: string;
      kind: "TRADE";
      title: string;
      sub: string;
      amount: number | null;
      tone: "positive" | "negative" | "neutral";
      href: string;
    }
  | {
      id: string;
      timestamp: string;
      kind: "LEDGER";
      title: string;
      sub: string;
      amount: number;
      tone: "positive" | "negative";
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
        ? `Open trade · ${trade.contracts} contract${trade.contracts === 1 ? "" : "s"}`
        : `${trade.outcome ?? "Closed"} · ${
            trade.rMultiple == null
              ? "—"
              : `${trade.rMultiple > 0 ? "+" : ""}${number.format(
                  trade.rMultiple,
                )}R`
          }`,
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
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    )
    .slice(0, 8);
}

function challengeStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function Dashboard() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<
    LedgerEntryApiModel[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [nextChallenges, nextTrades, nextLedger] =
        await Promise.all([
          fetchChallenges(),
          fetchTrades(),
          fetchLedgerEntries(),
        ]);

      setChallenges(nextChallenges);
      setTrades(nextTrades);
      setLedgerEntries(nextLedger);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const summary = useMemo(
    () =>
      calculateDashboardSummary(
        challenges,
        trades,
        ledgerEntries,
      ),
    [challenges, trades, ledgerEntries],
  );

  const activity = useMemo(
    () => recentActivity(trades, ledgerEntries),
    [trades, ledgerEntries],
  );

  const challenge = summary.challenge.challenge;

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

      <section className={styles.heroGrid}>
        <article className={`${styles.heroCard} ${styles.challengeHero}`}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>PRIMARY CHALLENGE</span>
              <h2>
                {challenge ? challenge.name : "No active challenge"}
              </h2>
              <p>
                {challenge
                  ? `${challenge.propFirm} · ${challenge.phase.replaceAll(
                      "_",
                      " ",
                    )}`
                  : "Create a challenge to begin tracking progress."}
              </p>
            </div>

            {challenge && (
              <span className={styles.statusBadge}>
                {challengeStatusLabel(challenge.status)}
              </span>
            )}
          </div>

          {challenge ? (
            <>
              <div className={styles.challengeNumbers}>
                <div>
                  <span>Current Balance</span>
                  <strong>
                    {money.format(challenge.currentBalance)}
                  </strong>
                </div>

                <div>
                  <span>Challenge P&amp;L</span>
                  <strong
                    className={
                      summary.challenge.pnl > 0
                        ? styles.positive
                        : summary.challenge.pnl < 0
                          ? styles.negative
                          : ""
                    }
                  >
                    {summary.challenge.pnl > 0 ? "+" : ""}
                    {money.format(summary.challenge.pnl)}
                  </strong>
                </div>

                <div>
                  <span>Target Remaining</span>
                  <strong>
                    {money.format(
                      summary.challenge.targetRemaining,
                    )}
                  </strong>
                </div>
              </div>

              <div className={styles.progressBlock}>
                <div>
                  <span>Profit target progress</span>
                  <b>
                    {number.format(
                      summary.challenge.targetProgressPct,
                    )}
                    %
                  </b>
                </div>

                <div className={styles.progressTrack}>
                  <i
                    style={{
                      width: `${summary.challenge.targetProgressPct}%`,
                    }}
                  />
                </div>
              </div>

              <Link href="/challenges" className={styles.cardLink}>
                Open Challenge Planner →
              </Link>
            </>
          ) : (
            <Link href="/challenges" className={styles.emptyAction}>
              Create your first challenge
            </Link>
          )}
        </article>

        <article className={styles.heroCard}>
          <span className={styles.eyebrow}>REAL MONEY</span>
          <h2
            className={
              summary.ledger.netCashFlow > 0
                ? styles.positive
                : summary.ledger.netCashFlow < 0
                  ? styles.negative
                  : ""
            }
          >
            {money.format(summary.ledger.netCashFlow)}
          </h2>
          <p>Actual money received minus actual money paid.</p>

          <div className={styles.miniStats}>
            <div>
              <span>Paid</span>
              <strong className={styles.negative}>
                {money.format(summary.ledger.totalExpenses)}
              </strong>
            </div>

            <div>
              <span>Received</span>
              <strong className={styles.positive}>
                {money.format(summary.ledger.totalIncome)}
              </strong>
            </div>

            <div>
              <span>Payouts</span>
              <strong>
                {money.format(summary.ledger.payouts)}
              </strong>
            </div>
          </div>

          <Link href="/ledger" className={styles.cardLink}>
            Open Real Money Ledger →
          </Link>
        </article>
      </section>

      <section className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>JOURNAL NET P&amp;L</span>
          <strong
            className={
              summary.journal.netPnl > 0
                ? styles.positive
                : summary.journal.netPnl < 0
                  ? styles.negative
                  : ""
            }
          >
            {money.format(summary.journal.netPnl)}
          </strong>
          <small>{summary.journal.closedTrades} closed trades</small>
        </article>

        <article className={styles.statCard}>
          <span>WIN RATE</span>
          <strong>
            {summary.journal.winRate == null
              ? "—"
              : `${summary.journal.winRate}%`}
          </strong>
          <small>
            {summary.journal.wins}W / {summary.journal.losses}L /{" "}
            {summary.journal.breakeven}BE
          </small>
        </article>

        <article className={styles.statCard}>
          <span>AVERAGE R</span>
          <strong>
            {summary.journal.averageR == null
              ? "—"
              : `${
                  summary.journal.averageR > 0 ? "+" : ""
                }${number.format(summary.journal.averageR)}R`}
          </strong>
          <small>Average closed-trade R multiple</small>
        </article>

        <article className={styles.statCard}>
          <span>PROFIT FACTOR</span>
          <strong>
            {summary.journal.profitFactor == null
              ? "—"
              : summary.journal.profitFactor === Infinity
                ? "∞"
                : number.format(summary.journal.profitFactor)}
          </strong>
          <small>Gross winning P&amp;L / gross losing P&amp;L</small>
        </article>

        <article className={styles.statCard}>
          <span>OPEN TRADES</span>
          <strong>{summary.journal.openTrades}</strong>
          <small>{summary.journal.totalTrades} journal trades total</small>
        </article>
      </section>

      <section className={styles.lowerGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>RECENT ACTIVITY</span>
              <small>Journal trades and real-money events</small>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <div className={styles.activityList}>
            {loading ? (
              <div className={styles.empty}>Loading dashboard...</div>
            ) : activity.length === 0 ? (
              <div className={styles.empty}>
                No journal or ledger activity yet.
              </div>
            ) : (
              activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={styles.activityRow}
                >
                  <span
                    className={`${styles.activityIcon} ${
                      item.kind === "TRADE"
                        ? styles.tradeIcon
                        : styles.ledgerIcon
                    }`}
                  >
                    {item.kind === "TRADE" ? "T" : "$"}
                  </span>

                  <span className={styles.activityText}>
                    <strong>{item.title}</strong>
                    <small>{item.sub}</small>
                  </span>

                  <span className={styles.activityDate}>
                    {new Date(item.timestamp).toLocaleDateString()}
                    <small>
                      {new Date(item.timestamp).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </small>
                  </span>

                  <strong
                    className={
                      item.tone === "positive"
                        ? styles.positive
                        : item.tone === "negative"
                          ? styles.negative
                          : styles.neutral
                    }
                  >
                    {item.amount == null
                      ? "OPEN"
                      : `${item.amount > 0 ? "+" : ""}${money.format(
                          item.amount,
                        )}`}
                  </strong>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>QUICK ACTIONS</span>
              <small>Continue the FFZ workflow</small>
            </div>
          </div>

          <div className={styles.quickGrid}>
            <Link href="/tools/risk-calculator">
              <strong>Risk Calculator</strong>
              <span>Size the next setup from risk.</span>
              <b>OPEN →</b>
            </Link>

            <Link href="/journal">
              <strong>Log Trade</strong>
              <span>Add a new execution to the journal.</span>
              <b>OPEN →</b>
            </Link>

            <Link href="/ledger">
              <strong>Record Real Money</strong>
              <span>Add a fee, reset, payout or refund.</span>
              <b>OPEN →</b>
            </Link>

            <Link href="/challenges">
              <strong>Challenge Planner</strong>
              <span>Review balance, target and challenge rules.</span>
              <b>OPEN →</b>
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
