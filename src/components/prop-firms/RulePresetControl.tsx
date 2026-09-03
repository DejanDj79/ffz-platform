"use client";

import { useEffect, useMemo, useState } from "react";
import type { Challenge } from "@/lib/challenges/types";
import { applyPresetToChallenge } from "@/lib/challenges/defaults";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import {
  createCustomRulePresetViaApi,
  fetchCustomRulePresets,
  updateCustomRulePresetViaApi,
} from "@/lib/prop-firms/custom-api-client";
import {
  applyCustomVariantToChallenge,
  challengeToCustomRuleVariant,
  customPresetRef,
  parseCustomPresetRef,
} from "@/lib/prop-firms/custom-types";
import type { CustomRulePreset } from "@/lib/prop-firms/custom-types";
import styles from "./RulePresetControl.module.css";

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function RulePresetControl({
  challenge,
  onChange,
}: {
  challenge: Challenge;
  onChange: (challenge: Challenge) => void;
}) {
  const [customPresets, setCustomPresets] = useState<CustomRulePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomRulePresets()
      .then((items) => {
        if (!cancelled) setCustomPresets(items);
      })
      .catch((error) => {
        console.error("Unable to load custom rule presets:", error);
        if (!cancelled) setMessage({ kind: "error", text: "Custom presets unavailable until the database migration is applied." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCustom = useMemo(() => {
    const ref = parseCustomPresetRef(challenge.rulesPresetId);
    if (!ref) return null;
    const preset = customPresets.find((item) => item.id === ref.presetId);
    const variant = preset?.variants.find((item) => item.id === ref.variantId);
    return preset && variant ? { preset, variant } : null;
  }, [challenge.rulesPresetId, customPresets]);

  function selectPreset(value: string) {
    setMessage(null);

    if (value === "CUSTOM") {
      onChange({ ...challenge, rulesPresetId: "CUSTOM" });
      return;
    }

    const customRef = parseCustomPresetRef(value);
    if (customRef) {
      const preset = customPresets.find((item) => item.id === customRef.presetId);
      const variant = preset?.variants.find((item) => item.id === customRef.variantId);
      if (preset && variant) onChange(applyCustomVariantToChallenge(challenge, preset, variant));
      return;
    }

    onChange(applyPresetToChallenge(challenge, value));
  }

  async function saveAsCustomPreset() {
    const propFirm = challenge.propFirm.trim();
    if (!propFirm) {
      setMessage({ kind: "error", text: "Enter a Prop Firm name before saving a custom preset." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let saved: CustomRulePreset;
      let selectedVariantId: string;

      if (activeCustom) {
        const nextVariant = {
          ...challengeToCustomRuleVariant(challenge),
          id: activeCustom.variant.id,
        };
        const variants = activeCustom.preset.variants.map((variant) =>
          variant.id === nextVariant.id ? nextVariant : variant,
        );
        saved = await updateCustomRulePresetViaApi(activeCustom.preset.id, {
          propFirm,
          variants,
        });
        selectedVariantId = nextVariant.id;
      } else {
        const defaultName = `${propFirm} Custom`;
        const existing = customPresets.find((preset) =>
          sameText(preset.name, defaultName) && sameText(preset.propFirm, propFirm),
        );
        const generated = challengeToCustomRuleVariant(challenge);

        if (existing) {
          const sameSize = existing.variants.find((variant) => variant.accountSize === generated.accountSize);
          const nextVariant = sameSize ? { ...generated, id: sameSize.id } : generated;
          const variants = sameSize
            ? existing.variants.map((variant) => variant.id === sameSize.id ? nextVariant : variant)
            : [...existing.variants, nextVariant];
          saved = await updateCustomRulePresetViaApi(existing.id, { variants, propFirm });
          selectedVariantId = nextVariant.id;
        } else {
          saved = await createCustomRulePresetViaApi({
            name: defaultName,
            propFirm,
            variants: [generated],
          });
          selectedVariantId = generated.id;
        }
      }

      setCustomPresets((items) => {
        const exists = items.some((item) => item.id === saved.id);
        return exists
          ? items.map((item) => item.id === saved.id ? saved : item)
          : [saved, ...items];
      });
      onChange({ ...challenge, rulesPresetId: customPresetRef(saved.id, selectedVariantId) });
      setMessage({ kind: "success", text: activeCustom ? "Custom preset updated." : "Saved to My Custom Presets." });
    } catch (error) {
      console.error("Unable to save custom preset:", error);
      setMessage({ kind: "error", text: "Unable to save the custom preset." });
    } finally {
      setSaving(false);
    }
  }

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
          <optgroup label="My Custom Presets">
            {customPresets.flatMap((preset) =>
              [...preset.variants]
                .sort((a, b) => a.accountSize - b.accountSize)
                .map((variant) => (
                  <option key={`${preset.id}-${variant.id}`} value={customPresetRef(preset.id, variant.id)}>
                    {preset.name} — {variant.label}
                  </option>
                )),
            )}
          </optgroup>
        )}
      </select>

      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          type="button"
          disabled={saving || loading}
          onClick={() => void saveAsCustomPreset()}
        >
          {saving ? "SAVING..." : activeCustom ? "UPDATE CUSTOM PRESET" : "SAVE AS CUSTOM PRESET"}
        </button>
        {loading && <span className={styles.message}>Loading custom presets...</span>}
      </div>

      {message && (
        <span className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
