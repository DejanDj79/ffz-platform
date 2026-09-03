"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import type { PropFirmRulePreset } from "@/lib/prop-firms";
import { fetchCustomRulePresets } from "@/lib/prop-firms/custom-api-client";
import type { CustomRulePreset } from "@/lib/prop-firms/custom-types";
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
        <Link className={styles.primary} href="/challenges">SELECT IN CHALLENGE SETUP</Link>
        <a className={styles.secondary} href={preset.sourceUrl} target="_blank" rel="noreferrer">SOURCE</a>
      </footer>
    </article>
  );
}

function ReadOnlyCustomCard({ preset }: { preset: CustomRulePreset }) {
  const ordered = useMemo(
    () => [...preset.variants].sort((a, b) => a.accountSize - b.accountSize),
    [preset.variants],
  );
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const variant = ordered.find((item) => item.id === selectedId) ?? ordered[0];
  if (!variant) return null;

  return (
    <article className={`${styles.card} ${styles.customCard}`}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.customEyebrow}>MY CUSTOM PRESET · READ ONLY</span>
          <h2>{preset.name}</h2>
          <p>{preset.propFirm}</p>
        </div>
        <span className={styles.customBadge}>PRO</span>
      </header>

      <div className={styles.sizeTabs}>
        {ordered.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.sizeTab} ${item.id === variant.id ? styles.sizeTabActive : ""}`}
            onClick={() => setSelectedId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.quickRules}>
        <Rule label="Profit target" value={moneyValue(variant.profitTarget)} />
        <Rule label="Max drawdown" value={moneyValue(variant.maxDrawdown)} />
        <Rule label="Daily loss" value={moneyValue(variant.dailyLossLimit)} />
        <Rule label="Max minis" value={value(variant.maxMinis)} />
        <Rule label="Max micros" value={value(variant.maxMicros)} />
        <Rule label="Evaluation fee" value={moneyValue(variant.evaluationFee)} />
      </div>

      <footer className={styles.cardFooter}>
        <Link className={styles.secondary} href="/upgrade">UPGRADE TO EDIT / REUSE</Link>
      </footer>
    </article>
  );
}

export function FreePropFirmRulesLibrary() {
  const firms = useMemo(() => {
    const grouped = new Map<string, PropFirmRulePreset[]>();
    for (const preset of PROP_FIRM_PRESETS) {
      const current = grouped.get(preset.propFirm) ?? [];
      current.push(preset);
      grouped.set(preset.propFirm, current);
    }
    return Array.from(grouped.values());
  }, []);
  const [customPresets, setCustomPresets] = useState<CustomRulePreset[]>([]);
  const [customLoading, setCustomLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomRulePresets()
      .then((items) => {
        if (!cancelled) setCustomPresets(items);
      })
      .catch((error) => console.error("Unable to load read-only custom presets:", error))
      .finally(() => {
        if (!cancelled) setCustomLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>PROP FIRM RULE ENGINE</span>
          <h1>Rules Library</h1>
          <p>Verified built-in prop firm rules remain available on FFZ Free. Existing custom cards stay visible after a downgrade, while creating, editing and reusing them is an FFZ Pro workflow.</p>
        </div>
        <div className={styles.introActions}>
          <Link className={styles.secondary} href="/challenges">OPEN CHALLENGES</Link>
        </div>
      </section>

      <ProFeatureGate
        title="Build reusable custom prop firm presets"
        description="Create your own firm rules once, add multiple account sizes, and reuse those presets across future evaluations with FFZ Pro."
        features={["Custom rule cards", "Multiple account-size variants", "Edit and duplicate presets", "Reuse inside Challenge Setup"]}
        compact
      />

      <div className={styles.listHeader}>
        <div>
          <span className={styles.eyebrow}>BUILT-IN PRESETS</span>
          <h2>{firms.length} prop firm{firms.length === 1 ? "" : "s"} · {PROP_FIRM_PRESETS.length} verified plans</h2>
        </div>
        <p>Choose an account size inside each firm card to switch the displayed rules.</p>
      </div>

      <section className={styles.cards}>
        {firms.map((presets) => <FirmCard key={presets[0].propFirm} presets={presets} />)}
      </section>

      {(customLoading || customPresets.length > 0) && (
        <>
          <div className={styles.listHeader}>
            <div>
              <span className={styles.customEyebrow}>MY CUSTOM PRESETS</span>
              <h2>{customLoading ? "Loading saved custom cards…" : `${customPresets.length} saved custom card${customPresets.length === 1 ? "" : "s"}`}</h2>
            </div>
            <p>Visible on Free so your data is never hidden; editing and reuse require Pro.</p>
          </div>
          {!customLoading && customPresets.length > 0 && (
            <section className={styles.cards}>
              {customPresets.map((preset) => <ReadOnlyCustomCard key={preset.id} preset={preset} />)}
            </section>
          )}
        </>
      )}
    </main>
  );
}
