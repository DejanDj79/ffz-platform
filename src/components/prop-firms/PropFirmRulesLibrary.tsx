"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import type { PropFirmRulePreset } from "@/lib/prop-firms";
import styles from "./PropFirmRulesLibrary.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function value(value: number | null | undefined, suffix = "") {
  return value == null ? "—" : `${value}${suffix}`;
}

function moneyValue(value: number | null | undefined) {
  return value == null ? "—" : money.format(value);
}

function sizeLabel(accountSize: number) {
  return accountSize >= 1000 && accountSize % 1000 === 0
    ? `${accountSize / 1000}K`
    : money.format(accountSize);
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rule}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FirmCard({ presets }: { presets: PropFirmRulePreset[] }) {
  const ordered = useMemo(
    () => [...presets].sort((a, b) => a.accountSize - b.accountSize),
    [presets],
  );
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const preset = ordered.find((item) => item.id === selectedId) ?? ordered[0];

  if (!preset) return null;

  const billing = preset.evaluationBillingMode === "MONTHLY"
    ? "Monthly"
    : preset.evaluationBillingMode === "ONE_TIME"
      ? "One-time"
      : "—";

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>BUILT-IN PRESETS</span>
          <h2>{preset.propFirm}</h2>
          <p>{preset.program}</p>
        </div>
        <span className={styles.verified}>Verified {preset.verifiedAt}</span>
      </header>

      <div className={styles.sizeTabs} aria-label={`${preset.propFirm} account size`}>
        {ordered.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.sizeTab} ${item.id === preset.id ? styles.sizeTabActive : ""}`}
            onClick={() => setSelectedId(item.id)}
          >
            {sizeLabel(item.accountSize)}
          </button>
        ))}
      </div>

      <div className={styles.selectedPlan}>
        <span>SELECTED PLAN</span>
        <strong>{sizeLabel(preset.accountSize)}</strong>
      </div>

      <div className={styles.quickRules}>
        <Rule label="Profit target" value={moneyValue(preset.profitTarget)} />
        <Rule label="Max drawdown" value={moneyValue(preset.maxDrawdown)} />
        <Rule label="Daily loss" value={moneyValue(preset.dailyLossLimit)} />
        <Rule label="Max minis" value={value(preset.maxMinis)} />
        <Rule label="Max micros" value={value(preset.maxMicros)} />
        <Rule label="Evaluation fee" value={moneyValue(preset.evaluationFee)} />
      </div>

      <details className={styles.details} key={preset.id}>
        <summary>ALL RULES</summary>
        <div className={styles.detailsGrid}>
          <Rule label="Drawdown mode" value={preset.drawdownMode.replaceAll("_", " ")} />
          <Rule label="Minimum days" value={String(preset.minimumTradingDays)} />
          <Rule label="Evaluation consistency" value={value(preset.evaluationConsistencyPct, "%")} />
          <Rule label="Funded consistency" value={value(preset.fundedConsistencyPct, "%")} />
          <Rule label="Profit split" value={value(preset.profitSplitPct, "%")} />
          <Rule label="First payout cap" value={moneyValue(preset.firstPayoutCap)} />
          <Rule label="Later payout cap" value={moneyValue(preset.laterPayoutCap)} />
          <Rule label="Funded buffer" value={moneyValue(preset.fundedBuffer)} />
          <Rule label="Evaluation billing" value={billing} />
          <Rule label="Reset fee" value={moneyValue(preset.resetFee)} />
          <Rule label="Activation fee" value={moneyValue(preset.activationFee)} />
          <Rule label="Monthly fee" value={moneyValue(preset.monthlyFee)} />
          <Rule label="Reactivation fee" value={moneyValue(preset.reactivationFee)} />
          <Rule label="News trading" value={preset.newsTradingAllowed ? "Allowed" : "Not allowed"} />
        </div>
        {preset.reviewNote && <p className={styles.notice}>{preset.reviewNote}</p>}
      </details>

      <footer className={styles.cardFooter}>
        <Link className={styles.primary} href="/challenges">
          SELECT IN CHALLENGE SETUP
        </Link>
        <a className={styles.secondary} href={preset.sourceUrl} target="_blank" rel="noreferrer">
          SOURCE
        </a>
      </footer>
    </article>
  );
}

export function PropFirmRulesLibrary() {
  const firms = useMemo(() => {
    const grouped = new Map<string, PropFirmRulePreset[]>();
    for (const preset of PROP_FIRM_PRESETS) {
      const current = grouped.get(preset.propFirm) ?? [];
      current.push(preset);
      grouped.set(preset.propFirm, current);
    }
    return Array.from(grouped.values());
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>PROP FIRM RULE ENGINE</span>
          <h1>Rules Library</h1>
          <p>
            Use a verified preset when one exists, or create a fully manual challenge. Every challenge keeps its own editable rule values, so a preset never locks you into outdated rules.
          </p>
        </div>
        <div className={styles.introActions}>
          <Link className={styles.primary} href="/challenges">
            CREATE CUSTOM / MANUAL
          </Link>
          <Link className={styles.secondary} href="/challenges">
            OPEN CHALLENGES
          </Link>
        </div>
      </section>

      <section className={styles.manualCard}>
        <div>
          <span className={styles.eyebrow}>CUSTOM RULES</span>
          <h2>Any prop firm, any account plan</h2>
          <p>
            For a firm or plan that is not in FFZ yet, open Challenge Setup, choose Custom / Manual in Rule Preset, then enter the prop firm, account size, target, drawdown type, daily loss, contract limits, fees and trading-day rules directly on that challenge.
          </p>
        </div>
        <Link className={styles.primary} href="/challenges">
          OPEN MANUAL SETUP
        </Link>
      </section>

      <div className={styles.listHeader}>
        <div>
          <span className={styles.eyebrow}>AVAILABLE PRESETS</span>
          <h2>{firms.length} prop firm{firms.length === 1 ? "" : "s"} · {PROP_FIRM_PRESETS.length} verified plans</h2>
        </div>
        <p>Choose an account size inside each firm card to switch the displayed rules.</p>
      </div>

      <section className={styles.cards}>
        {firms.map((presets) => (
          <FirmCard key={presets[0].propFirm} presets={presets} />
        ))}
      </section>
    </main>
  );
}
