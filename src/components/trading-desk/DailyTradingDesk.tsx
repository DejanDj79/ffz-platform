"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import type { Challenge } from "@/lib/challenges/types";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/api-client";
import type { EconomicCalendarPayload } from "@/lib/economic-calendar/types";
import { fetchTrades } from "@/lib/journal/api-client";
import type { JournalInstrument, TradeApiModel } from "@/lib/journal/types";
import {
  calculateDeskGuardrails,
  localDateKey,
  summarizeTradingDay,
} from "@/lib/trading-desk/summary";
import styles from "./DailyTradingDesk.module.css";

type DeskBias = "NEUTRAL" | "BULLISH" | "BEARISH";
type SessionStatus = "PLANNING" | "LIVE" | "ENDED";
type ChecklistKey = "calendar" | "levels" | "risk" | "stopRules";

type DeskPlan = {
  accountId: string;
  instrument: JournalInstrument;
  maxRiskPerTrade: number;
  maxLosingTrades: number;
  bias: DeskBias;
  keyLevels: string;
  setupFocus: string;
  noTradeConditions: string;
  checklist: Record<ChecklistKey, boolean>;
  sessionStatus: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  reviewGood: string;
  reviewImprove: string;
  rulesFollowed: boolean | null;
};

const DEFAULT_PLAN: DeskPlan = {
  accountId: "",
  instrument: "MNQ",
  maxRiskPerTrade: 100,
  maxLosingTrades: 3,
  bias: "NEUTRAL",
  keyLevels: "",
  setupFocus: "",
  noTradeConditions: "",
  checklist: {
    calendar: false,
    levels: false,
    risk: false,
    stopRules: false,
  },
  sessionStatus: "PLANNING",
  startedAt: null,
  endedAt: null,
  reviewGood: "",
  reviewImprove: "",
  rulesFollowed: null,
};

