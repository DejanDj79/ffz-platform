"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCustomRulePresetViaApi,
  updateCustomRulePresetViaApi,
} from "@/lib/prop-firms/custom-api-client";
import type {
  CustomRulePreset,
  CustomRuleVariant,
} from "@/lib/prop-firms/custom-types";
import type { BreachType, DrawdownMode } from "@/lib/prop-firms";
import styles from "./PropFirmRulesLibrary.module.css";

function sizeLabel(accountSize: number) {
  if (accountSize > 0 && accountSize >= 1000 && accountSize % 1000 === 0) {
    return `${accountSize / 1000}K`;
  }
  return accountSize > 0 ? String(accountSize) : "New size";
}

function newVariant(): CustomRuleVariant {
  return {
    id: crypto.randomUUID(),
    label: "50K",
    accountSize: 50_000,
    startingBalance: 50_000,
    profitTarget: 3_000,
    maxDrawdown: 2_000,
    drawdownMode: "STATIC",
    drawdownLockFloorOffset: 0,
    dailyLossLimit: null,
    dailyLossBreachType: "NONE",
    minimumTradingDays: 0,
    maxMinis: null,
    maxMicros: null,
    evaluationFee: 0,
    resetFee: null,
  };
}

function cloneVariantForNewSize(source: CustomRuleVariant): CustomRuleVariant {
  return {
    ...source,
    id: crypto.randomUUID(),
    label: "New size",
    accountSize: 0,
    startingBalance: 0,
  };
}

