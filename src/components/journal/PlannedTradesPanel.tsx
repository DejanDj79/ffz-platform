"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  deleteTradeViaApi,
  fetchPlannedTrades,
  updateTradeViaApi,
} from "@/lib/journal/api-client";
import { withoutPlannedTradeTag } from "@/lib/journal/planned";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./PlannedTradesPanel.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function verdictFromNotes(notes: string | null) {
  const match = notes?.match(/Verdict:\s*(SAFE|CAUTION|BLOCKED)/i);
  return match?.[1]?.toUpperCase() ?? "PLANNED";
}

export function PlannedTradesPanel({
  onTradeStarted,
}: {
  onTradeStarted: () => void;
}) {
  const [plans, setPlans] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const challengeNames = useMemo(
    () => new Map(challenges.map((challenge) => [challenge.id, challenge.name])),
    [challenges],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextPlans, nextChallenges] = await Promise.all([
        fetchPlannedTrades(),
        fetchChallenges(),
      ]);
      setPlans(nextPlans);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load planned trades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startTrade(plan: TradeApiModel) {
    setBusyId(plan.id);
    setError(null);
    setMessage(null);

    try {
      await updateTradeViaApi(plan.id, {
        openedAt: new Date().toISOString(),
        tags: withoutPlannedTradeTag(plan.tags),
        notes: [
          plan.notes,
          `Trade started from FFZ plan at ${new Date().toLocaleString()}.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setMessage(`${plan.instrument} plan moved to the live Journal.`);
      onTradeStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start planned trade.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelPlan(plan: TradeApiModel) {
    const confirmed = window.confirm(`Cancel planned ${plan.instrument} ${plan.direction} trade?`);
    if (!confirmed) return;

    setBusyId(plan.id);
    setError(null);
    setMessage(null);

    try {
      await deleteTradeViaApi(plan.id);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setMessage("Planned trade cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel planned trade.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span>PRE-TRADE QUEUE</span>
          <h2>Planned Trades</h2>
          <p>Plans from Risk Calculator stay outside Journal statistics until you start them.</p>
        </div>
        <button className={styles.refresh} type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "LOADING…" : "REFRESH"}
        </button>
      </div>

      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Loading planned trades…</div>
      ) : plans.length === 0 ? (
        <div className={styles.empty}>No planned trades. Calculate a setup and save it from Risk Calculator.</div>
      ) : (
        <div className={styles.grid}>
          {plans.map((plan) => {
            const verdict = verdictFromNotes(plan.notes);
            const challenge = plan.challengeId ? challengeNames.get(plan.challengeId) : null;

            return (
              <article className={styles.card} key={plan.id}>
                <div className={styles.titleRow}>
                  <strong>{plan.instrument} · {plan.direction}</strong>
                  <span className={`${styles.badge} ${verdict === "CAUTION" ? styles.badgeCaution : ""}`}>
                    {verdict}
                  </span>
                </div>

                <small>{challenge || "Personal / no challenge"}</small>

                <div className={styles.metrics}>
                  <div><span>ENTRY</span><b>{plan.entryPrice}</b></div>
                  <div><span>STOP</span><b>{plan.stopPrice ?? "—"}</b></div>
                  <div><span>TARGET</span><b>{plan.targetPrice ?? "—"}</b></div>
                </div>

                <div className={styles.metrics}>
                  <div><span>CONTRACTS</span><b>{plan.contracts}</b></div>
                  <div><span>MARKET RISK</span><b>{plan.initialRisk == null ? "—" : money.format(plan.initialRisk)}</b></div>
                </div>

                <div className={styles.actions}>
                  <button className={styles.start} type="button" onClick={() => void startTrade(plan)} disabled={busyId === plan.id}>
                    {busyId === plan.id ? "WORKING…" : "START TRADE"}
                  </button>
                  <button className={styles.cancel} type="button" onClick={() => void cancelPlan(plan)} disabled={busyId === plan.id}>
                    CANCEL PLAN
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
