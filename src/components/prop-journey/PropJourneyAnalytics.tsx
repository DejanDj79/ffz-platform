"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/ledger/presentation";
import type {
  PropJourneyAnalytics,
  PropJourneyCurrencyAnalytics,
} from "@/lib/prop-journey/analytics";
import styles from "./PropJourneyAnalytics.module.css";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function signedMoney(value: number, currency: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatMoney(0, currency);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function tone(value: number) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function Snapshot({ data }: { data: PropJourneyCurrencyAnalytics }) {
  const progress = Math.min(100, Math.max(0, data.recoveryPct));

  return (
    <section className={styles.snapshot}>
      <div className={styles.snapshotMain}>
        <span className={styles.eyebrow}>REAL PROP JOURNEY P&amp;L</span>
        <strong className={tone(data.netJourneyPnl)}>
          {signedMoney(data.netJourneyPnl, data.currency)}
        </strong>
        <p>
          Actual Ledger income minus actual Ledger expenses. Configured challenge fees are never double-counted.
        </p>
      </div>

      <div className={styles.breakEvenCard}>
        <div className={styles.breakEvenTop}>
          <span>BREAK-EVEN RECOVERY</span>
          <strong>{Math.round(data.recoveryPct)}%</strong>
        </div>
        <div className={styles.progressTrack}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>
          {data.breakEvenReached
            ? "Your real prop cash flow has recovered all recorded costs."
            : `${formatMoney(data.amountToBreakEven, data.currency)} still needed to recover recorded costs.`}
        </small>
      </div>
    </section>
  );
}

export function PropJourneyAnalytics() {
  const [analytics, setAnalytics] = useState<PropJourneyAnalytics | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/prop-journey", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        if (response.status === 403 && typeof json?.upgradeUrl === "string") {
          window.location.href = json.upgradeUrl;
          return;
        }
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : `Prop Journey request failed (${response.status}).`,
        );
      }

      const next = json.data as PropJourneyAnalytics;
      setAnalytics(next);
      setCurrency((current) =>
        next.currencies.includes(current)
          ? current
          : next.currencies[0] ?? "USD",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Prop Journey.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const data = useMemo(
    () => analytics?.byCurrency.find((item) => item.currency === currency) ?? analytics?.byCurrency[0] ?? null,
    [analytics, currency],
  );

  if (loading && !data) {
    return <div className={styles.loading}>Building your Prop Journey…</div>;
  }

  if (error && !data) {
    return (
      <div className={styles.error}>
        <span>{error}</span>
        <button type="button" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const recentMonths = data.monthlyCashFlow.slice(-12).reverse();

  return (
    <main className={styles.page}>
      <section className={styles.toolbar}>
        <div>
          <span className={styles.eyebrow}>FFZ PRO</span>
          <strong>Know if your prop journey is actually profitable.</strong>
          <small>Every dollar below comes from the Real Money Ledger.</small>
        </div>

        <div className={styles.toolbarActions}>
          {analytics && analytics.currencies.length > 1 && (
            <label>
              <span>CURRENCY</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {analytics.currencies.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          )}
          <Link href="/ledger">OPEN LEDGER</Link>
        </div>
      </section>

      {error && <div className={styles.inlineError}>{error}</div>}

      <Snapshot data={data} />

      <section className={styles.kpiGrid}>
        <article>
          <span>TOTAL PROP COSTS</span>
          <strong className={styles.negative}>{formatMoney(data.totalCosts, data.currency)}</strong>
          <small>All recorded Ledger expenses</small>
        </article>
        <article>
          <span>TOTAL PAYOUTS</span>
          <strong className={styles.positive}>{formatMoney(data.totalPayouts, data.currency)}</strong>
          <small>{data.payoutCount} payout{data.payoutCount === 1 ? "" : "s"}</small>
        </article>
        <article>
          <span>TOTAL CASH RETURNED</span>
          <strong>{formatMoney(data.totalIncome, data.currency)}</strong>
          <small>Payouts + refunds + other income</small>
        </article>
        <article>
          <span>LARGEST PAYOUT</span>
          <strong>{formatMoney(data.largestPayout, data.currency)}</strong>
          <small>Average {formatMoney(data.averagePayout, data.currency)}</small>
        </article>
        <article>
          <span>PAYOUT ACCOUNTS</span>
          <strong>{data.payoutAccountCount}</strong>
          <small>Distinct linked accounts with payout</small>
        </article>
      </section>

      <section className={styles.funnelPanel}>
        <header>
          <div>
            <span>PROP FUNNEL</span>
            <small>How far your tracked accounts have progressed</small>
          </div>
        </header>
        <div className={styles.funnel}>
          <article><span>TRACKED</span><strong>{data.trackedChallenges}</strong><small>accounts</small></article>
          <i>→</i>
          <article><span>STARTED</span><strong>{data.evaluationsStarted}</strong><small>evaluations</small></article>
          <i>→</i>
          <article><span>PASSED</span><strong>{data.passedEvaluations}</strong><small>reached pass/funded</small></article>
          <i>→</i>
          <article><span>FUNDED</span><strong>{data.fundedReached}</strong><small>reached funded phase</small></article>
          <i>→</i>
          <article><span>PAID OUT</span><strong>{data.payoutAccountCount}</strong><small>accounts</small></article>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.panel}>
          <header>
            <div>
              <span>WHERE THE MONEY WENT</span>
              <small>Actual expense categories from your Ledger</small>
            </div>
          </header>
          <div className={styles.costList}>
            {data.costBreakdown.length === 0 ? (
              <div className={styles.empty}>No expenses recorded for {data.currency} yet.</div>
            ) : data.costBreakdown.map((row) => {
              const share = data.totalCosts > 0 ? (row.amount / data.totalCosts) * 100 : 0;
              return (
                <div key={row.category} className={styles.costRow}>
                  <div>
                    <span>{CATEGORY_LABELS[row.category] ?? statusLabel(row.category)}</span>
                    <strong>{formatMoney(row.amount, data.currency)}</strong>
                  </div>
                  <div className={styles.costTrack}><i style={{ width: `${Math.max(2, share)}%` }} /></div>
                  <small>{row.entries} entr{row.entries === 1 ? "y" : "ies"} · {Math.round(share)}%</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className={styles.panel}>
          <header>
            <div>
              <span>MONTHLY CASH FLOW</span>
              <small>Latest 12 Ledger months</small>
            </div>
          </header>
          <div className={styles.monthList}>
            {recentMonths.length === 0 ? (
              <div className={styles.empty}>Add Ledger entries to build your monthly journey.</div>
            ) : recentMonths.map((row) => (
              <div key={row.month} className={styles.monthRow}>
                <div>
                  <strong>{monthLabel(row.month)}</strong>
                  <small>Costs {formatMoney(row.costs, data.currency)} · Payouts {formatMoney(row.payouts, data.currency)}</small>
                </div>
                <strong className={tone(row.net)}>{signedMoney(row.net, data.currency)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <span>PROP FIRM PERFORMANCE</span>
            <small>Cash economics and account funnel by firm</small>
          </div>
        </header>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>PROP FIRM</th>
                <th>ACCOUNTS</th>
                <th>PASSED</th>
                <th>FUNDED</th>
                <th>PAYOUT ACCTS</th>
                <th>COSTS</th>
                <th>PAYOUTS</th>
                <th>NET</th>
              </tr>
            </thead>
            <tbody>
              {data.firmBreakdown.map((row) => (
                <tr key={row.firm}>
                  <td><strong>{row.firm}</strong></td>
                  <td>{row.challengeCount}</td>
                  <td>{row.passedCount}</td>
                  <td>{row.fundedCount}</td>
                  <td>{row.payoutAccounts}</td>
                  <td>{formatMoney(row.costs, data.currency)}</td>
                  <td>{formatMoney(row.payouts, data.currency)}</td>
                  <td className={tone(row.net)}>{signedMoney(row.net, data.currency)}</td>
                </tr>
              ))}
              {data.firmBreakdown.length === 0 && (
                <tr><td colSpan={8} className={styles.emptyCell}>No prop firms or Ledger activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <span>ACCOUNT ECONOMICS</span>
            <small>Actual cash result for every tracked challenge / funded account</small>
          </div>
        </header>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>ACCOUNT</th>
                <th>FIRM</th>
                <th>STATUS</th>
                <th>COSTS</th>
                <th>PAYOUTS</th>
                <th>REFUNDS / OTHER</th>
                <th>NET</th>
              </tr>
            </thead>
            <tbody>
              {data.accountBreakdown.map((row) => (
                <tr key={row.challengeId}>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.propFirm}</td>
                  <td><span className={styles.status}>{statusLabel(row.status)}</span></td>
                  <td>{formatMoney(row.costs, data.currency)}</td>
                  <td>{formatMoney(row.payouts, data.currency)}</td>
                  <td>{formatMoney(row.refunds + row.otherIncome, data.currency)}</td>
                  <td className={tone(row.net)}>{signedMoney(row.net, data.currency)}</td>
                </tr>
              ))}
              {data.accountBreakdown.length === 0 && (
                <tr><td colSpan={7} className={styles.emptyCell}>Create a challenge to start the account journey.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.sourceNote}>
        <div>
          <span>SOURCE OF TRUTH</span>
          <strong>Only real Ledger transactions affect Prop Journey P&amp;L.</strong>
          <p>
            A configured challenge fee is planning metadata. Record the payment in Real Money Ledger when money actually leaves your account; refunds and payouts work the same way.
          </p>
        </div>
        <Link href="/ledger">REVIEW LEDGER</Link>
      </section>
    </main>
  );
}
