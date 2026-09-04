import type { Metadata } from "next";
import Link from "next/link";
import { getPublicJourneyData } from "@/lib/public-journey/repository";
import styles from "./PublicJourney.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The FFZ Journey | Futures From Zero",
  description: "Follow the real Futures From Zero prop trading journey: challenges, funded progress, costs, payouts and real-money results.",
};

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

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
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

function updatedLabel(value: string | null) {
  if (!value) return "Waiting for the first tracked update";
  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))}`;
}

export default async function PublicJourneyPage() {
  const data = await getPublicJourneyData();

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/journey" aria-label="Futures From Zero Journey">
          <span>FFZ</span>
          <strong>FUTURES FROM ZERO</strong>
        </Link>
        <div className={styles.navActions}>
          <Link href="/tools/risk-calculator">RISK CALCULATOR</Link>
          <Link className={styles.primaryNav} href="/dashboard">OPEN FFZ</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>THE FFZ JOURNEY</span>
          <h1>Building a prop futures trading track record in public.</h1>
          <p>
            No highlight reel. This page follows the real economics of the journey — evaluations,
            funded progress, prop costs, payouts and whether the path from zero is actually profitable.
          </p>
        </div>
        <div className={styles.heroStamp}>
          <span>PUBLIC TRACKER</span>
          <strong>REAL DATA</strong>
          <small>{updatedLabel(data?.lastUpdatedAt ?? null)}</small>
        </div>
      </section>

      {!data ? (
        <section className={styles.emptyState}>
          <span>JOURNEY NOT PUBLISHED YET</span>
          <h2>The public tracker will appear here once FFZ has journey data to publish.</h2>
          <p>The app is live; this page intentionally stays empty rather than showing invented results.</p>
        </section>
      ) : (
        <>
          <section className={styles.currentGrid}>
            <article className={styles.currentCard}>
              <header>
                <div>
                  <span>CURRENT MISSION</span>
                  <strong>{data.currentAccount ? data.currentAccount.propFirm : "No active account"}</strong>
                </div>
                {data.currentAccount && (
                  <b>{statusLabel(data.currentAccount.status)}</b>
                )}
              </header>

              {data.currentAccount ? (
                <>
                  <div className={styles.currentNumbers}>
                    <div>
                      <span>ACCOUNT SIZE</span>
                      <strong>{formatMoney(data.currentAccount.accountSize, data.currency)}</strong>
                    </div>
                    <div>
                      <span>PHASE</span>
                      <strong>{statusLabel(data.currentAccount.phase)}</strong>
                    </div>
                    <div>
                      <span>ACCOUNT P&amp;L</span>
                      <strong className={data.currentAccount.pnl >= 0 ? styles.positive : styles.negative}>
                        {signedMoney(data.currentAccount.pnl, data.currency)}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.progressBlock}>
                    <div>
                      <span>PROGRESS TO CURRENT PROFIT TARGET</span>
                      <strong>{Math.round(data.currentAccount.progressPct)}%</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <i style={{ width: `${data.currentAccount.progressPct}%` }} />
                    </div>
                    <small>
                      {formatMoney(data.currentAccount.profitTarget, data.currency)} target
                      {data.currentAccount.minimumTradingDays != null
                        ? ` · ${data.currentAccount.daysTraded}/${data.currentAccount.minimumTradingDays} minimum trading days`
                        : ` · ${data.currentAccount.daysTraded} trading days tracked`}
                    </small>
                  </div>
                </>
              ) : (
                <p className={styles.noCurrent}>No challenge or funded account is currently tracked.</p>
              )}
            </article>

            <article className={styles.netCard}>
              <span>REAL PROP JOURNEY NET</span>
              <strong className={data.netJourneyPnl >= 0 ? styles.positive : styles.negative}>
                {signedMoney(data.netJourneyPnl, data.currency)}
              </strong>
              <p>Real Money Ledger income minus recorded prop expenses.</p>
              <div>
                <span>{data.breakEvenReached ? "BREAK-EVEN REACHED" : "TO BREAK EVEN"}</span>
                <strong>
                  {data.breakEvenReached
                    ? "RECOVERED"
                    : formatMoney(data.amountToBreakEven, data.currency)}
                </strong>
              </div>
            </article>
          </section>

          <section className={styles.kpiGrid}>
            <article>
              <span>REAL PROP COSTS</span>
              <strong>{formatMoney(data.totalCosts, data.currency)}</strong>
              <small>Recorded cash expenses</small>
            </article>
            <article>
              <span>TOTAL PAYOUTS</span>
              <strong className={styles.positive}>{formatMoney(data.totalPayouts, data.currency)}</strong>
              <small>{data.payoutCount} recorded payout{data.payoutCount === 1 ? "" : "s"}</small>
            </article>
            <article>
              <span>TRACKED ACCOUNTS</span>
              <strong>{data.trackedChallenges}</strong>
              <small>Evaluations + funded accounts</small>
            </article>
            <article>
              <span>PAYOUT ACCOUNTS</span>
              <strong>{data.payoutAccountCount}</strong>
              <small>Distinct accounts with payout</small>
            </article>
          </section>

          <section className={styles.panel}>
            <header className={styles.sectionHeader}>
              <div>
                <span>PROP JOURNEY FUNNEL</span>
                <h2>From evaluation to payout.</h2>
              </div>
              <small>Only aggregate account progress is public.</small>
            </header>
            <div className={styles.funnel}>
              <article><span>TRACKED</span><strong>{data.trackedChallenges}</strong></article>
              <i>→</i>
              <article><span>STARTED</span><strong>{data.evaluationsStarted}</strong></article>
              <i>→</i>
              <article><span>PASSED</span><strong>{data.passedEvaluations}</strong></article>
              <i>→</i>
              <article><span>FUNDED</span><strong>{data.fundedReached}</strong></article>
              <i>→</i>
              <article><span>PAID OUT</span><strong>{data.payoutAccountCount}</strong></article>
            </div>
          </section>

          <section className={styles.splitGrid}>
            <article className={styles.panel}>
              <header className={styles.sectionHeader}>
                <div>
                  <span>RECENT CASH FLOW</span>
                  <h2>Last six active months.</h2>
                </div>
              </header>
              <div className={styles.monthList}>
                {data.monthlyCashFlow.length === 0 ? (
                  <p className={styles.emptyLine}>No Ledger cash flow recorded yet.</p>
                ) : [...data.monthlyCashFlow].reverse().map((row) => (
                  <div key={row.month} className={styles.monthRow}>
                    <div>
                      <strong>{monthLabel(row.month)}</strong>
                      <small>
                        Costs {formatMoney(row.costs, data.currency)} · Payouts {formatMoney(row.payouts, data.currency)}
                      </small>
                    </div>
                    <strong className={row.net >= 0 ? styles.positive : styles.negative}>
                      {signedMoney(row.net, data.currency)}
                    </strong>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <header className={styles.sectionHeader}>
                <div>
                  <span>MILESTONES</span>
                  <h2>What has actually been reached.</h2>
                </div>
              </header>
              <div className={styles.milestones}>
                {data.milestones.map((milestone) => (
                  <div key={milestone.label} className={milestone.achieved ? styles.achieved : styles.pending}>
                    <i>{milestone.achieved ? "✓" : "·"}</i>
                    <div>
                      <strong>{milestone.label}</strong>
                      <small>{milestone.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className={styles.panel}>
            <header className={styles.sectionHeader}>
              <div>
                <span>PROP FIRM ECONOMICS</span>
                <h2>Where the journey is making or losing real money.</h2>
              </div>
              <small>No account numbers or private labels are exposed.</small>
            </header>
            <div className={styles.firmList}>
              {data.firmBreakdown.length === 0 ? (
                <p className={styles.emptyLine}>No firm-level cash activity recorded yet.</p>
              ) : data.firmBreakdown.map((firm) => (
                <article key={firm.firm}>
                  <div>
                    <strong>{firm.firm}</strong>
                    <small>
                      {firm.challengeCount} tracked · {firm.fundedCount} funded · {firm.payoutAccounts} payout accounts
                    </small>
                  </div>
                  <div className={styles.firmMoney}>
                    <span>Costs {formatMoney(firm.costs, data.currency)}</span>
                    <span>Payouts {formatMoney(firm.payouts, data.currency)}</span>
                    <strong className={firm.net >= 0 ? styles.positive : styles.negative}>
                      {signedMoney(firm.net, data.currency)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <section className={styles.transparency}>
        <div>
          <span>TRANSPARENCY RULE</span>
          <h2>Public results, private raw data.</h2>
          <p>
            FFZ publishes aggregate challenge progress and real-money economics. Account numbers,
            internal IDs, private journal notes, order references, credentials and raw trade details stay private.
          </p>
        </div>
        <Link href="/tools/risk-calculator">TRY THE FREE RISK CALCULATOR</Link>
      </section>

      <footer className={styles.footer}>
        <span>FUTURES FROM ZERO</span>
        <p>Trading involves risk. This public journey is educational documentation, not financial advice.</p>
      </footer>
    </main>
  );
}
