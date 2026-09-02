"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  fetchScoreboardSettings,
  regenerateScoreboardLink,
  saveScoreboardSettings,
} from "@/lib/scoreboard/api-client";
import type {
  ScoreboardSettingsApiModel,
  ScoreboardVisibility,
} from "@/lib/scoreboard/types";
import styles from "./ScoreboardSettings.module.css";

const VISIBILITY_FIELDS: Array<{
  key: keyof ScoreboardVisibility;
  label: string;
  description: string;
}> = [
  {
    key: "showBalance",
    label: "Current Balance",
    description: "Selected challenge current balance.",
  },
  {
    key: "showChallengePnl",
    label: "Challenge P&L",
    description: "Current balance minus starting balance.",
  },
  {
    key: "showTargetProgress",
    label: "Target Progress",
    description: "Progress toward the challenge profit target.",
  },
  {
    key: "showTradeCount",
    label: "Trade Count",
    description: "Journal trades linked to the selected challenge.",
  },
  {
    key: "showWinRate",
    label: "Win Rate",
    description: "Win rate from closed linked trades.",
  },
  {
    key: "showAverageR",
    label: "Average R",
    description: "Average R multiple from closed linked trades.",
  },
  {
    key: "showRealMoneyNet",
    label: "Real Money Net",
    description: "Journey-wide money received minus money paid.",
  },
  {
    key: "showRealPayouts",
    label: "Real Payouts",
    description: "Total real payouts actually received.",
  },
];

