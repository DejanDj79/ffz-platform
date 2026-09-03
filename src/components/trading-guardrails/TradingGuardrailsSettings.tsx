"use client";

import { useEffect, useState } from "react";
import {
  fetchTradingGuardrailSettings,
  saveTradingGuardrailSettingsViaApi,
} from "@/lib/trading/guardrails-api-client";
import { DEFAULT_TRADING_GUARDRAILS } from "@/lib/trading/guardrails";
import type {
  GuardrailSeverity,
  TradingGuardrailSettings,
} from "@/lib/trading/guardrails-types";
import styles from "./TradingGuardrailsSettings.module.css";

const SEVERITIES: GuardrailSeverity[] = ["INFO", "CAUTION", "BLOCKED"];

function cloneDefaults(): TradingGuardrailSettings {
  return JSON.parse(JSON.stringify(DEFAULT_TRADING_GUARDRAILS)) as TradingGuardrailSettings;
}

function SeveritySelect({
  value,
  onChange,
}: {
  value: GuardrailSeverity;
  onChange: (value: GuardrailSeverity) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as GuardrailSeverity)}>
      {SEVERITIES.map((severity) => (
        <option key={severity} value={severity}>{severity}</option>
      ))}
    </select>
  );
}

function RuleRow({
  enabled,
  title,
  description,
  children,
  onEnabled,
}: {
  enabled: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
  onEnabled: (enabled: boolean) => void;
}) {
  return (
    <div className={`${styles.ruleRow} ${enabled ? styles.enabled : ""}`}>
      <label className={styles.ruleToggle}>
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} />
        <span aria-hidden="true" />
      </label>
      <div className={styles.ruleCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <div className={styles.ruleControls}>{children}</div>
    </div>
  );
}

