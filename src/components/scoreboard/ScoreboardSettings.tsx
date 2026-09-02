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
}> = [
  { key: "showBalance", label: "Current Balance" },
  { key: "showChallengePnl", label: "Challenge P&L" },
  { key: "showTargetProgress", label: "Target Progress" },
  { key: "showTradeCount", label: "Trade Count" },
  { key: "showWinRate", label: "Win Rate" },
  { key: "showAverageR", label: "Average R" },
  { key: "showRealMoneyNet", label: "Real Money Net" },
  { key: "showRealPayouts", label: "Real Payouts" },
];

function dateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export function ScoreboardSettings() {
  const [settings, setSettings] =
    useState<ScoreboardSettingsApiModel | null>(null);

  const [challenges, setChallenges] =
    useState<Challenge[]>([]);

  const [origin, setOrigin] = useState("");
  const [previewVersion, setPreviewVersion] =
    useState(0);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function load() {
    try {
      const [nextSettings, nextChallenges] =
        await Promise.all([
          fetchScoreboardSettings(),
          fetchChallenges(),
        ]);

      setSettings(nextSettings);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Creator Scoreboard.",
      );
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

  function patch<
    K extends keyof ScoreboardSettingsApiModel,
  >(
    key: K,
    value: ScoreboardSettingsApiModel[K],
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
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
        tradingStyle: settings.tradingStyle,
        instrumentsLabel: settings.instrumentsLabel,
        seasonStartDate: settings.seasonStartDate,
        scoreboardNotes: settings.scoreboardNotes,

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
      setMessage("Scoreboard saved.");
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

  async function copyUrl() {
    if (!overlayUrl) return;

    try {
      await navigator.clipboard.writeText(overlayUrl);
      setMessage("OBS URL copied.");
      setError(null);
    } catch {
      setError(
        "Copy failed. Select the URL manually.",
      );
    }
  }

  async function rotateUrl() {
    const ok = window.confirm(
      "Create a new OBS link? The old Scoreboard URL will stop working.",
    );

    if (!ok) return;

    setSaving(true);

    try {
      const next = await regenerateScoreboardLink();
      setSettings(next);
      setPreviewVersion((value) => value + 1);
      setMessage("New OBS URL created.");
      setError(null);
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

  if (!settings) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>
          {error || "Loading Creator Scoreboard..."}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.scoreboardStage}>
        <iframe
          key={`${settings.overlayKey}-${previewVersion}-${settings.layout}`}
          title="FFZ Creator Scoreboard"
          src={`${overlayUrl}?inside=app`}
        />
      </section>

      <section className={styles.controlGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>EDIT SCOREBOARD</span>
              <small>
                Creator fields used by the Premiere-style
                graphic.
              </small>
            </div>

            <label className={styles.enableToggle}>
              <input
                type="checkbox"
                checked={settings.isEnabled}
                onChange={(event) =>
                  patch(
                    "isEnabled",
                    event.target.checked,
                  )
                }
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className={styles.form}>
            <div className={styles.twoColumns}>
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
                      {challenge.name} —{" "}
                      {challenge.propFirm}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Season Start Date</span>
                <input
                  type="date"
                  value={dateInputValue(
                    settings.seasonStartDate,
                  )}
                  onChange={(event) =>
                    patch(
                      "seasonStartDate",
                      event.target.value
                        ? `${event.target.value}T00:00:00.000Z`
                        : null,
                    )
                  }
                />
              </label>
            </div>

            <div className={styles.twoColumns}>
              <label>
                <span>Trading Style</span>
                <input
                  value={settings.tradingStyle}
                  onChange={(event) =>
                    patch(
                      "tradingStyle",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  placeholder="SCALPING"
                />
              </label>

              <label>
                <span>Instruments</span>
                <input
                  value={settings.instrumentsLabel}
                  onChange={(event) =>
                    patch(
                      "instrumentsLabel",
                      event.target.value,
                    )
                  }
                  maxLength={80}
                  placeholder="MNQ / MES"
                />
              </label>
            </div>

            <label className={styles.wide}>
              <span>Season Goal</span>
              <input
                value={settings.goalLabel}
                maxLength={100}
                onChange={(event) =>
                  patch(
                    "goalLabel",
                    event.target.value,
                  )
                }
                placeholder="FIRST REAL PAYOUT"
              />
            </label>

            <label
              className={`${styles.wide} ${styles.notesField}`}
            >
              <span>Scoreboard Notes</span>
              <textarea
                value={settings.scoreboardNotes}
                onChange={(event) =>
                  patch(
                    "scoreboardNotes",
                    event.target.value,
                  )
                }
                maxLength={1200}
                rows={5}
                placeholder={
                  "One line per note.\nKeep it short enough for the Scoreboard."
                }
              />
            </label>

            <div className={styles.twoColumns}>
              <label>
                <span>Refresh Rate</span>
                <select
                  value={settings.refreshSeconds}
                  onChange={(event) =>
                    patch(
                      "refreshSeconds",
                      Number(event.target.value),
                    )
                  }
                >
                  <option value={2}>2 seconds</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </label>

              <div className={styles.layoutSelect}>
                <span>Version</span>
                <div>
                  <button
                    type="button"
                    className={
                      settings.layout === "FULL"
                        ? styles.selected
                        : ""
                    }
                    onClick={() =>
                      patch("layout", "FULL")
                    }
                  >
                    FULL
                  </button>

                  <button
                    type="button"
                    className={
                      settings.layout === "COMPACT"
                        ? styles.selected
                        : ""
                    }
                    onClick={() =>
                      patch("layout", "COMPACT")
                    }
                  >
                    COMPACT
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.metrics}>
              <span>Compact / optional metric controls</span>

              <div>
                {VISIBILITY_FIELDS.map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(event) =>
                        patch(
                          item.key,
                          event.target.checked,
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className={styles.error}>{error}</p>
            )}

            {message && (
              <p className={styles.message}>
                {message}
              </p>
            )}

            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void save()}
              disabled={saving}
            >
              {saving
                ? "SAVING..."
                : "SAVE SCOREBOARD"}
            </button>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>HOW FULL SCOREBOARD WORKS</span>
              <small>
                Almost every number is now automatic.
              </small>
            </div>
          </div>

          <div className={styles.explainer}>
            <div>
              <strong>AUTOMATIC FROM CHALLENGE</strong>
              <span>
                Status, phase, prop firm, account size,
                target, daily loss, drawdown, P&amp;L.
              </span>
            </div>

            <div>
              <strong>AUTOMATIC FROM JOURNAL</strong>
              <span>
                Trades, win rate, wins, losses, best,
                worst, average win/loss and daily calendar.
              </span>
            </div>

            <div>
              <strong>CREATOR SETTINGS</strong>
              <span>
                Trading style, instruments, season start,
                goal and notes.
              </span>
            </div>

            <div>
              <strong>REAL MONEY</strong>
              <span>
                Net real cash and actual payouts remain
                separate from challenge P&amp;L.
              </span>
            </div>
          </div>

          <div className={styles.obs}>
            <label>
              <span>OBS Browser Source URL</span>
              <textarea
                readOnly
                rows={4}
                value={overlayUrl}
                onFocus={(event) =>
                  event.currentTarget.select()
                }
              />
            </label>

            <button
              type="button"
              className={styles.copyButton}
              onClick={() => void copyUrl()}
            >
              COPY OBS URL
            </button>

            <div className={styles.obsSetup}>
              <strong>Recommended OBS Browser Source</strong>
              <span>Width: 1920</span>
              <span>Height: 1080</span>
              <span>Background: transparent</span>
            </div>

            <button
              type="button"
              className={styles.rotateButton}
              onClick={() => void rotateUrl()}
              disabled={saving}
            >
              Regenerate private OBS link
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
