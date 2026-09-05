"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWeeklyFocus, saveWeeklyFocusViaApi } from "@/lib/weekly-focus/api-client";
import {
  WEEKLY_FOCUS_SIGNAL_KEYS,
  type WeeklyFocusApiModel,
  type WeeklyFocusSignalKey,
  type WeeklyFocusStatus,
} from "@/lib/weekly-focus/types";
import { localDateKey } from "@/lib/weekly-focus/week";
import styles from "./NextWeekFocusPanel.module.css";

const SIGNAL_LABELS: Record<WeeklyFocusSignalKey, string> = {
  RAPID_REENTRY: "Rapid Re-entry",
  POST_LOSS_ACTIVITY: "Post-loss Activity",
  LOSS_STREAK: "Loss Streak",
  OVERTRADING: "Overtrading",
  DAILY_LOSS_COUNT: "Daily Loss Count",
  PLAN_BREAKDOWN: "Plan Breakdown",
  MINDSET_SHIFT: "Mindset Shift",
  RISK_ESCALATION: "Risk Escalation",
};

function weekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusClass(status: WeeklyFocusStatus) {
  if (status === "ACHIEVED") return styles.achieved;
  if (status === "PARTIAL") return styles.partial;
  if (status === "MISSED") return styles.missed;
  return styles.active;
}

function selectedStatusClass(status: WeeklyFocusStatus) {
  if (status === "ACHIEVED") return styles.selectedAchieved;
  if (status === "PARTIAL") return styles.selectedPartial;
  if (status === "MISSED") return styles.selectedMissed;
  return styles.selectedActive;
}