export function TradingGuardrailsSettings() {
  const [settings, setSettings] = useState<TradingGuardrailSettings>(cloneDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const value = await fetchTradingGuardrailSettings();
        if (!cancelled) {
          const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rules } = value;
          setSettings(rules);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load guardrails.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  function updateRule<K extends keyof TradingGuardrailSettings>(
    key: K,
    patch: Partial<TradingGuardrailSettings[K]>,
  ) {
    setSettings((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveTradingGuardrailSettingsViaApi(settings);
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rules } = saved;
      setSettings(rules);
      setMessage("Trading guardrails saved. Risk Calculator will use them automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save guardrails.");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setSettings(cloneDefaults());
    setMessage("Defaults restored locally. Save to apply them.");
    setError(null);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>PRE-TRADE PROTECTION</span>
          <h1>Trading Guardrails</h1>
          <p>Configure your personal trading limits once. FFZ checks them automatically together with prop rules and the Economic Calendar before a planned trade can be saved.</p>
        </div>
        <div className={styles.legend}>
          <b>INFO</b><span>visible context only</span>
          <b>CAUTION</b><span>warning, trade can still be planned</span>
          <b>BLOCKED</b><span>planned trade cannot be saved</span>
        </div>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.message}>{message}</div>}
      {loading && <div className={styles.message}>Loading saved guardrails…</div>}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header>
            <div><span>PERSONAL RULES</span><small>Your rules, separate from prop-firm limits.</small></div>
          </header>

          <RuleRow
            enabled={settings.maxRiskPerTrade.enabled}
            title="Max Risk per Trade"
            description="Checks the actual dollar risk of the proposed position."
            onEnabled={(enabled) => updateRule("maxRiskPerTrade", { enabled })}
          >
            <label>$ <input type="number" min="1" step="1" value={settings.maxRiskPerTrade.value} onChange={(e) => updateRule("maxRiskPerTrade", { value: Number(e.target.value) })} /></label>
            <SeveritySelect value={settings.maxRiskPerTrade.severity} onChange={(severity) => updateRule("maxRiskPerTrade", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.maxDailyLosses.enabled}
            title="Max Losing Trades per Day"
            description="Uses closed Journal losses for the current New York trading day."
            onEnabled={(enabled) => updateRule("maxDailyLosses", { enabled })}
          >
            <label><input type="number" min="1" step="1" value={settings.maxDailyLosses.value} onChange={(e) => updateRule("maxDailyLosses", { value: Number(e.target.value) })} /> losses</label>
            <SeveritySelect value={settings.maxDailyLosses.severity} onChange={(severity) => updateRule("maxDailyLosses", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.maxTradesPerDay.enabled}
            title="Max Trades per Day"
            description="Warns or blocks once today's Journal trade count reaches this value."
            onEnabled={(enabled) => updateRule("maxTradesPerDay", { enabled })}
          >
            <label><input type="number" min="1" step="1" value={settings.maxTradesPerDay.value} onChange={(e) => updateRule("maxTradesPerDay", { value: Number(e.target.value) })} /> trades</label>
            <SeveritySelect value={settings.maxTradesPerDay.severity} onChange={(severity) => updateRule("maxTradesPerDay", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.maxContracts.enabled}
            title="Max Contracts"
            description="Hard sizing cap. Calculator reduces the proposed size instead of blocking a valid smaller trade."
            onEnabled={(enabled) => updateRule("maxContracts", { enabled })}
          >
            <label><input type="number" min="1" step="1" value={settings.maxContracts.value} onChange={(e) => updateRule("maxContracts", { value: Number(e.target.value) })} /> contracts</label>
            <span className={styles.hardCap}>SIZE CAP</span>
          </RuleRow>

          <RuleRow
            enabled={settings.minRewardRisk.enabled}
            title="Minimum Reward / Risk"
            description="Checks the optional Target against your minimum planned R multiple."
            onEnabled={(enabled) => updateRule("minRewardRisk", { enabled })}
          >
            <label><input type="number" min="0.1" step="0.1" value={settings.minRewardRisk.value} onChange={(e) => updateRule("minRewardRisk", { value: Number(e.target.value) })} /> R</label>
            <SeveritySelect value={settings.minRewardRisk.severity} onChange={(severity) => updateRule("minRewardRisk", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.noNewTradesAfter.enabled}
            title="No New Trades After"
            description="Optional New York-time cutoff for new entries."
            onEnabled={(enabled) => updateRule("noNewTradesAfter", { enabled })}
          >
            <label><input type="time" value={settings.noNewTradesAfter.timeEt} onChange={(e) => updateRule("noNewTradesAfter", { timeEt: e.target.value })} /> ET</label>
            <SeveritySelect value={settings.noNewTradesAfter.severity} onChange={(severity) => updateRule("noNewTradesAfter", { severity })} />
          </RuleRow>
        </section>

        <section className={styles.panel}>
          <header>
            <div><span>NEWS LOCKOUT</span><small>USD macro events automatically checked for MNQ / MES / NQ / ES.</small></div>
          </header>

          <RuleRow
            enabled={settings.highImpactNews.enabled}
            title="High Impact USD News"
            description="General lockout around every High impact USD calendar event."
            onEnabled={(enabled) => updateRule("highImpactNews", { enabled })}
          >
            <label><input type="number" min="0" max="240" value={settings.highImpactNews.beforeMinutes} onChange={(e) => updateRule("highImpactNews", { beforeMinutes: Number(e.target.value) })} /> min before</label>
            <label><input type="number" min="0" max="240" value={settings.highImpactNews.afterMinutes} onChange={(e) => updateRule("highImpactNews", { afterMinutes: Number(e.target.value) })} /> min after</label>
            <SeveritySelect value={settings.highImpactNews.severity} onChange={(severity) => updateRule("highImpactNews", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.mediumImpactNews.enabled}
            title="Medium Impact USD News"
            description="Optional lighter protection around Medium impact releases."
            onEnabled={(enabled) => updateRule("mediumImpactNews", { enabled })}
          >
            <label><input type="number" min="0" max="240" value={settings.mediumImpactNews.beforeMinutes} onChange={(e) => updateRule("mediumImpactNews", { beforeMinutes: Number(e.target.value) })} /> min before</label>
            <label><input type="number" min="0" max="240" value={settings.mediumImpactNews.afterMinutes} onChange={(e) => updateRule("mediumImpactNews", { afterMinutes: Number(e.target.value) })} /> min after</label>
            <SeveritySelect value={settings.mediumImpactNews.severity} onChange={(severity) => updateRule("mediumImpactNews", { severity })} />
          </RuleRow>

          <RuleRow
            enabled={settings.majorNewsOverride.enabled}
            title="Major Release Override"
            description="Uses a wider window for matching releases such as CPI, FOMC and Non-Farm data."
            onEnabled={(enabled) => updateRule("majorNewsOverride", { enabled })}
          >
            <label><input type="number" min="0" max="240" value={settings.majorNewsOverride.beforeMinutes} onChange={(e) => updateRule("majorNewsOverride", { beforeMinutes: Number(e.target.value) })} /> min before</label>
            <label><input type="number" min="0" max="240" value={settings.majorNewsOverride.afterMinutes} onChange={(e) => updateRule("majorNewsOverride", { afterMinutes: Number(e.target.value) })} /> min after</label>
            <SeveritySelect value={settings.majorNewsOverride.severity} onChange={(severity) => updateRule("majorNewsOverride", { severity })} />
          </RuleRow>

          <div className={styles.keywordRow}>
            <div><strong>Major-release keywords</strong><small>Comma-separated, case-insensitive title matching.</small></div>
            <textarea
              value={settings.majorNewsOverride.keywords.join(", ")}
              onChange={(event) => updateRule("majorNewsOverride", {
                keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
              })}
            />
          </div>

          <div className={styles.newsNote}>
            News checks use the same Forex Factory-backed Economic Calendar already available in FFZ. If the feed cannot be verified or is stale while a news rule is enabled, the pre-trade verdict becomes CAUTION rather than silently assuming the market is clear.
          </div>
        </section>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={resetDefaults} disabled={saving}>RESTORE DEFAULTS</button>
        <button type="button" className={styles.primary} onClick={() => void save()} disabled={saving || loading}>{saving ? "SAVING…" : "SAVE GUARDRAILS"}</button>
      </div>
    </main>
  );
}
