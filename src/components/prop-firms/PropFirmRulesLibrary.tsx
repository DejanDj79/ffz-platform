"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import type { PropFirmRulePreset } from "@/lib/prop-firms";
import {
  createCustomRulePresetViaApi,
  deleteCustomRulePresetViaApi,
  fetchCustomRulePresets,
} from "@/lib/prop-firms/custom-api-client";
import type { CustomRulePreset, CustomRuleVariant } from "@/lib/prop-firms/custom-types";
import { CustomPresetEditor } from "./CustomPresetEditor";
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

function CustomPresetCard({
  preset,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  preset: CustomRulePreset;
  onEdit: (preset: CustomRulePreset) => void;
  onUpdated: (preset: CustomRulePreset) => void;
  onDeleted: (presetId: string) => void;
}) {
  const ordered = useMemo(
    () => [...preset.variants].sort((a, b) => a.accountSize - b.accountSize),
    [preset.variants],
  );
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const variant = ordered.find((item) => item.id === selectedId) ?? ordered[0];
  const [busy, setBusy] = useState(false);

  if (!variant) return null;

  async function duplicateCard() {
    setBusy(true);
    try {
      const variants: CustomRuleVariant[] = preset.variants.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }));
      onUpdated(await createCustomRulePresetViaApi({
        name: `${preset.name} Copy`,
        propFirm: preset.propFirm,
        variants,
      }));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCard() {
    if (!window.confirm(`Delete custom preset "${preset.name}"?`)) return;
    setBusy(true);
    try {
      await deleteCustomRulePresetViaApi(preset.id);
      onDeleted(preset.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${styles.card} ${styles.customCard}`}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.customEyebrow}>MY CUSTOM PRESET</span>
          <h2>{preset.name}</h2>
          <p>{preset.propFirm}</p>
        </div>
        <span className={styles.customBadge}>Editable</span>
      </header>

      <div className={styles.sizeTabs} aria-label={`${preset.name} account size`}>
        {ordered.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.sizeTab} ${item.id === variant.id ? styles.sizeTabActive : ""}`}
            onClick={() => setSelectedId(item.id)}
          >
            {sizeLabel(item.accountSize)}
          </button>
        ))}
      </div>

      <div className={styles.selectedPlan}>
        <span>SELECTED PLAN</span>
        <strong>{variant.label}</strong>
      </div>

      <div className={styles.quickRules}>
        <Rule label="Profit target" value={moneyValue(variant.profitTarget)} />
        <Rule label="Max drawdown" value={moneyValue(variant.maxDrawdown)} />
        <Rule label="Daily loss" value={moneyValue(variant.dailyLossLimit)} />
        <Rule label="Max minis" value={value(variant.maxMinis)} />
        <Rule label="Max micros" value={value(variant.maxMicros)} />
        <Rule label="Evaluation fee" value={moneyValue(variant.evaluationFee)} />
      </div>

      <details className={styles.details} key={variant.id}>
        <summary>ALL RULES</summary>
        <div className={styles.detailsGrid}>
          <Rule label="Drawdown mode" value={variant.drawdownMode.replaceAll("_", " ")} />
          <Rule label="Daily loss breach" value={variant.dailyLossBreachType} />
          <Rule label="Minimum days" value={String(variant.minimumTradingDays)} />
          <Rule label="Starting balance" value={moneyValue(variant.startingBalance)} />
          <Rule label="Drawdown lock offset" value={moneyValue(variant.drawdownLockFloorOffset)} />
          <Rule label="Reset fee" value={moneyValue(variant.resetFee)} />
        </div>
        <p className={styles.notice}>Use EDIT to change any rule or add/remove account sizes on this card.</p>
      </details>

      <footer className={styles.cardFooter}>
        <Link className={styles.primary} href="/challenges">USE IN CHALLENGE SETUP</Link>
        <button className={styles.actionButton} type="button" disabled={busy} onClick={() => onEdit(preset)}>EDIT</button>
        <button className={styles.actionButton} type="button" disabled={busy} onClick={() => void duplicateCard()}>DUPLICATE</button>
        <button className={`${styles.actionButton} ${styles.dangerButton}`} type="button" disabled={busy} onClick={() => void deleteCard()}>DELETE</button>
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
  const [customPresets, setCustomPresets] = useState<CustomRulePreset[]>([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [customError, setCustomError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CustomRulePreset | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomRulePresets()
      .then((items) => {
        if (!cancelled) setCustomPresets(items);
      })
      .catch((error) => {
        console.error("Unable to load custom presets:", error);
        if (!cancelled) setCustomError("Custom presets are unavailable until the database migration is applied.");
      })
      .finally(() => {
        if (!cancelled) setCustomLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function replaceCustom(updated: CustomRulePreset) {
    setCustomPresets((items) => {
      const exists = items.some((item) => item.id === updated.id);
      return exists
        ? items.map((item) => item.id === updated.id ? updated : item)
        : [updated, ...items];
    });
  }

  function openCreateEditor() {
    setEditingPreset(null);
    setEditorOpen(true);
  }

  function openEditEditor(preset: CustomRulePreset) {
    setEditingPreset(preset);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingPreset(null);
  }

  function handleEditorSaved(saved: CustomRulePreset) {
    replaceCustom(saved);
    closeEditor();
  }

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>PROP FIRM RULE ENGINE</span>
          <h1>Rules Library</h1>
          <p>
            Use verified built-in presets or create your own reusable rule cards here. One custom card can contain multiple account sizes, and Challenge Setup only selects the preset you want to use.
          </p>
        </div>
        <div className={styles.introActions}>
          <button className={styles.primary} type="button" onClick={openCreateEditor}>CREATE CUSTOM PRESET</button>
          <Link className={styles.secondary} href="/challenges">OPEN CHALLENGES</Link>
        </div>
      </section>

      {editorOpen ? (
        <CustomPresetEditor
          key={editingPreset?.id ?? "new-custom-preset"}
          initialPreset={editingPreset}
          onSaved={handleEditorSaved}
          onCancel={closeEditor}
        />
      ) : (
        <section className={styles.manualCard}>
          <div>
            <span className={styles.customEyebrow}>CUSTOM PRESET BUILDER</span>
            <h2>Create the whole rule card in one place</h2>
            <p>
              Add the firm and preset name, enter rules for the first account size, then use + ADD SIZE for 25K / 50K / 100K or any other variants before saving the card.
            </p>
          </div>
          <button className={styles.primary} type="button" onClick={openCreateEditor}>CREATE CUSTOM PRESET</button>
        </section>
      )}

      <div className={styles.listHeader}>
        <div>
          <span className={styles.eyebrow}>BUILT-IN PRESETS</span>
          <h2>{firms.length} prop firm{firms.length === 1 ? "" : "s"} · {PROP_FIRM_PRESETS.length} verified plans</h2>
        </div>
        <p>Choose an account size inside each firm card to switch the displayed rules.</p>
      </div>

      <section className={styles.cards}>
        {firms.map((presets) => (
          <FirmCard key={presets[0].propFirm} presets={presets} />
        ))}
      </section>

      <div className={styles.listHeader}>
        <div>
          <span className={styles.customEyebrow}>MY CUSTOM PRESETS</span>
          <h2>{customPresets.length} custom card{customPresets.length === 1 ? "" : "s"}</h2>
        </div>
        <button className={styles.actionButton} type="button" onClick={openCreateEditor}>+ CREATE PRESET</button>
      </div>

      {customLoading ? (
        <div className={styles.customEmpty}>Loading custom presets...</div>
      ) : customError ? (
        <div className={styles.customEmpty}>{customError}</div>
      ) : customPresets.length ? (
        <section className={styles.cards}>
          {customPresets.map((preset) => (
            <CustomPresetCard
              key={preset.id}
              preset={preset}
              onEdit={openEditEditor}
              onUpdated={replaceCustom}
              onDeleted={(id) => setCustomPresets((items) => items.filter((item) => item.id !== id))}
            />
          ))}
        </section>
      ) : (
        <div className={styles.customEmpty}>No custom presets yet. Use CREATE CUSTOM PRESET to build your first reusable card.</div>
      )}
    </main>
  );
}