export function ScoreboardSettings() {
  const [settings, setSettings] =
    useState<ScoreboardSettingsApiModel | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [origin, setOrigin] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [nextSettings, nextChallenges] = await Promise.all([
        fetchScoreboardSettings(),
        fetchChallenges(),
      ]);

      setSettings(nextSettings);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Scoreboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  const overlayUrl = useMemo(() => {
    if (!origin || !settings) return "";

    return `${origin}/overlays/scoreboard/${settings.overlayKey}`;
  }, [origin, settings]);

  function patch<K extends keyof ScoreboardSettingsApiModel>(
    key: K,
    value: ScoreboardSettingsApiModel[K],
  ) {
    setSettings((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function save() {
    if (!settings) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const next = await saveScoreboardSettings({
        challengeId: settings.challengeId,
        layout: settings.layout,
        goalLabel: settings.goalLabel,
        refreshSeconds: settings.refreshSeconds,
        isEnabled: settings.isEnabled,

        showBalance: settings.showBalance,
        showChallengePnl: settings.showChallengePnl,
        showTargetProgress: settings.showTargetProgress,
        showTradeCount: settings.showTradeCount,
        showWinRate: settings.showWinRate,
        showAverageR: settings.showAverageR,
        showRealMoneyNet: settings.showRealMoneyNet,
        showRealPayouts: settings.showRealPayouts,
      });

      setSettings(next);
      setPreviewVersion((value) => value + 1);
      setMessage("Scoreboard settings saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save Scoreboard.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyOverlayUrl() {
    if (!overlayUrl) return;

    try {
      await navigator.clipboard.writeText(overlayUrl);
      setMessage("OBS Browser Source URL copied.");
      setError(null);
    } catch {
      setError("Could not copy automatically. Select the URL and copy it manually.");
    }
  }

  async function regenerateLink() {
    const ok = window.confirm(
      "Regenerate the OBS overlay link? The old Browser Source URL will immediately stop working.",
    );

    if (!ok) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const next = await regenerateScoreboardLink();
      setSettings(next);
      setPreviewVersion((value) => value + 1);
      setMessage(
        "New overlay link created. Update the URL in OBS.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to regenerate link.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>
          {error || "Loading Scoreboard settings..."}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.topGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>SCOREBOARD SETTINGS</span>
              <small>
                Configure the data shown in your OBS Browser Source.
              </small>
            </div>

            <label className={styles.enabledToggle}>
              <input
                type="checkbox"
                checked={settings.isEnabled}
                onChange={(event) =>
                  patch("isEnabled", event.target.checked)
                }
              />
              <span>Overlay enabled</span>
            </label>
          </div>

          <div className={styles.form}>
            <label className={styles.fieldWide}>
              <span>Season / Goal Label</span>
              <input
                value={settings.goalLabel}
                onChange={(event) =>
                  patch("goalLabel", event.target.value)
                }
                maxLength={100}
                placeholder="FIRST REAL PAYOUT"
              />
            </label>

            <div className={styles.formGrid}>
              <label>
                <span>Challenge</span>
                <select
                  value={settings.challengeId ?? ""}
                  onChange={(event) =>
                    patch(
                      "challengeId",
                      event.target.value || null,
                    )
                  }
                >
                  <option value="">
                    Auto-select primary challenge
                  </option>

                  {challenges.map((challenge) => (
                    <option
                      key={challenge.id}
                      value={challenge.id}
                    >
                      {challenge.name} — {challenge.propFirm}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Refresh</span>
                <select
                  value={settings.refreshSeconds}
                  onChange={(event) =>
                    patch(
                      "refreshSeconds",
                      Number(event.target.value),
                    )
                  }
                >
                  <option value={2}>Every 2 seconds</option>
                  <option value={5}>Every 5 seconds</option>
                  <option value={10}>Every 10 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                </select>
              </label>
            </div>

            <div className={styles.layoutBlock}>
              <span>Layout</span>

              <div className={styles.layoutToggle}>
                <button
                  type="button"
                  className={
                    settings.layout === "COMPACT"
                      ? styles.activeLayout
                      : ""
                  }
                  onClick={() => patch("layout", "COMPACT")}
                >
                  <strong>COMPACT</strong>
                  <small>
                    Small corner scoreboard for regular trading footage.
                  </small>
                </button>

                <button
                  type="button"
                  className={
                    settings.layout === "FULL"
                      ? styles.activeLayout
                      : ""
                  }
                  onClick={() => patch("layout", "FULL")}
                >
                  <strong>FULL</strong>
                  <small>
                    Wide lower-third scoreboard for recaps and intros.
                  </small>
                </button>
              </div>
            </div>

            <div className={styles.visibilityBlock}>
              <span>Visible Metrics</span>

              <div className={styles.visibilityGrid}>
                {VISIBILITY_FIELDS.map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(event) =>
                        patch(item.key, event.target.checked)
                      }
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}

            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "SAVING..." : "SAVE SCOREBOARD"}
              </button>

              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setPreviewVersion((value) => value + 1)}
                disabled={saving}
              >
                REFRESH PREVIEW
              </button>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>OBS BROWSER SOURCE</span>
              <small>
                This URL can load without your FFZ login session.
              </small>
            </div>
          </div>

          <div className={styles.obsBlock}>
            <label>
              <span>Browser Source URL</span>
              <textarea
                readOnly
                value={overlayUrl}
                rows={4}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>

            <div className={styles.obsActions}>
              <button
                type="button"
                onClick={() => void copyOverlayUrl()}
              >
                COPY URL
              </button>

              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void regenerateLink()}
                disabled={saving}
              >
                REGENERATE LINK
              </button>
            </div>

            <div className={styles.obsHelp}>
              <strong>Recommended OBS setup</strong>
              <span>Source: Browser</span>
              <span>Width: 1920</span>
              <span>Height: 1080</span>
              <span>Shutdown source when not visible: optional</span>
              <span>Refresh browser when scene becomes active: optional</span>
            </div>

            <p>
              Treat this URL like a private share link. Anyone who has it can
              view only the scoreboard data exposed by this overlay — not your
              FFZ account or editing APIs.
            </p>
          </div>
        </article>
      </section>

      <section className={styles.previewPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>LIVE PREVIEW</span>
            <small>
              Transparent OBS canvas preview at 16:9.
            </small>
          </div>
        </div>

        <div className={styles.previewFrame}>
          <iframe
            key={`${settings.overlayKey}-${previewVersion}`}
            title="FFZ Scoreboard Preview"
            src={`${overlayUrl}?preview=1`}
          />
        </div>
      </section>
    </main>
  );
}
