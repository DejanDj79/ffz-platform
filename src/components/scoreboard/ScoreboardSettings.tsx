"use client";

import Link from "next/link";
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
  const [settings, setSettings] = useState<ScoreboardSettingsApiModel | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [origin, setOrigin] = useState("");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [switchingLayout, setSwitchingLayout] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [nextSettings, nextChallenges] = await Promise.all([
        fetchScoreboardSettings(),
        fetchChallenges(),
      ]);
      setSettings(nextSettings);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Creator Scoreboard.");
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
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function changeLayout(layout: ScoreboardSettingsApiModel["layout"]) {
    if (!settings || settings.layout === layout || switchingLayout) return;

    const previousLayout = settings.layout;
    patch("layout", layout);
    setSwitchingLayout(true);
    setMessage(null);
    setError(null);

    try {
      const next = await saveScoreboardSettings({ layout });
      setSettings((current) => current ? {
        ...current,
        layout: next.layout,
        updatedAt: next.updatedAt,
      } : current);
      setPreviewVersion((value) => value + 1);
    } catch (err) {
      patch("layout", previousLayout);
      setError(err instanceof Error ? err.message : "Unable to switch Scoreboard layout.");
    } finally {
      setSwitchingLayout(false);
    }
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
      setError(err instanceof Error ? err.message : "Unable to save Scoreboard.");
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
      setError("Copy failed. Select the URL manually.");
    }
  }

  async function rotateUrl() {
    const ok = window.confirm("Create a new OBS link? The old Scoreboard URL will stop working.");
    if (!ok) return;

    setSaving(true);
    try {
      const next = await regenerateScoreboardLink();
      setSettings(next);
      setPreviewVersion((value) => value + 1);
      setMessage("New OBS URL created.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to regenerate link.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>{error || "Loading Creator Scoreboard..."}</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.toolbar}>
        <div className={styles.previewControls}>
          <div className={styles.layoutSelect}>
            <span>PREVIEW</span>
            <div>
              <button
                type="button"
                disabled={switchingLayout}
                className={settings.layout === "FULL" ? styles.selected : ""}
                onClick={() => void changeLayout("FULL")}
              >
                FULL
              </button>
              <button
                type="button"
                disabled={switchingLayout}
                className={settings.layout === "COMPACT" ? styles.selected : ""}
                onClick={() => void changeLayout("COMPACT")}
              >
                COMPACT
              </button>
            </div>
          </div>

          <label className={styles.enableToggle}>
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(event) => patch("isEnabled", event.target.checked)}
            />
            <span>{settings.isEnabled ? "OVERLAY ENABLED" : "OVERLAY DISABLED"}</span>
          </label>
        </div>

        <div className={styles.toolbarActions}>
          <Link href="/creator/episodes">OPEN EPISODE BUILDER</Link>
        </div>
      </section>

      {(error || message) && (
        <div className={error ? styles.error : styles.message}>{error || message}</div>
      )}

      <section className={styles.previewPanel}>
        <header>
          <div>
            <span>LIVE SCOREBOARD PREVIEW</span>
            <small>Live scoreboard data · 16:9 OBS composition</small>
          </div>
        </header>
        <div className={styles.scoreboardStage}>
          <iframe
            key={`${settings.overlayKey}-${previewVersion}`}
            title="FFZ Creator Scoreboard"
            src={`${overlayUrl}?inside=app`}
          />
        </div>
      </section>

      <section className={styles.controlGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>SCOREBOARD CONTENT</span>
              <small>Creator context shown alongside automatic challenge and journal data.</small>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.twoColumns}>
              <label>
                <span>Challenge</span>
                <select
                  value={settings.challengeId ?? ""}
                  onChange={(event) => patch("challengeId", event.target.value || null)}
                >
                  <option value="">Auto-select primary challenge</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name} — {challenge.propFirm}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Season Start Date</span>
                <input
                  type="date"
                  value={dateInputValue(settings.seasonStartDate)}
                  onChange={(event) => patch(
                    "seasonStartDate",
                    event.target.value ? `${event.target.value}T00:00:00.000Z` : null,
                  )}
                />
              </label>
            </div>

            <div className={styles.twoColumns}>
              <label>
                <span>Trading Style</span>
                <input
                  value={settings.tradingStyle}
                  onChange={(event) => patch("tradingStyle", event.target.value)}
                  maxLength={80}
                  placeholder="SCALPING"
                />
              </label>

              <label>
                <span>Instruments</span>
                <input
                  value={settings.instrumentsLabel}
                  onChange={(event) => patch("instrumentsLabel", event.target.value)}
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
                onChange={(event) => patch("goalLabel", event.target.value)}
                placeholder="FIRST REAL PAYOUT"
              />
            </label>

            <label className={`${styles.wide} ${styles.notesField}`}>
              <span>Scoreboard Notes</span>
              <textarea
                value={settings.scoreboardNotes}
                onChange={(event) => patch("scoreboardNotes", event.target.value)}
                maxLength={1200}
                rows={4}
                placeholder={"One line per note.\nKeep it short enough for the Scoreboard."}
              />
            </label>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>DISPLAY &amp; OBS</span>
              <small>Refresh, visible metrics and the private Browser Source link.</small>
            </div>
          </div>

          <div className={styles.displayBody}>
            <div className={styles.displayTopRow}>
              <label className={styles.refreshField}>
                <span>Refresh Rate</span>
                <select
                  value={settings.refreshSeconds}
                  onChange={(event) => patch("refreshSeconds", Number(event.target.value))}
                >
                  <option value={2}>2 seconds</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </label>

              <button
                type="button"
                className={styles.saveButton}
                onClick={() => void save()}
                disabled={saving || switchingLayout}
              >
                {saving ? "SAVING..." : "SAVE SCOREBOARD"}
              </button>
            </div>

            <div className={styles.metrics}>
              <span>VISIBLE METRICS</span>
              <div>
                {VISIBILITY_FIELDS.map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(event) => patch(item.key, event.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.obs}>
              <label>
                <span>OBS Browser Source URL</span>
                <textarea
                  readOnly
                  rows={3}
                  value={overlayUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>

              <button type="button" className={styles.copyButton} onClick={() => void copyUrl()}>
                COPY OBS URL
              </button>

              <div className={styles.obsSetup}>
                <strong>OBS BROWSER SOURCE</strong>
                <span>1920 × 1080</span>
                <span>Transparent background</span>
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
          </div>
        </article>
      </section>
    </main>
  );
}
