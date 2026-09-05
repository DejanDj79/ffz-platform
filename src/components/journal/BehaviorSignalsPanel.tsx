"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateWeeklyBehaviorSignals,
  type WeeklyBehaviorSignal,
  type WeeklyBehaviorSignalKey,
} from "@/lib/journal/behavior-signals";
import type { TradeApiModel } from "@/lib/journal/types";
import { fetchTradingGuardrailSettings } from "@/lib/trading/guardrails-api-client";
import type { TradingGuardrailSettings } from "@/lib/trading/guardrails-types";
import styles from "./BehaviorSignalsPanel.module.css";

const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function tradeTone(value: number) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}

function preferredSignal(signals: WeeklyBehaviorSignal[]) {
  return signals.find((signal) => signal.tone === "warning")
    ?? signals.find((signal) => signal.tone === "watch")
    ?? signals[0]
    ?? null;
}

type BehaviorSignalsPanelProps = {
  trades: TradeApiModel[];
  guardrailsOverride?: TradingGuardrailSettings | null;
  demoMode?: boolean;
};

export function BehaviorSignalsPanel({
  trades,
  guardrailsOverride,
  demoMode = false,
}: BehaviorSignalsPanelProps) {
  const [guardrails, setGuardrails] = useState<TradingGuardrailSettings | null>(guardrailsOverride ?? null);
  const [selectedKey, setSelectedKey] = useState<WeeklyBehaviorSignalKey | null>(null);

  useEffect(() => {
    if (guardrailsOverride !== undefined) {
      setGuardrails(guardrailsOverride);
      return;
    }

    let cancelled = false;

    async function loadGuardrails() {
      try {
        const settings = await fetchTradingGuardrailSettings();
        if (!cancelled) setGuardrails(settings);
      } catch {
        if (!cancelled) setGuardrails(null);
      }
    }

    void loadGuardrails();
    return () => {
      cancelled = true;
    };
  }, [guardrailsOverride]);

  const signals = useMemo(
    () => calculateWeeklyBehaviorSignals(trades, guardrails),
    [trades, guardrails],
  );

  const signature = useMemo(
    () => signals.map((signal) => `${signal.key}:${signal.value}:${signal.tone}`).join("|"),
    [signals],
  );

  useEffect(() => {
    const preferred = preferredSignal(signals);
    setSelectedKey(preferred?.key ?? null);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = signals.find((signal) => signal.key === selectedKey) ?? preferredSignal(signals);

  return (
    <section className={styles.panel} aria-label="Objective behavior signals">
      <header className={styles.header}>
        <div>
          <span>BEHAVIOR SIGNALS</span>
          <small>
            {demoMode
              ? "Development demo data only. Synthetic trades are not saved and do not affect your real journal."
              : "Objective patterns from actual trades and your enabled Guardrails. FFZ does not infer psychological intent."}
          </small>
        </div>
        <strong className={styles.objectiveBadge}>{demoMode ? "DEMO DATA" : "OBJECTIVE ONLY"}</strong>
      </header>

      <div className={styles.grid}>
        {signals.map((signal) => {
          const selectedSignal = selected?.key === signal.key;
          return (
            <button
              key={signal.key}
              type="button"
              className={`${styles.card} ${styles[signal.tone]} ${selectedSignal ? styles.cardSelected : ""}`}
              onClick={() => setSelectedKey(signal.key)}
              aria-pressed={selectedSignal}
            >
              <span className={styles.cardTop}>
                <span>{signal.label}</span>
                <i aria-hidden="true" />
              </span>
              <strong className={styles.value}>{signal.value}</strong>
              <span className={styles.caption}>{signal.caption}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <div>
              <strong>{selected.label}</strong>
              <p>{selected.summary}</p>
            </div>
            <span className={styles.detailValue}>{selected.value}</span>
          </div>

          {selected.events.length > 0 ? (
            <div className={styles.events}>
              {selected.events.map((event) => (
                <article key={event.id} className={styles.event}>
                  <div className={styles.eventHeader}>
                    <strong>{event.title}</strong>
                    <span>{event.detail}</span>
                  </div>
                  <div className={styles.trades}>
                    {event.trades.map((trade, index) => (
                      <div key={`${event.id}-${trade.id}-${index}`} className={styles.trade}>
                        <div className={styles.tradeTop}>
                          <strong>{trade.instrument}</strong>
                          <time dateTime={trade.openedAt}>{time.format(new Date(trade.openedAt))}</time>
                        </div>
                        <div className={styles.tradeMeta}>
                          <span>{trade.outcome ?? "—"}</span>
                          <span className={tradeTone(trade.netPnl)}>{signedMoney(trade.netPnl)}</span>
                          {trade.execution && <span>{trade.execution.replaceAll("_", " ")}</span>}
                          {trade.mindset && <span>{trade.mindset.replaceAll("_", " ")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyEvents}>No qualifying trade sequence to show for this signal in the selected week.</div>
          )}
        </div>
      )}
    </section>
  );
}
