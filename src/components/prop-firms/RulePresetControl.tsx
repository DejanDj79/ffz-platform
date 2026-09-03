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
import type { UserPlan } from "@/lib/monetization/types";
import styles from "./RulePresetControl.module.css";

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

  const customAllowed = plan === "PRO";

  function selectPreset(value: string) {
    setError(null);

    if (value === "CUSTOM") {
      onChange({ ...challenge, rulesPresetId: "CUSTOM" });
      return;
    }

    const customRef = parseCustomPresetRef(value);
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

      {loading && <span className={styles.message}>Loading rule presets...</span>}
      {!loading && !customAllowed && customPresets.length > 0 && (
        <span className={styles.message}>Custom presets are read-only on Free. <a href="/upgrade">View Pro</a></span>
      )}
      {error && <span className={`${styles.message} ${styles.error}`}>{error}</span>}
    </div>
  );
}
