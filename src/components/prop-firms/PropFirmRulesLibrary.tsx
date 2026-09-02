"use client";

import Link from "next/link";
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

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rule}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PresetCard({ preset }: { preset: PropFirmRulePreset }) {
  const billing = preset.evaluationBillingMode === "MONTHLY"
    ? "Monthly"
    : preset.evaluationBillingMode === "ONE_TIME"
      ? "One-time"
      : "—";

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>BUILT-IN PRESET</span>
          <h2>{preset.propFirm}</h2>
          <p>{preset.program} · {money.format(preset.accountSize)}</p>
        </div>
        <span className={styles.verified}>Verified {preset.verifiedAt}</span>
      </header>

      <div className={styles.quickRules}>
        <Rule label="Profit target" value={moneyValue(preset.profitTarget)} />
        <Rule label="Max drawdown" value={moneyValue(preset.maxDrawdown)} />
        <Rule label="Daily loss" value={moneyValue(preset.dailyLossLimit)} />
        <Rule label="Max minis" value={value(preset.maxMinis)} />
        <Rule label="Max micros" value={value(preset.maxMicros)} />
        <Rule label="Evaluation fee" value={moneyValue(preset.evaluationFee)} />
      </div>

      <details className={styles.details}>
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
          <h2>{PROP_FIRM_PRESETS.length} verified preset{PROP_FIRM_PRESETS.length === 1 ? "" : "s"}</h2>
        </div>
        <p>Preset values are copied into the challenge and remain editable.</p>
      </div>

      <section className={styles.cards}>
        {PROP_FIRM_PRESETS.map((preset) => (
          <PresetCard key={preset.id} preset={preset} />
        ))}
      </section>
    </main>
  );
}
