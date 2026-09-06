"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Challenge } from "@/lib/challenges/types";
import { applyPresetToChallenge } from "@/lib/challenges/defaults";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import type { PropFirmRulePreset } from "@/lib/prop-firms";
import {
  createCustomRulePresetViaApi,
  deleteCustomRulePresetViaApi,
  fetchCustomRulePresets,
} from "@/lib/prop-firms/custom-api-client";
import {
  applyCustomVariantToChallenge,
  customPresetRef,
  parseCustomPresetRef,
} from "@/lib/prop-firms/custom-types";
import type { CustomRulePreset, CustomRuleVariant } from "@/lib/prop-firms/custom-types";
import type { UserPlan } from "@/lib/monetization/types";
import { CustomPresetEditor } from "./CustomPresetEditor";
import styles from "./RulePresetControl.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function moneyValue(value: number | null | undefined) {
  return value == null ? "—" : money.format(value);
}

function value(value: string | number | null | undefined, suffix = "") {
  return value == null || value === "" ? "—" : `${value}${suffix}`;
}

function sizeLabel(accountSize: number) {
  return accountSize >= 1000 && accountSize % 1000 === 0
    ? `${accountSize / 1000}K`
    : money.format(accountSize);
}

function RuleGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className={styles.ruleGrid}>
      {items.map(([label, ruleValue]) => (
        <div className={styles.ruleItem} key={label}>
          <span>{label}</span>
          <strong>{ruleValue}</strong>
        </div>
      ))}
    </div>
  );
}

function builtInRules(preset: PropFirmRulePreset): Array<[string, string]> {
  const billing = preset.evaluationBillingMode === "MONTHLY"
    ? "Monthly"
    : preset.evaluationBillingMode === "ONE_TIME"
      ? "One-time"
      : "—";

  return [
    ["Account size", moneyValue(preset.accountSize)],
    ["Profit target", moneyValue(preset.profitTarget)],
    ["Max drawdown", moneyValue(preset.maxDrawdown)],
    ["Drawdown mode", preset.drawdownMode.replaceAll("_", " ")],
    ["Daily loss", moneyValue(preset.dailyLossLimit)],
    ["Minimum days", String(preset.minimumTradingDays)],
    ["Max minis", value(preset.maxMinis)],
    ["Max micros", value(preset.maxMicros)],
    ["Evaluation consistency", value(preset.evaluationConsistencyPct, "%")],
    ["Funded consistency", value(preset.fundedConsistencyPct, "%")],
    ["Profit split", value(preset.profitSplitPct, "%")],
    ["Funded buffer", moneyValue(preset.fundedBuffer)],
    ["First payout cap", moneyValue(preset.firstPayoutCap)],
    ["Later payout cap", moneyValue(preset.laterPayoutCap)],
    ["Evaluation fee", moneyValue(preset.evaluationFee)],
    ["Reset fee", moneyValue(preset.resetFee)],
    ["Activation fee", moneyValue(preset.activationFee)],
    ["Monthly fee", moneyValue(preset.monthlyFee)],
    ["Reactivation fee", moneyValue(preset.reactivationFee)],
    ["Evaluation billing", billing],
    ["News trading", preset.newsTradingAllowed ? "Allowed" : "Not allowed"],
  ];
}

function customRules(variant: CustomRuleVariant): Array<[string, string]> {
  return [
    ["Account size", moneyValue(variant.accountSize)],
    ["Starting balance", moneyValue(variant.startingBalance)],
    ["Profit target", moneyValue(variant.profitTarget)],
    ["Max drawdown", moneyValue(variant.maxDrawdown)],
    ["Drawdown mode", variant.drawdownMode.replaceAll("_", " ")],
    ["Drawdown lock offset", moneyValue(variant.drawdownLockFloorOffset)],
    ["Daily loss", moneyValue(variant.dailyLossLimit)],
    ["Daily loss breach", variant.dailyLossBreachType],
    ["Minimum days", String(variant.minimumTradingDays)],
    ["Max minis", value(variant.maxMinis)],
    ["Max micros", value(variant.maxMicros)],
    ["Evaluation fee", moneyValue(variant.evaluationFee)],
    ["Reset fee", moneyValue(variant.resetFee)],
  ];
}