function numberFromInput(raw: string) {
  if (raw.trim() === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function nullableNumberFromInput(raw: string) {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function nullableIntFromInput(raw: string) {
  const value = nullableNumberFromInput(raw);
  return value == null ? null : Math.max(1, Math.floor(value));
}

export function CustomPresetEditor({
  initialPreset,
  onSaved,
  onCancel,
}: {
  initialPreset?: CustomRulePreset | null;
  onSaved: (preset: CustomRulePreset) => void;
  onCancel: () => void;
}) {
  const initialVariants = useMemo(
    () => initialPreset?.variants.map((variant) => ({ ...variant })) ?? [newVariant()],
    [initialPreset],
  );
  const [name, setName] = useState(initialPreset?.name ?? "");
  const [propFirm, setPropFirm] = useState(initialPreset?.propFirm ?? "");
  const [variants, setVariants] = useState<CustomRuleVariant[]>(initialVariants);
  const [selectedId, setSelectedId] = useState(initialVariants[0].id);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  useEffect(() => {
    requestAnimationFrame(() => {
      document.getElementById("custom-preset-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  function updateSelected(patch: Partial<CustomRuleVariant>) {
    if (!selected) return;
    setVariants((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function updateAccountSize(raw: string) {
    if (!selected) return;
    const nextSize = numberFromInput(raw);
    const shouldSyncStartingBalance = selected.startingBalance === selected.accountSize || selected.startingBalance === 0;
    updateSelected({
      accountSize: nextSize,
      label: sizeLabel(nextSize),
      ...(shouldSyncStartingBalance ? { startingBalance: nextSize } : {}),
    });
  }

  function addSize() {
    if (!selected) return;
    const next = cloneVariantForNewSize(selected);
    setVariants((items) => [...items, next]);
    setSelectedId(next.id);
    setMessage(null);
  }

  function removeSize() {
    if (!selected || variants.length <= 1) return;
    const remaining = variants.filter((variant) => variant.id !== selected.id);
    setVariants(remaining);
    setSelectedId(remaining[0].id);
    setMessage(null);
  }

  async function save() {
    setMessage(null);

    if (!name.trim() || !propFirm.trim()) {
      setMessage("Enter both a preset name and prop firm.");
      return;
    }

    if (variants.some((variant) => variant.accountSize <= 0 || variant.startingBalance <= 0)) {
      setMessage("Every size needs an Account Size and Starting Balance greater than zero.");
      return;
    }

    const sizes = variants.map((variant) => variant.accountSize);
    if (new Set(sizes).size !== sizes.length) {
      setMessage("Each account size can appear only once inside a custom preset.");
      return;
    }

    setSaving(true);
    try {
      const normalizedVariants = variants
        .map((variant) => ({ ...variant, label: sizeLabel(variant.accountSize) }))
        .sort((a, b) => a.accountSize - b.accountSize);
      const input = {
        name: name.trim(),
        propFirm: propFirm.trim(),
        variants: normalizedVariants,
      };
      const saved = initialPreset
        ? await updateCustomRulePresetViaApi(initialPreset.id, input)
        : await createCustomRulePresetViaApi(input);
      onSaved(saved);
    } catch (error) {
      console.error("Unable to save custom preset:", error);
      setMessage("Unable to save the custom preset.");
    } finally {
      setSaving(false);
    }
  }

  if (!selected) return null;

  return (
    <div
      id="custom-preset-editor"
      className={styles.editor}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.customEyebrow}>{initialPreset ? "EDIT CUSTOM PRESET" : "CREATE CUSTOM PRESET"}</span>
          <h2>{initialPreset ? initialPreset.name : "Build a reusable rules card"}</h2>
          <p>Add every account size here. Each size becomes a button on one card in My Custom Presets.</p>
        </div>
        <button className={styles.secondary} type="button" onClick={onCancel}>CANCEL</button>
      </div>

      <div className={styles.editorIdentity}>
        <label>
          <span>Preset Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Apex Legacy" />
        </label>
        <label>
          <span>Prop Firm</span>
          <input value={propFirm} onChange={(event) => setPropFirm(event.target.value)} placeholder="e.g. Apex Trader Funding" />
        </label>
      </div>

      <div className={styles.editorSizeBar}>
        <div className={styles.sizeTabs} aria-label="Custom preset account sizes">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className={`${styles.sizeTab} ${variant.id === selected.id ? styles.sizeTabActive : ""}`}
              onClick={() => setSelectedId(variant.id)}
            >
              {sizeLabel(variant.accountSize)}
            </button>
          ))}
        </div>
        <div className={styles.editorSizeActions}>
          <button className={styles.actionButton} type="button" onClick={addSize}>+ ADD SIZE</button>
          <button className={`${styles.actionButton} ${styles.dangerButton}`} type="button" disabled={variants.length <= 1} onClick={removeSize}>REMOVE SIZE</button>
        </div>
      </div>

      <div className={styles.editorSelectedTitle}>
        <span>EDITING SIZE</span>
        <strong>{sizeLabel(selected.accountSize)}</strong>
      </div>

      <div className={styles.editorGrid}>
        <label><span>Account Size</span><input type="number" min="0" step="1" value={selected.accountSize || ""} onChange={(event) => updateAccountSize(event.target.value)} /></label>
        <label><span>Starting Balance</span><input type="number" min="0" step="1" value={selected.startingBalance || ""} onChange={(event) => updateSelected({ startingBalance: numberFromInput(event.target.value) })} /></label>
        <label><span>Profit Target</span><input type="number" min="0" step="1" value={selected.profitTarget || ""} onChange={(event) => updateSelected({ profitTarget: numberFromInput(event.target.value) })} /></label>
        <label><span>Max Drawdown</span><input type="number" min="0" step="1" value={selected.maxDrawdown || ""} onChange={(event) => updateSelected({ maxDrawdown: numberFromInput(event.target.value) })} /></label>
        <label>
          <span>Drawdown Mode</span>
          <select value={selected.drawdownMode} onChange={(event) => updateSelected({ drawdownMode: event.target.value as DrawdownMode })}>
            <option value="STATIC">Static</option>
            <option value="EOD_TRAILING">EOD Trailing</option>
            <option value="INTRADAY_TRAILING">Intraday Trailing</option>
          </select>
        </label>
        <label><span>Drawdown Lock Offset</span><input type="number" step="1" value={selected.drawdownLockFloorOffset} onChange={(event) => updateSelected({ drawdownLockFloorOffset: Number(event.target.value) || 0 })} /></label>
        <label><span>Daily Loss Limit</span><input type="number" min="0" step="1" value={selected.dailyLossLimit ?? ""} placeholder="No limit" onChange={(event) => updateSelected({ dailyLossLimit: nullableNumberFromInput(event.target.value) })} /></label>
        <label>
          <span>Daily Loss Breach</span>
          <select value={selected.dailyLossBreachType} onChange={(event) => updateSelected({ dailyLossBreachType: event.target.value as BreachType })}>
            <option value="NONE">None</option>
            <option value="SOFT">Soft</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
        <label><span>Minimum Trading Days</span><input type="number" min="0" step="1" value={selected.minimumTradingDays || ""} onChange={(event) => updateSelected({ minimumTradingDays: Math.floor(numberFromInput(event.target.value)) })} /></label>
        <label><span>Max Minis</span><input type="number" min="1" step="1" value={selected.maxMinis ?? ""} placeholder="No limit" onChange={(event) => updateSelected({ maxMinis: nullableIntFromInput(event.target.value) })} /></label>
        <label><span>Max Micros</span><input type="number" min="1" step="1" value={selected.maxMicros ?? ""} placeholder="No limit" onChange={(event) => updateSelected({ maxMicros: nullableIntFromInput(event.target.value) })} /></label>
        <label><span>Evaluation Fee</span><input type="number" min="0" step="0.01" value={selected.evaluationFee || ""} onChange={(event) => updateSelected({ evaluationFee: numberFromInput(event.target.value) })} /></label>
        <label><span>Reset Fee</span><input type="number" min="0" step="0.01" value={selected.resetFee ?? ""} placeholder="None" onChange={(event) => updateSelected({ resetFee: nullableNumberFromInput(event.target.value) })} /></label>
      </div>

      {message && <div className={styles.editorMessage}>{message}</div>}

      <div className={styles.editorFooter}>
        <span>{variants.length} size{variants.length === 1 ? "" : "s"} in this card</span>
        <button className={styles.primary} type="button" disabled={saving} onClick={() => void save()}>{saving ? "SAVING..." : "SAVE PRESET"}</button>
      </div>
    </div>
  );
}
