"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXECUTION_REVIEW_OPTIONS,
  MINDSET_REVIEW_OPTIONS,
  applyDisciplineReview,
  disciplineReviewStatus,
  readDisciplineReview,
  type ExecutionReview,
  type MindsetReview,
} from "@/lib/journal/discipline";
import { fetchTrades, updateTradeViaApi } from "@/lib/journal/api-client";
import { STARTED_FROM_PLAN_TAG } from "@/lib/journal/planned";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./DisciplineReviewPanel.module.css";

type ReviewDraft = {
  execution: ExecutionReview | "";
  mindset: MindsetReview | "";
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function draftFromTrade(trade: TradeApiModel): ReviewDraft {
  const review = readDisciplineReview(trade.tags);
  return {
    execution: review.execution ?? "",
    mindset: review.mindset ?? "",
  };
}

function reviewFromDraft(draft: ReviewDraft) {
  return {
    execution: draft.execution || null,
    mindset: draft.mindset || null,
  };
}

export function DisciplineReviewPanel() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const next = (await fetchTrades())
        .filter((trade) => trade.status === "CLOSED")
        .slice(0, 5);

      setTrades(next);
      setDrafts(
        Object.fromEntries(next.map((trade) => [trade.id, draftFromTrade(trade)])),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load post-trade reviews.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const reviewedCount = useMemo(
    () =>
      trades.filter(
        (trade) =>
          disciplineReviewStatus(readDisciplineReview(trade.tags)) === "REVIEWED",
      ).length,
    [trades],
  );

  async function saveReview(trade: TradeApiModel) {
    const draft = drafts[trade.id] ?? draftFromTrade(trade);
    const tags = applyDisciplineReview(trade.tags, reviewFromDraft(draft));

    if (tags.length > 20) {
      setError(
        "This trade already has too many tags to add discipline metadata. Remove one or more normal tags first.",
      );
      return;
    }

    setSavingId(trade.id);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateTradeViaApi(trade.id, { tags });
      setTrades((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((current) => ({
        ...current,
        [updated.id]: draftFromTrade(updated),
      }));
      setMessage(`${updated.instrument} discipline review saved.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save discipline review.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DISCIPLINE DATA</span>
          <strong>Post-Trade Discipline Review</strong>
          <small>
            Review recent closed trades while the context is fresh. FFZ stores these as
            structured tags so Tag Analytics can use them immediately.
          </small>
        </div>

        <div className={styles.headerActions}>
          <span>{reviewedCount} / {trades.length} reviewed</span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "LOADING..." : "REFRESH"}
          </button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      {loading ? (
        <div className={styles.empty}>Loading recent closed trades...</div>
      ) : trades.length === 0 ? (
        <div className={styles.empty}>
          Close a trade in the Journal to start collecting discipline data.
        </div>
      ) : (
        <div className={styles.list}>
          {trades.map((trade) => {
            const draft = drafts[trade.id] ?? draftFromTrade(trade);
            const persistedStatus = disciplineReviewStatus(
              readDisciplineReview(trade.tags),
            );
            const planned = trade.tags.includes(STARTED_FROM_PLAN_TAG);

            return (
              <article key={trade.id} className={styles.row}>
                <div className={styles.tradeInfo}>
                  <div className={styles.tradeTitle}>
                    <strong>{trade.instrument} · {trade.direction}</strong>
                    {planned && <span className={styles.planned}>FFZ PLANNED</span>}
                    <span
                      className={`${styles.reviewStatus} ${
                        persistedStatus === "REVIEWED"
                          ? styles.reviewed
                          : persistedStatus === "PARTIAL"
                            ? styles.partial
                            : ""
                      }`}
                    >
                      {persistedStatus === "REVIEWED"
                        ? "REVIEWED"
                        : persistedStatus === "PARTIAL"
                          ? "PARTIAL"
                          : "NOT REVIEWED"}
                    </span>
                  </div>
                  <small>
                    {new Date(trade.openedAt).toLocaleString()} · {trade.outcome ?? "—"} · {trade.netPnl == null ? "—" : money.format(trade.netPnl)}
                  </small>
                </div>

                <label>
                  <span>EXECUTION</span>
                  <select
                    value={draft.execution}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [trade.id]: {
                          ...draft,
                          execution: event.target.value as ExecutionReview | "",
                        },
                      }))
                    }
                  >
                    <option value="">Not reviewed</option>
                    {EXECUTION_REVIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>MINDSET</span>
                  <select
                    value={draft.mindset}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [trade.id]: {
                          ...draft,
                          mindset: event.target.value as MindsetReview | "",
                        },
                      }))
                    }
                  >
                    <option value="">Not reviewed</option>
                    {MINDSET_REVIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => void saveReview(trade)}
                  disabled={savingId === trade.id}
                >
                  {savingId === trade.id ? "SAVING..." : "SAVE REVIEW"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