export function RulePresetControl({
  challenge,
  onChange,
}: {
  challenge: Challenge;
  onChange: (challenge: Challenge) => void;
}) {
  const [customPresets, setCustomPresets] = useState<CustomRulePreset[]>([]);
  const [plan, setPlan] = useState<UserPlan>("FREE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingPreset, setEditingPreset] = useState<CustomRulePreset | null>(null);
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchCustomRulePresets(),
      fetch("/api/auth/me", { cache: "no-store" })
        .then(async (response) => response.ok
          ? (await response.json() as { data: { plan: UserPlan } }).data.plan
          : "FREE" as UserPlan),
    ])
      .then(([items, currentPlan]) => {
        if (cancelled) return;
        setCustomPresets(items);
        setPlan(currentPlan);
      })
      .catch((loadError) => {
        console.error("Unable to load custom rule presets:", loadError);
        if (!cancelled) setError("Custom presets are currently unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewOpen && !managerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setViewOpen(false);
      setManagerOpen(false);
      setEditorMode(null);
      setEditingPreset(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [managerOpen, viewOpen]);

  const customAllowed = plan === "PRO";
  const selectedBuiltIn = useMemo(
    () => PROP_FIRM_PRESETS.find((preset) => preset.id === challenge.rulesPresetId) ?? null,
    [challenge.rulesPresetId],
  );
  const selectedCustomRef = useMemo(
    () => parseCustomPresetRef(challenge.rulesPresetId),
    [challenge.rulesPresetId],
  );
  const selectedCustomPreset = selectedCustomRef
    ? customPresets.find((preset) => preset.id === selectedCustomRef.presetId) ?? null
    : null;
  const selectedCustomVariant = selectedCustomRef
    ? selectedCustomPreset?.variants.find((variant) => variant.id === selectedCustomRef.variantId) ?? null
    : null;
  const canViewRules = Boolean(selectedBuiltIn || selectedCustomVariant);

  function selectPreset(selectedValue: string) {
    setError(null);

    if (selectedValue === "CUSTOM") {
      onChange({ ...challenge, rulesPresetId: "CUSTOM" });
      return;
    }

    const customRef = parseCustomPresetRef(selectedValue);
    if (customRef) {
      if (!customAllowed) {
        setError("Reusable custom presets require FFZ Pro. Manual values remain available on Free.");
        return;
      }

      const preset = customPresets.find((item) => item.id === customRef.presetId);
      const variant = preset?.variants.find((item) => item.id === customRef.variantId);
      if (preset && variant) onChange(applyCustomVariantToChallenge(challenge, preset, variant));
      return;
    }

    onChange(applyPresetToChallenge(challenge, selectedValue));
  }

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
    setEditorMode("create");
  }

  function openEditEditor(preset: CustomRulePreset) {
    setEditingPreset(preset);
    setEditorMode("edit");
  }

  function handleEditorSaved(saved: CustomRulePreset) {
    replaceCustom(saved);
    setEditorMode(null);
    setEditingPreset(null);
  }

  async function duplicatePreset(preset: CustomRulePreset) {
    setBusyPresetId(preset.id);
    try {
      const variants = preset.variants.map((variant) => ({
        ...variant,
        id: crypto.randomUUID(),
      }));
      const saved = await createCustomRulePresetViaApi({
        name: `${preset.name} Copy`,
        propFirm: preset.propFirm,
        variants,
      });
      replaceCustom(saved);
    } catch (duplicateError) {
      console.error("Unable to duplicate custom preset:", duplicateError);
      setError("Unable to duplicate the custom preset.");
    } finally {
      setBusyPresetId(null);
    }
  }

  async function deletePreset(preset: CustomRulePreset) {
    if (!window.confirm(`Delete custom preset \"${preset.name}\"?`)) return;
    setBusyPresetId(preset.id);
    try {
      await deleteCustomRulePresetViaApi(preset.id);
      setCustomPresets((items) => items.filter((item) => item.id !== preset.id));
      if (selectedCustomRef?.presetId === preset.id) {
        onChange({ ...challenge, rulesPresetId: "CUSTOM" });
      }
    } catch (deleteError) {
      console.error("Unable to delete custom preset:", deleteError);
      setError("Unable to delete the custom preset.");
    } finally {
      setBusyPresetId(null);
    }
  }

  const viewTitle = selectedBuiltIn
    ? `${selectedBuiltIn.propFirm} · ${sizeLabel(selectedBuiltIn.accountSize)}`
    : selectedCustomPreset && selectedCustomVariant
      ? `${selectedCustomPreset.name} · ${selectedCustomVariant.label}`
      : "Manual rules";
  const viewSubtitle = selectedBuiltIn
    ? `${selectedBuiltIn.program} · Verified ${selectedBuiltIn.verifiedAt}`
    : selectedCustomPreset
      ? `${selectedCustomPreset.propFirm} · My custom preset`
      : "This account is using manually entered values.";
  const viewRules = selectedBuiltIn
    ? builtInRules(selectedBuiltIn)
    : selectedCustomVariant
      ? customRules(selectedCustomVariant)
      : [];

  return (
    <div className={styles.wrap}>
      <select
        value={challenge.rulesPresetId ?? "CUSTOM"}
        onChange={(event) => selectPreset(event.target.value)}
      >
        <option value="CUSTOM">Custom / Manual</option>
        <optgroup label="Built-in Presets">
          {PROP_FIRM_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label}</option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label={customAllowed ? "My Custom Presets" : "My Custom Presets — FFZ Pro"}>
            {customPresets.flatMap((preset) =>
              [...preset.variants]
                .sort((a, b) => a.accountSize - b.accountSize)
                .map((variant) => (
                  <option
                    key={`${preset.id}-${variant.id}`}
                    value={customPresetRef(preset.id, variant.id)}
                    disabled={!customAllowed}
                  >
                    {preset.name} — {variant.label}{customAllowed ? "" : " · PRO"}
                  </option>
                )),
            )}
          </optgroup>
        )}
      </select>

      <div className={styles.actions}>
        <button
          className={styles.toolButton}
          type="button"
          disabled={!canViewRules}
          onClick={() => setViewOpen(true)}
          title={canViewRules ? "View every rule in the selected preset" : "Choose a preset to view its rules"}
        >
          VIEW RULES
        </button>
        <button className={styles.toolButton} type="button" onClick={() => setManagerOpen(true)}>
          MANAGE PRESETS
        </button>
      </div>

      {loading && <span className={styles.message}>Loading rule presets...</span>}
      {!loading && !customAllowed && customPresets.length > 0 && (
        <span className={styles.message}>Custom presets are read-only on Free. <Link href="/upgrade">View Pro</Link></span>
      )}
      {error && <span className={`${styles.message} ${styles.error}`}>{error}</span>}

      {viewOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setViewOpen(false)}>
          <section
            className={`${styles.modal} ${styles.rulesModal}`}
            role="dialog"
            aria-modal="true"
            aria-label="Preset rules"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <span>SELECTED RULE PRESET</span>
                <h2>{viewTitle}</h2>
                <p>{viewSubtitle}</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setViewOpen(false)} aria-label="Close rules">×</button>
            </header>
            <div className={styles.modalBody}>
              <RuleGrid items={viewRules} />
              {selectedBuiltIn?.reviewNote && <p className={styles.reviewNote}>{selectedBuiltIn.reviewNote}</p>}
            </div>
            <footer className={styles.modalFooter}>
              {selectedBuiltIn && (
                <a className={styles.sourceButton} href={selectedBuiltIn.sourceUrl} target="_blank" rel="noreferrer">SOURCE</a>
              )}
              <button className={styles.doneButton} type="button" onClick={() => setViewOpen(false)}>DONE</button>
            </footer>
          </section>
        </div>
      )}

      {managerOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => {
          setManagerOpen(false);
          setEditorMode(null);
          setEditingPreset(null);
        }}>
          <section
            className={`${styles.modal} ${styles.managerModal}`}
            role="dialog"
            aria-modal="true"
            aria-label="Manage custom rule presets"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <span>ACCOUNT RULE PRESETS</span>
                <h2>Manage Presets</h2>
                <p>Create reusable custom rule cards here, then select any account-size variant directly from Account Setup.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => {
                setManagerOpen(false);
                setEditorMode(null);
                setEditingPreset(null);
              }} aria-label="Close preset manager">×</button>
            </header>

            <div className={styles.modalBody}>
              {editorMode ? (
                <CustomPresetEditor
                  key={editorMode === "edit" ? editingPreset?.id : "new-custom-preset"}
                  initialPreset={editorMode === "edit" ? editingPreset : null}
                  onSaved={handleEditorSaved}
                  onCancel={() => {
                    setEditorMode(null);
                    setEditingPreset(null);
                  }}
                />
              ) : customAllowed ? (
                <>
                  <div className={styles.managerToolbar}>
                    <div>
                      <strong>MY CUSTOM PRESETS</strong>
                      <span>{customPresets.length} saved preset{customPresets.length === 1 ? "" : "s"}</span>
                    </div>
                    <button className={styles.createButton} type="button" onClick={openCreateEditor}>+ CREATE PRESET</button>
                  </div>

                  {customPresets.length ? (
                    <div className={styles.presetList}>
                      {customPresets.map((preset) => (
                        <article className={styles.presetRow} key={preset.id}>
                          <div className={styles.presetIdentity}>
                            <strong>{preset.name}</strong>
                            <span>{preset.propFirm}</span>
                            <small>{[...preset.variants].sort((a, b) => a.accountSize - b.accountSize).map((variant) => variant.label).join(" · ")}</small>
                          </div>
                          <div className={styles.presetActions}>
                            <button type="button" disabled={busyPresetId === preset.id} onClick={() => openEditEditor(preset)}>EDIT</button>
                            <button type="button" disabled={busyPresetId === preset.id} onClick={() => void duplicatePreset(preset)}>DUPLICATE</button>
                            <button className={styles.deleteButton} type="button" disabled={busyPresetId === preset.id} onClick={() => void deletePreset(preset)}>DELETE</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyManager}>
                      <strong>No custom presets yet</strong>
                      <span>Create one reusable card and add as many account-size variants as you need.</span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.proGate}>
                  <span>FFZ PRO</span>
                  <h3>Reusable custom rule presets</h3>
                  <p>Built-in presets and manual account rules remain available on Free. Creating, editing and reusing your own preset cards is a Pro workflow.</p>
                  {customPresets.length > 0 && (
                    <div className={styles.readOnlyPresets}>
                      {customPresets.map((preset) => (
                        <div key={preset.id}>
                          <strong>{preset.name}</strong>
                          <span>{preset.propFirm} · {preset.variants.map((variant) => variant.label).join(" · ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link className={styles.upgradeButton} href="/upgrade">VIEW PRO</Link>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