export function NextWeekFocusPanel({
  selectedWeekStart,
  selectedWeekEnd,
}: {
  selectedWeekStart: Date;
  selectedWeekEnd: Date;
}) {
  const currentKey = localDateKey(selectedWeekStart);
  const nextKey = localDateKey(selectedWeekEnd);
  const [currentFocus, setCurrentFocus] = useState<WeeklyFocusApiModel | null>(null);
  const [nextFocus, setNextFocus] = useState<WeeklyFocusApiModel | null>(null);
  const [primaryFocus, setPrimaryFocus] = useState("");
  const [rule, setRule] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [sourceSignalKey, setSourceSignalKey] = useState<WeeklyFocusSignalKey | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedMessage(null);
      try {
        const [current, next] = await Promise.all([
          fetchWeeklyFocus(currentKey),
          fetchWeeklyFocus(nextKey),
        ]);
        if (cancelled) return;
        setCurrentFocus(current);
        setNextFocus(next);
        setPrimaryFocus(next?.primaryFocus ?? "");
        setRule(next?.rule ?? "");
        setWhyItMatters(next?.whyItMatters ?? "");
        setSourceSignalKey(next?.sourceSignalKey ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load weekly focus.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentKey, nextKey]);

  const canAssess = useMemo(
    () => selectedWeekEnd.getTime() <= Date.now(),
    [selectedWeekEnd],
  );

  async function saveNextFocus() {
    if (primaryFocus.trim().length < 3 || rule.trim().length < 3) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const saved = await saveWeeklyFocusViaApi({
        weekStart: nextKey,
        primaryFocus,
        rule,
        whyItMatters: whyItMatters.trim() || null,
        sourceSignalKey: sourceSignalKey || null,
        status: nextFocus?.status ?? "ACTIVE",
      });
      setNextFocus(saved);
      setPrimaryFocus(saved.primaryFocus);
      setRule(saved.rule);
      setWhyItMatters(saved.whyItMatters ?? "");
      setSourceSignalKey(saved.sourceSignalKey ?? "");
      setSavedMessage("Next week focus saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save next week focus.");
    } finally {
      setSaving(false);
    }
  }

  async function assess(status: WeeklyFocusStatus) {
    if (!currentFocus) return;
    setAssessing(true);
    setError(null);
    try {
      const saved = await saveWeeklyFocusViaApi({
        weekStart: currentFocus.weekStart,
        primaryFocus: currentFocus.primaryFocus,
        rule: currentFocus.rule,
        whyItMatters: currentFocus.whyItMatters,
        sourceSignalKey: currentFocus.sourceSignalKey,
        status,
      });
      setCurrentFocus(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update focus result.");
    } finally {
      setAssessing(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="Weekly commitment and next week focus">
      <header className={styles.header}>
        <div>
          <span>WEEKLY COMMITMENT</span>
          <small>Turn the review into one concrete behavior to carry into the next trading week.</small>
        </div>
        <strong className={styles.loopBadge}>REVIEW → ACTION</strong>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span>THIS WEEK COMMITMENT</span>
              <strong>Week of {weekLabel(selectedWeekStart)}</strong>
            </div>
            {currentFocus && (
              <b className={`${styles.status} ${statusClass(currentFocus.status)}`}>
                {currentFocus.status}
              </b>
            )}
          </div>

          {loading ? (
            <div className={styles.empty}><strong>Loading commitment…</strong></div>
          ) : currentFocus ? (
            <div className={styles.focusView}>
              <div className={styles.focusBlock}>
                <span>PRIMARY FOCUS</span>
                <strong>{currentFocus.primaryFocus}</strong>
              </div>
              <div className={styles.focusBlock}>
                <span>RULE</span>
                <p>{currentFocus.rule}</p>
              </div>
              {currentFocus.whyItMatters && (
                <div className={styles.focusBlock}>
                  <span>WHY IT MATTERS</span>
                  <p>{currentFocus.whyItMatters}</p>
                </div>
              )}
              <div className={styles.metaRow}>
                {currentFocus.sourceSignalKey && (
                  <span className={styles.metaChip}>From {SIGNAL_LABELS[currentFocus.sourceSignalKey]}</span>
                )}
                <span className={styles.metaChip}>Saved {new Date(currentFocus.updatedAt).toLocaleDateString()}</span>
              </div>

              <div className={styles.assessment}>
                <span>{canAssess ? "HOW DID THIS COMMITMENT GO?" : "ASSESS AFTER THE WEEK CLOSES"}</span>
                <div className={styles.statusButtons}>
                  {(["ACHIEVED", "PARTIAL", "MISSED"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!canAssess || assessing}
                      className={currentFocus.status === status ? selectedStatusClass(status) : ""}
                      onClick={() => void assess(status)}
                    >
                      {status}
                    </button>
                  ))}
                  {currentFocus.status !== "ACTIVE" && (
                    <button
                      type="button"
                      disabled={!canAssess || assessing}
                      onClick={() => void assess("ACTIVE")}
                    >
                      RESET
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>No commitment was set for this week.</strong>
              <p>Once you save a Next Week Focus, it will appear here when that week becomes active.</p>
            </div>
          )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span>NEXT WEEK FOCUS</span>
              <strong>Week of {weekLabel(selectedWeekEnd)}</strong>
            </div>
            {nextFocus && <b className={`${styles.status} ${statusClass(nextFocus.status)}`}>SAVED</b>}
          </div>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>PRIMARY FOCUS</span>
              <input
                value={primaryFocus}
                maxLength={180}
                placeholder="e.g. Slow down after a losing trade"
                onChange={(event) => setPrimaryFocus(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>RULE</span>
              <textarea
                value={rule}
                maxLength={1000}
                placeholder="e.g. Wait at least 15 minutes after a loss before considering another entry."
                onChange={(event) => setRule(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>WHY IT MATTERS · OPTIONAL</span>
              <textarea
                value={whyItMatters}
                maxLength={1000}
                placeholder="Use an observation from this review, not a guess about intent."
                onChange={(event) => setWhyItMatters(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>SOURCE SIGNAL · OPTIONAL</span>
              <select
                value={sourceSignalKey}
                onChange={(event) => setSourceSignalKey(event.target.value as WeeklyFocusSignalKey | "")}
              >
                <option value="">General / no linked signal</option>
                {WEEKLY_FOCUS_SIGNAL_KEYS.map((key) => (
                  <option key={key} value={key}>{SIGNAL_LABELS[key]}</option>
                ))}
              </select>
            </label>

            <div className={styles.formFooter}>
              <small>{savedMessage ?? (nextFocus ? "Update this commitment any time before the week starts." : "One focus. One rule. Keep it specific.")}</small>
              <button
                type="button"
                className={styles.saveButton}
                disabled={saving || primaryFocus.trim().length < 3 || rule.trim().length < 3}
                onClick={() => void saveNextFocus()}
              >
                {saving ? "SAVING…" : nextFocus ? "UPDATE FOCUS" : "SAVE NEXT WEEK FOCUS"}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
