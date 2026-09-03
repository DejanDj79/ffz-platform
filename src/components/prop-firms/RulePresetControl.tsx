"use client";

import { useEffect, useState } from "react";
import type { Challenge } from "@/lib/challenges/types";
import { applyPresetToChallenge } from "@/lib/challenges/defaults";
import { PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import { fetchCustomRulePresets } from "@/lib/prop-firms/custom-api-client";
import {
  applyCustomVariantToChallenge,
  customPresetRef,
  parseCustomPresetRef,
} from "@/lib/prop-firms/custom-types";
import type { CustomRulePreset } from "@/lib/prop-firms/custom-types";
import styles from "./RulePresetControl.module.css";

export function RulePresetControl({
  challenge,
  onChange,
}: {
  challenge: Challenge;
  onChange: (challenge: Challenge) => void;
}) {
  const [customPresets, setCustomPresets] = useState<CustomRulePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomRulePresets()
      .then((items) => {
        if (!cancelled) setCustomPresets(items);
      })
      .catch((loadError) => {
        console.error("Unable to load custom rule presets:", loadError);
        if (!cancelled) setError("Custom presets unavailable until the database update is applied.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function selectPreset(value: string) {
    setError(null);

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

      {loading && <span className={styles.message}>Loading custom presets...</span>}
      {error && <span className={`${styles.message} ${styles.error}`}>{error}</span>}
    </div>
  );
}
