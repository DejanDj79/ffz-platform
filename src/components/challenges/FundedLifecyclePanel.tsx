"use client";

import Link from "next/link";
import type { Challenge, ChallengeMetrics } from "@/lib/challenges/types";
import type { FundedPayoutSummary } from "@/lib/challenges/funded";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import styles from "./FundedLifecyclePanel.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function Gate({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={styles.gate}>
      <i className={ok ? styles.ok : styles.wait}>{ok ? "✓" : "·"}</i>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FundedLifecyclePanel({
  challenge,
  metrics,
  funded,
  payouts,
  saving,
  onMarkPassed,
  onCreateFunded,
  onSyncBalance,
  onSetPayoutPhase,
}: {
  challenge: Challenge;
  metrics: ChallengeMetrics;
  funded: FundedPayoutSummary;
  payouts: LedgerEntryApiModel[];
  saving: boolean;
  onMarkPassed: () => void;
  onCreateFunded: () => void;
  onSyncBalance: () => void;
  onSetPayoutPhase: (requested: boolean) => void;
}) {
  const evaluationReady =
    challenge.phase === "EVALUATION" &&
    challenge.status !== "FAILED" &&
    metrics.targetProgressPct >= 100 &&
    challenge.daysTraded >= challenge.minimumTradingDays;

  if (!funded.isFunded) {
    return (
      <section className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span>ACCOUNT LIFECYCLE</span>
            <small>Move the evaluation forward without rebuilding the account by hand.</small>
          </div>
          <b className={challenge.status === "PASSED" ? styles.readyBadge : styles.stageBadge}>
            {challenge.status.replaceAll("_", " ")}
          </b>
        </div>

        <div className={styles.lifecycleFlow}>
          <div className={styles.stepActive}>EVALUATION</div>
          <i>→</i>
          <div className={challenge.status === "PASSED" ? styles.stepActive : styles.step}>PASSED</div>
          <i>→</i>
          <div className={styles.step}>FUNDED</div>
          <i>→</i>
          <div className={styles.step}>PAYOUT</div>
        </div>

        <div className={styles.lifecycleBody}>
          <div>
            <span>Target</span>
            <strong>{money.format(challenge.profitTarget)}</strong>
            <small>{number.format(metrics.targetProgressPct)}% complete</small>
          </div>
          <div>
            <span>Trading days</span>
            <strong>{challenge.daysTraded}</strong>
            <small>{challenge.minimumTradingDays ? `${challenge.minimumTradingDays} required` : "No minimum"}</small>
          </div>
          <div>
            <span>Evaluation state</span>
            <strong>{evaluationReady || challenge.status === "PASSED" ? "READY" : "IN PROGRESS"}</strong>
            <small>{evaluationReady ? "Target and day requirements reached" : "Keep following the evaluation rules"}</small>
          </div>
        </div>

        <div className={styles.actions}>
          {challenge.status !== "PASSED" && evaluationReady && (
            <button type="button" onClick={onMarkPassed} disabled={saving}>
              MARK EVALUATION PASSED
            </button>
          )}
          {challenge.status === "PASSED" && (
            <button type="button" onClick={onCreateFunded} disabled={saving}>
              CREATE FUNDED ACCOUNT
            </button>
          )}
        </div>
      </section>
    );
  }

  const consistencyText = funded.consistencyLimitPct == null
    ? "No rule"
    : funded.consistencyPct == null
      ? `— / < ${number.format(funded.consistencyLimitPct)}%`
      : `${number.format(funded.consistencyPct)}% / < ${number.format(funded.consistencyLimitPct)}%`;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span>FUNDED / PAYOUT STATUS</span>
          <small>Journal trades and Real Money Ledger drive the payout-cycle checks.</small>
        </div>
        <b className={funded.eligible ? styles.readyBadge : styles.stageBadge}>
          {challenge.phase === "PAYOUT" ? "PAYOUT REQUESTED" : funded.eligible ? "PAYOUT ELIGIBLE" : "BUILDING"}
        </b>
      </div>

      <div className={styles.fundedGrid}>
        <article>
          <span>TRADING DAYS</span>
          <strong>{funded.tradingDays}{funded.payoutDaysRequired ? ` / ${funded.payoutDaysRequired}` : ""}</strong>
          <small>Current payout cycle</small>
        </article>
        <article>
          <span>CONSISTENCY</span>
          <strong>{funded.consistencyPct == null ? "—" : `${number.format(funded.consistencyPct)}%`}</strong>
          <small>{funded.consistencyLimitPct == null ? "No funded rule" : `Must stay below ${number.format(funded.consistencyLimitPct)}%`}</small>
        </article>
        <article>
          <span>BUFFER THRESHOLD</span>
          <strong>{funded.bufferBalance == null ? "—" : money.format(funded.bufferBalance)}</strong>
          <small>{money.format(funded.balanceAboveBuffer)} above buffer</small>
        </article>
        <article>
          <span>PAYOUT CAP</span>
          <strong>{funded.payoutCap == null ? "—" : money.format(funded.payoutCap)}</strong>
          <small>{funded.payoutCount === 0 ? "First payout" : `Payout #${funded.payoutCount + 1}`}</small>
        </article>
        <article className={styles.payoutCard}>
          <span>AVAILABLE REQUEST</span>
          <strong>{money.format(funded.grossPayoutAvailable)}</strong>
          <small>Before profit split</small>
        </article>
        <article className={styles.payoutCard}>
          <span>EST. TAKE-HOME</span>
          <strong>{money.format(funded.estimatedTraderPayout)}</strong>
          <small>{funded.profitSplitPct == null ? "No split configured" : `${number.format(funded.profitSplitPct)}% trader split`}</small>
        </article>
      </div>

      <div className={styles.gates}>
        <Gate
          ok={funded.daysOk}
          label="Payout-day requirement"
          value={funded.payoutDaysRequired ? `${funded.tradingDays} / ${funded.payoutDaysRequired}` : "No rule"}
        />
        <Gate
          ok={funded.consistencyOk}
          label="Funded consistency"
          value={consistencyText}
        />
        <Gate
          ok={funded.bufferOk}
          label="Funded buffer"
          value={funded.bufferBalance == null ? "No rule" : `${money.format(challenge.currentBalance)} > ${money.format(funded.bufferBalance)}`}
        />
      </div>

      <div className={styles.balanceSync}>
        <div>
          <span>JOURNAL-DERIVED BALANCE</span>
          <strong>{money.format(funded.journalDerivedBalance)}</strong>
          <small>
            Start + linked closed-trade P&amp;L − estimated gross withdrawals. Stored balance: {money.format(challenge.currentBalance)}.
          </small>
        </div>
        <button type="button" onClick={onSyncBalance} disabled={saving || Math.abs(funded.journalDerivedBalance - challenge.currentBalance) < 0.01}>
          SYNC BALANCE
        </button>
      </div>

      <div className={styles.payoutActions}>
        {challenge.phase !== "PAYOUT" && funded.eligible && (
          <button type="button" onClick={() => onSetPayoutPhase(true)} disabled={saving}>
            MARK PAYOUT REQUESTED
          </button>
        )}
        {challenge.phase === "PAYOUT" && (
          <button type="button" onClick={() => onSetPayoutPhase(false)} disabled={saving}>
            RETURN TO FUNDED
          </button>
        )}
        <Link href="/ledger">RECORD RECEIVED PAYOUT →</Link>
      </div>

      <div className={styles.history}>
        <div className={styles.historyTitle}>
          <span>PAYOUT HISTORY</span>
          <small>{payouts.length ? `${payouts.length} received payout${payouts.length === 1 ? "" : "s"}` : "No received payouts recorded yet"}</small>
        </div>
        {payouts.length > 0 && (
          <div className={styles.historyRows}>
            {payouts.slice().reverse().slice(0, 5).map((entry, index) => (
              <div key={entry.id}>
                <span>#{payouts.length - index}</span>
                <strong>{money.format(entry.amount)}</strong>
                <small>{new Date(entry.occurredAt).toLocaleDateString()}</small>
                <i>{entry.provider || challenge.propFirm}</i>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
