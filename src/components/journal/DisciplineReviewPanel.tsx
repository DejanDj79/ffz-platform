"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type ReviewOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
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

function ReviewDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly ReviewOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "Not reviewed";

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(260, (options.length + 1) * 38 + 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    setPosition({
      top: openUp
        ? Math.max(8, rect.top - menuHeight - 4)
        : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 4),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node | null;

      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeOnScrollOrResize() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnScrollOrResize);
    window.addEventListener("scroll", closeOnScrollOrResize, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnScrollOrResize);
      window.removeEventListener("scroll", closeOnScrollOrResize, true);
    };
  }, [open, options.length]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <span className={styles.selectCaret} aria-hidden="true">⌄</span>
      </button>

      {open && position &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.selectMenu}
            role="listbox"
            style={position}
          >
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className={value === "" ? styles.selectOptionActive : ""}
              onClick={() => {
                onChange("");
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              Not reviewed
            </button>

            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? styles.selectOptionActive : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function DisciplineReviewPanel() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const next = (await fetchTrades()).filter(
        (trade) => trade.status === "CLOSED",
      );

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

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function onWheel(event: globalThis.WheelEvent) {
      const atTop = list.scrollTop <= 0;
      const atBottom =
        list.scrollTop + list.clientHeight >= list.scrollHeight - 1;

      if (
        (event.deltaY < 0 && atTop) ||
        (event.deltaY > 0 && atBottom)
      ) {
        event.preventDefault();
        window.scrollBy({ top: event.deltaY, behavior: "auto" });
      }
    }

    list.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      list.removeEventListener("wheel", onWheel);
    };
  }, [trades.length, loading]);

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
        <div ref={listRef} className={styles.list}>
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

                <div className={styles.reviewField}>
                  <span>EXECUTION</span>
                  <ReviewDropdown
                    value={draft.execution}
                    options={EXECUTION_REVIEW_OPTIONS}
                    onChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [trade.id]: {
                          ...draft,
                          execution: value as ExecutionReview | "",
                        },
                      }))
                    }
                  />
                </div>

                <div className={styles.reviewField}>
                  <span>MINDSET</span>
                  <ReviewDropdown
                    value={draft.mindset}
                    options={MINDSET_REVIEW_OPTIONS}
                    onChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [trade.id]: {
                          ...draft,
                          mindset: value as MindsetReview | "",
                        },
                      }))
                    }
                  />
                </div>

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
