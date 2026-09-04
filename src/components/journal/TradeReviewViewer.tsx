"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  EXECUTION_REVIEW_OPTIONS,
  MINDSET_REVIEW_OPTIONS,
  readDisciplineReview,
} from "@/lib/journal/discipline";
import {
  fetchTradeAttachments,
  fetchTrades,
  tradeAttachmentImageUrl,
} from "@/lib/journal/api-client";
import { STARTED_FROM_PLAN_TAG } from "@/lib/journal/planned";
import {
  selectTradeReviewTrades,
  tradeDurationMs,
  type TradeReviewInstrumentFilter,
} from "@/lib/journal/trade-review";
import {
  JOURNAL_INSTRUMENTS,
  type TradeApiModel,
  type TradeAttachmentApiModel,
} from "@/lib/journal/types";
import detailStyles from "./TradeReviewDetails.module.css";
import { TradeReviewPerformance } from "./TradeReviewPerformance";
import tabStyles from "./TradeReviewTabs.module.css";
import styles from "./TradeReviewViewer.module.css";

type ReviewTab = "DETAILS" | "REVIEW" | "ATTACHMENTS" | "NOTES";

const REVIEW_TABS: ReviewTab[] = ["DETAILS", "REVIEW", "ATTACHMENTS", "NOTES"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(trade: TradeApiModel) {
  const duration = tradeDurationMs(trade);
  if (duration == null) return "—";

  const totalMinutes = Math.floor(duration / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (totalMinutes > 0) return `${totalMinutes}m`;

  return `${Math.max(1, Math.round(duration / 1000))}s`;
}

function optionLabel<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | null,
) {
  if (!value) return "Not reviewed";
  return options.find((option) => option.value === value)?.label ?? value;
}

function challengeLabel(challengeId: string | null, challenges: Challenge[]) {
  if (!challengeId) return "No challenge";
  return challenges.find((challenge) => challenge.id === challengeId)?.name ?? "Unknown challenge";
}

function pnlTone(value: number | null) {
  if (value == null || value === 0) return undefined;
  return value > 0 ? detailStyles.positive : detailStyles.negative;
}

export function TradeReviewViewer() {
  const [allTrades, setAllTrades] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [instrument, setInstrument] = useState<TradeReviewInstrumentFilter>("ALL");
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewTab>("DETAILS");
  const [attachments, setAttachments] = useState<TradeAttachmentApiModel[]>([]);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trades = useMemo(
    () => selectTradeReviewTrades(allTrades, instrument),
    [allTrades, instrument],
  );

  const currentIndex = Math.max(
    0,
    trades.findIndex((trade) => trade.id === activeTradeId),
  );
  const trade = trades[currentIndex] ?? null;

  const activeAttachment =
    attachments.find((attachment) => attachment.id === activeAttachmentId) ??
    attachments[0] ??
    null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextTrades = await fetchTrades();
        if (cancelled) return;
        setAllTrades(nextTrades);

        void fetchChallenges()
          .then((nextChallenges) => {
            if (!cancelled) setChallenges(nextChallenges);
          })
          .catch(() => {
            if (!cancelled) setChallenges([]);
          });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load trade review data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (trades.length === 0) {
      setActiveTradeId(null);
      return;
    }

    if (!activeTradeId || !trades.some((item) => item.id === activeTradeId)) {
      setActiveTradeId(trades[0].id);
    }
  }, [trades, activeTradeId]);

  useEffect(() => {
    if (!trade) {
      setAttachments([]);
      setActiveAttachmentId(null);
      return;
    }

    let cancelled = false;
    setAttachmentsLoading(true);
    setAttachments([]);
    setActiveAttachmentId(null);

    void fetchTradeAttachments(trade.id)
      .then((next) => {
        if (cancelled) return;
        setAttachments(next);
        setActiveAttachmentId(next[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load trade attachments.");
        }
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trade?.id]);

  function moveTrade(offset: number) {
    if (!trade || trades.length < 2) return;
    const nextIndex = (currentIndex + offset + trades.length) % trades.length;
    setActiveTradeId(trades[nextIndex].id);
    setActiveTab("DETAILS");
  }

  if (loading) {
    return <div className={styles.state}>Loading closed trades for review…</div>;
  }

  if (error && allTrades.length === 0) {
    return <div className={`${styles.state} ${styles.error}`}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      <section className={styles.toolbar}>
        <div>
          <span>INSTRUMENT</span>
          <select
            value={instrument}
            onChange={(event) => setInstrument(event.target.value as TradeReviewInstrumentFilter)}
          >
            <option value="ALL">All instruments</option>
            {JOURNAL_INSTRUMENTS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className={styles.navigator}>
          <button type="button" onClick={() => moveTrade(1)} disabled={trades.length < 2} aria-label="Previous trade">
            ‹
          </button>
          <span>
            {trade ? `TRADE ${currentIndex + 1} OF ${trades.length}` : "NO CLOSED TRADES"}
          </span>
          <button type="button" onClick={() => moveTrade(-1)} disabled={trades.length < 2} aria-label="Next trade">
            ›
          </button>
        </div>
      </section>

      {error && <p className={styles.inlineError}>{error}</p>}

      {!trade ? (
        <div className={styles.state}>
          No closed trades match this instrument filter.
        </div>
      ) : (
        <>
          <section className={styles.viewer}>
            <div className={styles.mediaPanel}>
              <header className={styles.mediaHeader}>
                <div>
                  <span>TRADE CHART</span>
                  <strong>{trade.instrument} · {trade.direction}</strong>
                </div>
                {activeAttachment && (
                  <small>{activeAttachment.originalFilename}</small>
                )}
              </header>

              <div className={styles.imageStage}>
                {attachmentsLoading ? (
                  <div className={styles.imagePlaceholder}>Loading chart images…</div>
                ) : activeAttachment ? (
                  <img
                    key={activeAttachment.id}
                    src={tradeAttachmentImageUrl(trade.id, activeAttachment.id)}
                    alt={activeAttachment.originalFilename}
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <strong>No chart image attached</strong>
                    <span>Add a screenshot to this trade from the Journal to review it here.</span>
                  </div>
                )}
              </div>
            </div>

            <aside className={styles.sidePanel}>
              <header className={styles.tradeHeader}>
                <div>
                  <span>{trade.outcome ?? "CLOSED"}</span>
                  <strong>{trade.instrument} · {trade.direction}</strong>
                  <small>{formatDateTime(trade.openedAt)} → {formatDateTime(trade.closedAt)}</small>
                </div>
                <strong
                  className={
                    trade.netPnl == null
                      ? undefined
                      : trade.netPnl > 0
                        ? styles.positive
                        : trade.netPnl < 0
                          ? styles.negative
                          : undefined
                  }
                >
                  {trade.netPnl == null ? "—" : money.format(trade.netPnl)}
                </strong>
              </header>

              <nav className={tabStyles.tabs} aria-label="Trade review sections">
                <div className={tabStyles.track}>
                  {REVIEW_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`${tabStyles.tab} ${activeTab === tab ? tabStyles.active : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </nav>

              <div className={styles.tabBody}>
                {activeTab === "DETAILS" && (
                  <div className={styles.details}>
                    <div className={detailStyles.pnlHero}>
                      <span>NET P&amp;L</span>
                      <strong className={pnlTone(trade.netPnl)}>
                        {trade.netPnl == null ? "—" : money.format(trade.netPnl)}
                      </strong>
                    </div>

                    <div className={detailStyles.rows}>
                      <div className={detailStyles.row}><span>ENTRY</span><strong>{number.format(trade.entryPrice)}</strong></div>
                      <div className={detailStyles.row}><span>EXIT</span><strong>{trade.exitPrice == null ? "—" : number.format(trade.exitPrice)}</strong></div>
                      <div className={detailStyles.row}><span>STOP</span><strong>{trade.stopPrice == null ? "—" : number.format(trade.stopPrice)}</strong></div>
                      <div className={detailStyles.row}><span>TARGET</span><strong>{trade.targetPrice == null ? "—" : number.format(trade.targetPrice)}</strong></div>
                      <div className={detailStyles.row}><span>CONTRACTS</span><strong>{trade.contracts}</strong></div>
                      <div className={detailStyles.row}><span>DURATION</span><strong>{formatDuration(trade)}</strong></div>
                      <div className={detailStyles.row}><span>GROSS P&amp;L</span><strong className={pnlTone(trade.grossPnl)}>{trade.grossPnl == null ? "—" : money.format(trade.grossPnl)}</strong></div>
                      <div className={detailStyles.row}><span>FEES</span><strong>{money.format(trade.commissionFees)}</strong></div>
                      <div className={detailStyles.row}><span>INITIAL RISK</span><strong>{trade.initialRisk == null ? "—" : money.format(trade.initialRisk)}</strong></div>
                      <div className={detailStyles.row}><span>R MULTIPLE</span><strong className={pnlTone(trade.rMultiple)}>{trade.rMultiple == null ? "—" : `${number.format(trade.rMultiple)}R`}</strong></div>
                      <div className={detailStyles.row}><span>SETUP</span><strong>{trade.setup || "Not set"}</strong></div>
                      <div className={detailStyles.row}><span>CHALLENGE</span><strong>{challengeLabel(trade.challengeId, challenges)}</strong></div>
                      <div className={detailStyles.row}><span>OUTCOME</span><strong>{trade.outcome ?? "—"}</strong></div>
                    </div>
                  </div>
                )}

                {activeTab === "REVIEW" && (() => {
                  const review = readDisciplineReview(trade.tags);
                  const userTags = trade.tags.filter((tag) => !tag.startsWith("FFZ:"));

                  return (
                    <div className={styles.reviewBody}>
                      <div className={styles.reviewCards}>
                        <div>
                          <span>EXECUTION</span>
                          <strong>{optionLabel(EXECUTION_REVIEW_OPTIONS, review.execution)}</strong>
                        </div>
                        <div>
                          <span>MINDSET</span>
                          <strong>{optionLabel(MINDSET_REVIEW_OPTIONS, review.mindset)}</strong>
                        </div>
                        <div>
                          <span>TRADE ORIGIN</span>
                          <strong>{trade.tags.includes(STARTED_FROM_PLAN_TAG) ? "FFZ planned" : "Not started from plan"}</strong>
                        </div>
                      </div>

                      <div className={styles.tagSection}>
                        <span>TAGS</span>
                        {userTags.length > 0 ? (
                          <div className={styles.tags}>
                            {userTags.map((tag) => <em key={tag}>{tag}</em>)}
                          </div>
                        ) : (
                          <small>No user tags on this trade.</small>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {activeTab === "ATTACHMENTS" && (
                  <div className={styles.attachmentsTab}>
                    {attachmentsLoading ? (
                      <div className={styles.tabEmpty}>Loading attachments…</div>
                    ) : attachments.length === 0 ? (
                      <div className={styles.tabEmpty}>No screenshots are attached to this trade.</div>
                    ) : (
                      <div className={styles.attachmentList}>
                        {attachments.map((attachment, index) => (
                          <button
                            key={attachment.id}
                            type="button"
                            className={attachment.id === activeAttachment?.id ? styles.activeAttachment : undefined}
                            onClick={() => setActiveAttachmentId(attachment.id)}
                          >
                            <img
                              src={tradeAttachmentImageUrl(trade.id, attachment.id)}
                              alt=""
                            />
                            <span>
                              <strong>IMAGE {index + 1}</strong>
                              <small>{attachment.originalFilename}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "NOTES" && (
                  <div className={styles.notes}>
                    {trade.notes ? <p>{trade.notes}</p> : <div className={styles.tabEmpty}>No notes saved for this trade.</div>}
                  </div>
                )}
              </div>
            </aside>
          </section>

          <TradeReviewPerformance
            trades={trades}
            anchorTimestamp={trade.closedAt ?? trade.openedAt}
            scopeLabel={instrument === "ALL" ? "All instruments" : instrument}
          />
        </>
      )}
    </div>
  );
}