const CHECKLIST_ITEMS: Array<{ key: ChecklistKey; label: string; detail: string }> = [
  { key: "calendar", label: "Economic calendar checked", detail: "Know every USD high-impact event around your trading window." },
  { key: "levels", label: "Key levels marked", detail: "Premarket high/low, overnight structure and your important reaction areas." },
  { key: "risk", label: "Risk confirmed", detail: "Contract size and stop placement must fit today's max risk per trade." },
  { key: "stopRules", label: "Stop conditions accepted", detail: "No revenge trades after your daily loss or losing-trade limit is reached." },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function normalizePlan(input: Partial<DeskPlan>): DeskPlan {
  return {
    ...DEFAULT_PLAN,
    ...input,
    maxRiskPerTrade: Number.isFinite(input.maxRiskPerTrade) ? Math.max(0, input.maxRiskPerTrade ?? 100) : 100,
    maxLosingTrades: Number.isFinite(input.maxLosingTrades) ? Math.max(1, Math.floor(input.maxLosingTrades ?? 3)) : 3,
    checklist: {
      ...DEFAULT_PLAN.checklist,
      ...(input.checklist ?? {}),
    },
  };
}

function storageKey(dateKey: string) {
  return `ffz-daily-trading-desk-v1:${dateKey}`;
}

function formatTime(value: string | null, timeZone?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function countdownLabel(eventDate: string, now: Date) {
  const deltaMs = new Date(eventDate).getTime() - now.getTime();
  if (deltaMs <= 0) return "released";
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `in ${hours}h ${remainder}m` : `in ${hours}h`;
}

export function DailyTradingDesk() {
  const [now, setNow] = useState(() => new Date());
  const [plan, setPlan] = useState<DeskPlan>(DEFAULT_PLAN);
  const [hydrated, setHydrated] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [calendar, setCalendar] = useState<EconomicCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [editingLivePlan, setEditingLivePlan] = useState(false);

  const dateKey = localDateKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setHydrated(false);
    setEditingLivePlan(false);
    try {
      const raw = window.localStorage.getItem(storageKey(dateKey));
      setPlan(raw ? normalizePlan(JSON.parse(raw) as Partial<DeskPlan>) : DEFAULT_PLAN);
    } catch {
      setPlan(DEFAULT_PLAN);
    } finally {
      setHydrated(true);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(dateKey), JSON.stringify(plan));
  }, [dateKey, hydrated, plan]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setCalendarError(null);

    const [challengeResult, tradeResult, calendarResult] = await Promise.allSettled([
      fetchChallenges(),
      fetchTrades(),
      fetchEconomicCalendar(),
    ]);

    if (challengeResult.status === "fulfilled") {
      setChallenges(challengeResult.value);
    } else {
      setError("Unable to load challenge data.");
    }

    if (tradeResult.status === "fulfilled") {
      setTrades(tradeResult.value);
    } else {
      setError((current) => current ?? "Unable to load Journal trades.");
    }

    if (calendarResult.status === "fulfilled") {
      setCalendar(calendarResult.value);
    } else {
      setCalendarError("Economic calendar is temporarily unavailable.");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!hydrated || plan.accountId || challenges.length === 0) return;
    const preferred = challenges.find((challenge) => challenge.status === "IN_PROGRESS") ?? challenges[0];
    setPlan((current) => ({ ...current, accountId: preferred?.id ?? "ALL" }));
  }, [challenges, hydrated, plan.accountId]);

  const selectedChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === plan.accountId) ?? null,
    [challenges, plan.accountId],
  );

  const challengeMetrics = useMemo(
    () => selectedChallenge ? calculateChallengeMetrics(selectedChallenge) : null,
    [selectedChallenge],
  );

  const daySummary = useMemo(
    () => summarizeTradingDay(trades, now, plan.accountId || "ALL"),
    [now, plan.accountId, trades],
  );

  const challengeDailyLossRemaining = selectedChallenge && selectedChallenge.dailyLossLimit > 0
    ? Math.max(0, selectedChallenge.dailyLossLimit + Math.min(0, daySummary.netPnl))
    : null;

  const guardrails = useMemo(
    () => calculateDeskGuardrails({
      summary: daySummary,
      maxRiskPerTrade: plan.maxRiskPerTrade,
      maxLosingTrades: plan.maxLosingTrades,
      challengeRemainingDrawdown: challengeMetrics?.remainingDrawdown ?? null,
      challengeRemainingDailyLoss: challengeDailyLossRemaining,
      challengeFailed: selectedChallenge?.status === "FAILED",
    }),
    [challengeDailyLossRemaining, challengeMetrics?.remainingDrawdown, daySummary, plan.maxLosingTrades, plan.maxRiskPerTrade, selectedChallenge?.status],
  );

  const highImpactEvents = useMemo(() => {
    if (!calendar) return [];
    return calendar.events
      .filter((event) =>
        event.impact === "High"
        && (event.currency === "USD" || event.country === "US")
        && localDateKey(event.date) === dateKey,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendar, dateKey]);

  const nextHighEvent = highImpactEvents.find((event) => new Date(event.date).getTime() >= now.getTime()) ?? null;
  const checklistDone = CHECKLIST_ITEMS.every((item) => plan.checklist[item.key]);
  const canStart = checklistDone && plan.maxRiskPerTrade > 0 && guardrails.status !== "STOP";
  const planLocked = plan.sessionStatus !== "PLANNING" && !editingLivePlan;
  const sessionEffectiveStatus = guardrails.status === "STOP" && plan.sessionStatus === "LIVE"
    ? "STOP"
    : plan.sessionStatus;

  function updatePlan<K extends keyof DeskPlan>(key: K, value: DeskPlan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
  }

  function toggleChecklist(key: ChecklistKey) {
    if (planLocked) return;
    setPlan((current) => ({
      ...current,
      checklist: {
        ...current.checklist,
        [key]: !current.checklist[key],
      },
    }));
  }

  function startSession() {
    if (!canStart) return;
    setEditingLivePlan(false);
    setPlan((current) => ({
      ...current,
      sessionStatus: "LIVE",
      startedAt: current.startedAt ?? new Date().toISOString(),
      endedAt: null,
    }));
  }

  function endSession() {
    setEditingLivePlan(false);
    setPlan((current) => ({
      ...current,
      sessionStatus: "ENDED",
      endedAt: new Date().toISOString(),
    }));
  }

  function reopenSession() {
    setEditingLivePlan(false);
    setPlan((current) => ({
      ...current,
      sessionStatus: "LIVE",
      endedAt: null,
    }));
  }

  function toggleLivePlanEditing() {
    if (editingLivePlan) {
      setEditingLivePlan(false);
      return;
    }

    if (!window.confirm("Edit the live trading plan? Changes to risk limits during a session should be intentional.")) return;
    setEditingLivePlan(true);
  }

  function resetToday() {
    if (!window.confirm("Reset today's Trading Desk plan and checklist?")) return;
    const preferred = challenges.find((challenge) => challenge.status === "IN_PROGRESS") ?? challenges[0];
    const next = { ...DEFAULT_PLAN, accountId: preferred?.id ?? "ALL" };
    setEditingLivePlan(false);
    setPlan(next);
    window.localStorage.setItem(storageKey(dateKey), JSON.stringify(next));
  }

  const statusClass = guardrails.status === "STOP"
    ? styles.stopStatus
    : guardrails.status === "CAUTION"
      ? styles.cautionStatus
      : styles.goStatus;

  return (
    <main className={styles.page}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button type="button" onClick={() => void load(true)}>Retry</button>
        </div>
      )}

      <section className={styles.sessionHeader}>
        <div className={styles.sessionIdentity}>
          <span className={styles.eyebrow}>DAILY OPERATING PLAN</span>
          <strong>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</strong>
          <small>
            Local {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            <i>·</i>
            NY {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now)}
          </small>
        </div>

        <div className={styles.sessionActions}>
          <span className={`${styles.sessionState} ${sessionEffectiveStatus === "STOP" ? styles.sessionStopped : ""}`}>
            {sessionEffectiveStatus === "PLANNING" && "PLANNING"}
            {sessionEffectiveStatus === "LIVE" && "SESSION LIVE"}
            {sessionEffectiveStatus === "ENDED" && "SESSION ENDED"}
            {sessionEffectiveStatus === "STOP" && "STOP TRADING"}
          </span>
          <button className={styles.ghostButton} type="button" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? "SYNCING…" : "SYNC DATA"}
          </button>
          {plan.sessionStatus === "PLANNING" && (
            <button className={styles.primaryButton} type="button" disabled={!canStart} onClick={startSession}>START SESSION</button>
          )}
          {plan.sessionStatus === "LIVE" && (
            <button className={styles.endButton} type="button" onClick={endSession}>END SESSION</button>
          )}
          {plan.sessionStatus === "ENDED" && (
            <button className={styles.ghostButton} type="button" onClick={reopenSession}>REOPEN</button>
          )}
        </div>
      </section>

      <section className={`${styles.guardrailBanner} ${statusClass}`}>
        <div>
          <span>RISK STATE</span>
          <strong>{guardrails.status === "STOP" ? "STOP TRADING" : guardrails.status === "CAUTION" ? "REDUCE FREQUENCY — PROTECT THE DAY" : "CLEAR TO EXECUTE THE PLAN"}</strong>
        </div>
        <p>{guardrails.reasons[0]}</p>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span>TODAY P&amp;L</span>
          <strong className={daySummary.netPnl > 0 ? styles.positive : daySummary.netPnl < 0 ? styles.negative : ""}>{signedMoney(daySummary.netPnl)}</strong>
          <small>Closed Journal trades for selected account</small>
        </article>
        <article className={styles.kpiCard}>
          <span>TRADES TODAY</span>
          <strong>{daySummary.totalTrades}</strong>
          <small>{daySummary.closedTrades} closed · {daySummary.openTrades} open</small>
        </article>
        <article className={styles.kpiCard}>
          <span>LOSING TRADES</span>
          <strong className={daySummary.losses >= plan.maxLosingTrades ? styles.negative : ""}>{daySummary.losses} / {plan.maxLosingTrades}</strong>
          <small>{guardrails.remainingLossSlots} loss slot{guardrails.remainingLossSlots === 1 ? "" : "s"} remaining</small>
        </article>
        <article className={styles.kpiCard}>
          <span>LOSS BUDGET</span>
          <strong>{money.format(guardrails.grossLossRemaining)}</strong>
          <small>{money.format(daySummary.grossLoss)} used of {money.format(guardrails.maxPlannedLoss)}</small>
        </article>
        <article className={styles.kpiCard}>
          <span>REMAINING DD</span>
          <strong>{challengeMetrics ? money.format(challengeMetrics.remainingDrawdown) : "—"}</strong>
          <small>{selectedChallenge ? selectedChallenge.name : "No challenge selected"}</small>
        </article>
        <article className={styles.kpiCard}>
          <span>DAILY LOSS BUFFER</span>
          <strong>{challengeDailyLossRemaining == null ? "NO RULE" : money.format(challengeDailyLossRemaining)}</strong>
          <small>{selectedChallenge?.dailyLossLimit ? `${money.format(selectedChallenge.dailyLossLimit)} firm limit` : "Selected account has no daily-loss rule"}</small>
        </article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>SESSION PLAN</span>
                <small>{plan.sessionStatus === "PLANNING" ? "Decide the rules before the market starts moving." : editingLivePlan ? "Live plan editing unlocked — relock when finished." : "Trading plan locked for this session."}</small>
              </div>
              {plan.sessionStatus === "PLANNING" && (
                <button type="button" className={styles.textButton} onClick={resetToday}>RESET TODAY</button>
              )}
              {plan.sessionStatus === "LIVE" && (
                <button type="button" className={styles.textButton} onClick={toggleLivePlanEditing}>
                  {editingLivePlan ? "LOCK PLAN" : "EDIT LIVE PLAN"}
                </button>
              )}
            </header>

            <div className={styles.planBody}>
              <div className={styles.fieldGrid}>
                <label>
                  <span>ACCOUNT / CHALLENGE</span>
                  <select disabled={planLocked} value={plan.accountId} onChange={(event) => updatePlan("accountId", event.target.value)}>
                    {!plan.accountId && <option value="">Loading account…</option>}
                    <option value="ALL">All Journal accounts</option>
                    <option value="NONE">Personal / no challenge</option>
                    {challenges.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>{challenge.name} · {challenge.status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>INSTRUMENT</span>
                  <select disabled={planLocked} value={plan.instrument} onChange={(event) => updatePlan("instrument", event.target.value as JournalInstrument)}>
                    <option value="MNQ">MNQ</option>
                    <option value="MES">MES</option>
                    <option value="NQ">NQ</option>
                    <option value="ES">ES</option>
                  </select>
                </label>

                <label>
                  <span>MAX RISK / TRADE</span>
                  <div className={styles.moneyField}>
                    <b>$</b>
                    <input disabled={planLocked} type="number" min="0" step="10" value={plan.maxRiskPerTrade} onChange={(event) => updatePlan("maxRiskPerTrade", Math.max(0, Number(event.target.value)))} />
                  </div>
                </label>

                <label>
                  <span>MAX LOSING TRADES</span>
                  <input disabled={planLocked} type="number" min="1" max="10" step="1" value={plan.maxLosingTrades} onChange={(event) => updatePlan("maxLosingTrades", Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
                </label>

                <label>
                  <span>PREMARKET BIAS</span>
                  <select disabled={planLocked} value={plan.bias} onChange={(event) => updatePlan("bias", event.target.value as DeskBias)}>
                    <option value="NEUTRAL">Neutral / React</option>
                    <option value="BULLISH">Bullish</option>
                    <option value="BEARISH">Bearish</option>
                  </select>
                </label>

                <div className={styles.quickLinks}>
                  <span>QUICK TOOLS</span>
                  <div>
                    <Link href="/tools/risk-calculator">Risk Calculator</Link>
                    <Link href="/journal">Journal</Link>
                    <Link href="/economic-calendar">Calendar</Link>
                  </div>
                </div>
              </div>

              <div className={styles.notesGrid}>
                <label>
                  <span>KEY LEVELS</span>
                  <textarea disabled={planLocked} rows={4} placeholder="Premarket high/low, overnight high/low, prior day levels…" value={plan.keyLevels} onChange={(event) => updatePlan("keyLevels", event.target.value)} />
                </label>
                <label>
                  <span>SETUP FOCUS</span>
                  <textarea disabled={planLocked} rows={4} placeholder="What exactly must happen before you take a trade?" value={plan.setupFocus} onChange={(event) => updatePlan("setupFocus", event.target.value)} />
                </label>
                <label>
                  <span>NO-TRADE CONDITIONS</span>
                  <textarea disabled={planLocked} rows={4} placeholder="Conditions that invalidate the session or force you to sit out." value={plan.noTradeConditions} onChange={(event) => updatePlan("noTradeConditions", event.target.value)} />
                </label>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>PRE-SESSION CHECKLIST</span>
                <small>{CHECKLIST_ITEMS.filter((item) => plan.checklist[item.key]).length} / {CHECKLIST_ITEMS.length} complete · {plan.sessionStatus === "PLANNING" ? "all four required to start" : "locked after session start"}</small>
              </div>
            </header>
            <div className={styles.checklist}>
              {CHECKLIST_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={planLocked}
                  className={`${styles.checkItem} ${plan.checklist[item.key] ? styles.checkDone : ""}`}
                  onClick={() => toggleChecklist(item.key)}
                >
                  <i>{plan.checklist[item.key] ? "✓" : ""}</i>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                </button>
              ))}
            </div>
          </article>
        </div>

        <div className={styles.rightColumn}>
          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>ACCOUNT GUARDRAILS</span>
                <small>Challenge protection plus your personal daily stop rules.</small>
              </div>
            </header>
            <div className={styles.guardrailsBody}>
              <div className={styles.guardrailRow}><span>Planned instrument</span><strong>{plan.instrument}</strong></div>
              <div className={styles.guardrailRow}><span>Risk per trade</span><strong>{money.format(plan.maxRiskPerTrade)}</strong></div>
              <div className={styles.guardrailRow}><span>Maximum losing trades</span><strong>{plan.maxLosingTrades}</strong></div>
              <div className={styles.guardrailRow}><span>Gross loss used</span><strong className={daySummary.grossLoss > 0 ? styles.negative : ""}>{money.format(daySummary.grossLoss)}</strong></div>
              <div className={styles.guardrailRow}><span>Challenge balance</span><strong>{selectedChallenge ? money.format(selectedChallenge.currentBalance) : "—"}</strong></div>
              <div className={styles.guardrailRow}><span>Drawdown floor</span><strong>{challengeMetrics ? money.format(challengeMetrics.drawdownFloor) : "—"}</strong></div>
              <div className={styles.guardrailRow}><span>Challenge health</span><strong className={challengeMetrics?.health === "DANGER" ? styles.negative : challengeMetrics?.health === "CAUTION" ? styles.cautionText : styles.positive}>{challengeMetrics?.health ?? "—"}</strong></div>
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>USD HIGH-IMPACT NEWS</span>
                <small>{calendar?.stale ? "Cached feed · provider currently stale" : "Today's Forex Factory events"}</small>
              </div>
              {nextHighEvent && <strong className={styles.nextEvent}>{countdownLabel(nextHighEvent.date, now)}</strong>}
            </header>
            <div className={styles.newsList}>
              {calendarError && <div className={styles.newsEmpty}>{calendarError}</div>}
              {!calendarError && highImpactEvents.length === 0 && <div className={styles.newsEmpty}>{loading ? "Loading economic calendar…" : "No USD high-impact events today."}</div>}
              {highImpactEvents.map((event) => {
                const released = new Date(event.date).getTime() < now.getTime();
                return (
                  <div className={`${styles.newsItem} ${released ? styles.newsReleased : ""}`} key={event.id}>
                    <div className={styles.newsTime}>
                      <strong>{formatTime(event.date, "America/New_York")}</strong>
                      <small>NY · {formatTime(event.date)} local</small>
                    </div>
                    <div className={styles.newsTitle}>
                      <strong>{event.title}</strong>
                      <small>Forecast {event.forecast ?? "—"} · Previous {event.previous ?? "—"}</small>
                    </div>
                    <span>{released ? "DONE" : countdownLabel(event.date, now)}</span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>SESSION REVIEW</span>
                <small>Capture the process while the session is still fresh.</small>
              </div>
            </header>
            <div className={styles.reviewBody}>
              <label>
                <span>WHAT DID I DO WELL?</span>
                <textarea rows={3} value={plan.reviewGood} onChange={(event) => updatePlan("reviewGood", event.target.value)} placeholder="Execution, patience, risk control…" />
              </label>
              <label>
                <span>WHAT NEEDS IMPROVEMENT?</span>
                <textarea rows={3} value={plan.reviewImprove} onChange={(event) => updatePlan("reviewImprove", event.target.value)} placeholder="Mistakes, hesitation, overtrading…" />
              </label>
              <label>
                <span>DID I FOLLOW MY RULES?</span>
                <select value={plan.rulesFollowed == null ? "" : plan.rulesFollowed ? "YES" : "NO"} onChange={(event) => updatePlan("rulesFollowed", event.target.value === "" ? null : event.target.value === "YES")}>
                  <option value="">Not reviewed yet</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </label>
              <div className={styles.sessionTimes}>
                <span><small>STARTED</small><strong>{formatTime(plan.startedAt)}</strong></span>
                <span><small>ENDED</small><strong>{formatTime(plan.endedAt)}</strong></span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
