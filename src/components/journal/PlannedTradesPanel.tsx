"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  deleteTradeViaApi,
  fetchPlannedTrades,
  updateTradeViaApi,
} from "@/lib/journal/api-client";
import {
  STARTED_FROM_PLAN_TAG,
  withoutPlannedTradeTag,
} from "@/lib/journal/planned";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./PlannedTradesPanel.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type ResultDraft = {
  openedAt: string;
  closedAt: string;
  entryPrice: string;
  exitPrice: string;
  contracts: string;
  commissionFees: string;
};

function verdictFromNotes(notes: string | null) {
  const match = notes?.match(/Verdict:\s*(SAFE|CAUTION|BLOCKED)/i);
  return match?.[1]?.toUpperCase() ?? "PLANNED";
}

function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate()),
    "T", pad(date.getHours()), ":", pad(date.getMinutes()),
  ].join("");
}

function toIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}

function positiveNumber(raw: string, label: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than 0.`);
  return value;
}

function nonNegativeNumber(raw: string, label: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

export function PlannedTradesPanel({
  onTradeCompleted,
}: {
  onTradeCompleted: () => void;
}) {
  const [plans, setPlans] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState<ResultDraft | null>(null);
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

  function beginLogResult(plan: TradeApiModel) {
    setError(null);
    setMessage(null);
    setCompletingId(plan.id);
    setResultDraft({
      openedAt: toLocalDateTimeInput(new Date(plan.openedAt)),
      closedAt: toLocalDateTimeInput(new Date()),
      entryPrice: String(plan.entryPrice),
      exitPrice: "",
      contracts: String(plan.contracts),
      commissionFees: String(plan.commissionFees),
    });
  }

  function cancelLogResult() {
    setCompletingId(null);
    setResultDraft(null);
    setError(null);
  }

  async function completeTrade(event: FormEvent, plan: TradeApiModel) {
    event.preventDefault();
    if (!resultDraft) return;

    setBusyId(plan.id);
    setError(null);
    setMessage(null);

    try {
      const openedAt = toIso(resultDraft.openedAt);
      const closedAt = toIso(resultDraft.closedAt);
      if (new Date(closedAt).getTime() < new Date(openedAt).getTime()) {
        throw new Error("Closed At cannot be before Opened At.");
      }

      const entryPrice = positiveNumber(resultDraft.entryPrice, "Entry Price");
      const exitPrice = positiveNumber(resultDraft.exitPrice, "Exit Price");
      const contracts = Number(resultDraft.contracts);
      if (!Number.isInteger(contracts) || contracts <= 0) {
        throw new Error("Contracts must be a positive whole number.");
      }
      const commissionFees = nonNegativeNumber(resultDraft.commissionFees || "0", "Commission & Fees");
      const completedAt = new Date();

      await updateTradeViaApi(plan.id, {
        openedAt,
        closedAt,
        entryPrice,
        exitPrice,
        contracts,
        commissionFees,
        tags: [...new Set([
          ...withoutPlannedTradeTag(plan.tags),
          STARTED_FROM_PLAN_TAG,
        ])],
        notes: [
          plan.notes,
          `Completed trade result logged from FFZ plan at ${completedAt.toLocaleString()}.`,
        ].filter(Boolean).join("\n\n"),
      });

      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setCompletingId(null);
      setResultDraft(null);
      setMessage(`${plan.instrument} completed trade added to the Journal.`);
      onTradeCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log completed trade.");
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
      if (completingId === plan.id) cancelLogResult();
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
          <p>Plans from Risk Calculator stay outside Journal statistics until the trade is finished. Log the result once execution is complete.</p>
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
            const completing = completingId === plan.id && resultDraft;

            return (
              <article className={styles.card} key={plan.id}>
                <div className={styles.titleRow}>
                  <div>
                    <strong>{plan.instrument} · {plan.direction}</strong>
                    <small>{challenge || "Personal / no challenge"}</small>
                  </div>
                  <span className={`${styles.badge} ${verdict === "CAUTION" ? styles.badgeCaution : ""}`}>
                    {verdict}
                  </span>
                </div>

                <div className={styles.metrics}>
                  <div><span>ENTRY</span><b>{plan.entryPrice}</b></div>
                  <div><span>STOP</span><b>{plan.stopPrice ?? "—"}</b></div>
                  <div><span>TARGET</span><b>{plan.targetPrice ?? "—"}</b></div>
                  <div><span>CONTRACTS</span><b>{plan.contracts}</b></div>
                  <div><span>MARKET RISK</span><b>{plan.initialRisk == null ? "—" : money.format(plan.initialRisk)}</b></div>
                </div>

                {completing ? (
                  <form className={styles.completionForm} onSubmit={(event) => void completeTrade(event, plan)}>
                    <div className={styles.completionHeader}>
                      <strong>LOG COMPLETED TRADE</strong>
                      <small>Plan values are prefilled. Confirm the actual execution and add the exit.</small>
                    </div>
                    <div className={styles.completionGrid}>
                      <label>
                        <span>OPENED AT</span>
                        <input type="datetime-local" value={resultDraft.openedAt} onChange={(event) => setResultDraft((current) => current ? { ...current, openedAt: event.target.value } : current)} required />
                      </label>
                      <label>
                        <span>CLOSED AT</span>
                        <input type="datetime-local" value={resultDraft.closedAt} onChange={(event) => setResultDraft((current) => current ? { ...current, closedAt: event.target.value } : current)} required />
                      </label>
                      <label>
                        <span>ENTRY PRICE</span>
                        <input inputMode="decimal" value={resultDraft.entryPrice} onChange={(event) => setResultDraft((current) => current ? { ...current, entryPrice: event.target.value } : current)} required />
                      </label>
                      <label>
                        <span>EXIT PRICE</span>
                        <input inputMode="decimal" value={resultDraft.exitPrice} onChange={(event) => setResultDraft((current) => current ? { ...current, exitPrice: event.target.value } : current)} autoFocus required />
                      </label>
                      <label>
                        <span>CONTRACTS</span>
                        <input inputMode="numeric" value={resultDraft.contracts} onChange={(event) => setResultDraft((current) => current ? { ...current, contracts: event.target.value } : current)} required />
                      </label>
                      <label>
                        <span>COMMISSION &amp; FEES</span>
                        <input inputMode="decimal" value={resultDraft.commissionFees} onChange={(event) => setResultDraft((current) => current ? { ...current, commissionFees: event.target.value } : current)} required />
                      </label>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.start} type="submit" disabled={busyId === plan.id}>
                        {busyId === plan.id ? "SAVING…" : "SAVE RESULT"}
                      </button>
                      <button className={styles.cancel} type="button" onClick={cancelLogResult} disabled={busyId === plan.id}>
                        CANCEL
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.actions}>
                    <button className={styles.start} type="button" onClick={() => beginLogResult(plan)} disabled={busyId === plan.id || completingId !== null}>
                      LOG RESULT
                    </button>
                    <button className={styles.cancel} type="button" onClick={() => void cancelPlan(plan)} disabled={busyId === plan.id || completingId !== null}>
                      CANCEL PLAN
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
