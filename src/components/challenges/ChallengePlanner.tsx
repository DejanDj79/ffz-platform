"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./ChallengePlanner.module.css";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import {
  applyPresetToChallenge,
  createBlankChallenge,
} from "@/lib/challenges/defaults";
import { getPropFirmPreset, PROP_FIRM_PRESETS } from "@/lib/prop-firms";
import type { DrawdownMode, PropFirmPresetId } from "@/lib/prop-firms";
import type { Challenge, ChallengePhase, ChallengeStatus } from "@/lib/challenges/types";
import {
  createChallengeViaApi,
  fetchChallenges,
  migrateLegacyChallengesToApi,
  updateChallengeViaApi,
} from "@/lib/challenges/api-client";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function Icon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const icons: Record<string, ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    pulse: <><path d="M3 12h4l2-5 4 10 2-5h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.4a1.7 1.7 0 0 0-1.56-1.04H5v-3h.44A1.7 1.7 0 0 0 7 10.32a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.66 6a1.7 1.7 0 0 0 1.04-1.56V4h3v.44A1.7 1.7 0 0 0 15.74 6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04H21v3h-.04A1.7 1.7 0 0 0 19.4 15Z"/></>,
    building: <><path d="M4 21h16M6 21V5l6-2 6 2v16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/></>,
    tag: <><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1"/></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13"/><path d="M16 11h5v4h-5a2 2 0 1 1 0-4Z"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3Z"/><path d="m9 12 2 2 4-5"/></>,
    dollar: <><circle cx="12" cy="12" r="9"/><path d="M12 6v12M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 1-3 2.3 0 3.7 6 1.7 6 5 0 1.5-1.3 2.7-3.2 2.7-1.2 0-2.4-.4-3.3-1.2"/></>,
    reset: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/></>,
    flag: <><path d="M5 21V4"/><path d="M5 5h11l-2 3 2 3H5"/></>,
    save: <><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2"/></>,
    check: <><path d="m7 12 3 3 7-7"/></>,
  };

  return <svg {...common}>{icons[name] ?? icons.chart}</svg>;
}

function parseNumeric(raw: string) {
  const cleaned = raw.replace(/[$,%\s,]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function healthCopy(health: "SAFE" | "CAUTION" | "DANGER") {
  if (health === "DANGER") return "Your remaining challenge buffer is very tight.";
  if (health === "CAUTION") return "One of your remaining loss buffers is getting tight.";
  return "You're well within the configured planning buffers.";
}

function statusLabel(status: ChallengeStatus) {
  return status.replaceAll("_", " ");
}

function statusClass(status: ChallengeStatus) {
  if (status === "FAILED") return `${styles.statusBadge} ${styles.failed}`;
  if (status === "PAUSED") return `${styles.statusBadge} ${styles.paused}`;
  if (status === "NOT_STARTED" || status === "CLOSED") return `${styles.statusBadge} ${styles.neutral}`;
  return styles.statusBadge;
}

function Field({
  icon,
  label,
  children,
  purple = false,
}: {
  icon: string;
  label: string;
  children: ReactNode;
  purple?: boolean;
}) {
  return (
    <div className={styles.formRow}>
      <div className={`${styles.formIcon} ${purple ? styles.purple : ""}`}><Icon name={icon} /></div>
      <label className={styles.formLabel}>{label}</label>
      <div className={styles.formControl}>{children}</div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  purple = false,
  progress,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  purple?: boolean;
  progress?: number;
}) {
  return (
    <div className={`${styles.metricCard} ${purple ? styles.purple : ""}`}>
      <div className={styles.metricLabel}><Icon name={icon} />{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {progress != null && (
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}

export function ChallengePlanner() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [draft, setDraft] = useState<Challenge>(() => createBlankChallenge());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadChallenges = useCallback(async (migrateLegacy = false) => {
    try {
      setApiError(null);
      let items = await fetchChallenges();

      if (migrateLegacy) {
        const migrated = await migrateLegacyChallengesToApi(items);
        if (migrated) items = await fetchChallenges();
      }

      setChallenges(items);
      setDraft((current) => {
        const selected = items.find((item) => item.id === current.id);
        return selected ?? items[0] ?? createBlankChallenge();
      });
    } catch (error) {
      console.error("Unable to load challenge data:", error);
      setApiError("Unable to load challenges from the database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenges(true);

    const refresh = () => void loadChallenges(false);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [loadChallenges]);

  const metrics = useMemo(() => calculateChallengeMetrics(draft), [draft]);
  const activePreset = useMemo(() => getPropFirmPreset(draft.rulesPresetId), [draft.rulesPresetId]);

  function update<K extends keyof Challenge>(key: K, value: Challenge[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNumber(key: keyof Challenge, raw: string) {
    update(key, parseNumeric(raw) as never);
  }

  function changePreset(presetId: PropFirmPresetId) {
    setDraft((current) => applyPresetToChallenge(current, presetId));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setApiError(null);

    try {
      const exists = challenges.some((item) => item.id === draft.id);
      const saved = exists
        ? await updateChallengeViaApi(draft)
        : await createChallengeViaApi(draft);

      setDraft(saved);
      setChallenges((items) => {
        const alreadyThere = items.some((item) => item.id === saved.id);
        return alreadyThere
          ? items.map((item) => item.id === saved.id ? saved : item)
          : [saved, ...items];
      });
    } catch (error) {
      console.error("Unable to save challenge:", error);
      setApiError("Unable to save this challenge to the database.");
    } finally {
      setSaving(false);
    }
  }

  function newChallenge() {
    setDraft(createBlankChallenge());
  }

  const goalSub = `${money.format(Math.max(0, metrics.currentPnl))} / ${money.format(draft.profitTarget)}`;
  const dailySub = metrics.remainingDailyLossPct == null
    ? "No daily loss limit"
    : `${number.format(metrics.remainingDailyLossPct)}% remaining`;
  const ddSub = `${number.format(metrics.remainingDrawdownPct)}% remaining`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logoFrame}>
          <Image className={styles.logo} src="/ffz-logo.png" alt="Futures From Zero" width={340} height={110} priority />
        </div>

        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}><Icon name="calendar" /></div>
          <h1>Challenge Planner</h1>
        </div>

        <div className={styles.systemChip}>
          <span className={styles.systemDot} />
          <span className={styles.systemText}>{apiError ? "Database unavailable" : loading ? "Connecting..." : "Database connected"}<small>PostgreSQL is the source of truth</small></span>
        </div>
      </header>

      <div className={styles.workspace}>
        <form className={styles.panel} onSubmit={save}>
          <div className={styles.panelTitle}><Icon name="settings" />CHALLENGE SETUP</div>
          <div className={styles.formList}>
            <Field icon="settings" label="Rule Preset">
              <select value={draft.rulesPresetId ?? "CUSTOM"} onChange={(e) => changePreset(e.target.value as PropFirmPresetId)}>
                <option value="CUSTOM">Custom / Manual</option>
                {PROP_FIRM_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </Field>
            <Field icon="building" label="Prop Firm">
              <input value={draft.propFirm} onChange={(e) => update("propFirm", e.target.value)} placeholder="e.g. Topstep" />
            </Field>
            <Field icon="tag" label="Challenge Name">
              <input value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. 50K Challenge #1" />
            </Field>
            <Field icon="wallet" label="Account Size">
              <input inputMode="decimal" value={draft.accountSize || ""} onChange={(e) => updateNumber("accountSize", e.target.value)} />
            </Field>
            <Field icon="dollar" label="Starting Balance">
              <input inputMode="decimal" value={draft.startingBalance || ""} onChange={(e) => updateNumber("startingBalance", e.target.value)} />
            </Field>
            <Field icon="target" label="Profit Target">
              <input inputMode="decimal" value={draft.profitTarget || ""} onChange={(e) => updateNumber("profitTarget", e.target.value)} />
            </Field>
            <Field icon="shield" label="Max Drawdown">
              <input inputMode="decimal" value={draft.maxDrawdown || ""} onChange={(e) => updateNumber("maxDrawdown", e.target.value)} />
            </Field>
            <Field icon="chart" label="Drawdown Mode">
              <select value={draft.drawdownMode ?? "STATIC"} onChange={(e) => update("drawdownMode", e.target.value as DrawdownMode)}>
                <option value="STATIC">Static</option>
                <option value="EOD_TRAILING">EOD Trailing</option>
                <option value="INTRADAY_TRAILING">Intraday Trailing</option>
              </select>
            </Field>
            {draft.drawdownMode === "EOD_TRAILING" && (
              <Field icon="chart" label="Highest EOD Balance" purple>
                <input inputMode="decimal" value={draft.highestEodBalance || ""} onChange={(e) => updateNumber("highestEodBalance", e.target.value)} />
              </Field>
            )}
            <Field icon="pulse" label="Daily Loss Limit">
              <input inputMode="decimal" value={draft.dailyLossLimit || ""} onChange={(e) => updateNumber("dailyLossLimit", e.target.value)} />
            </Field>
            <Field icon="tag" label="Challenge Fee">
              <input inputMode="decimal" value={draft.challengeFee || ""} onChange={(e) => updateNumber("challengeFee", e.target.value)} />
            </Field>
            <Field icon="reset" label="Reset Fee">
              <input inputMode="decimal" value={draft.resetFee || ""} onChange={(e) => updateNumber("resetFee", e.target.value)} />
            </Field>
            <Field icon="reset" label="Resets Used">
              <input inputMode="numeric" value={draft.resetsUsed || ""} onChange={(e) => updateNumber("resetsUsed", e.target.value)} />
            </Field>
            <Field icon="calendar" label="Minimum Trading Days">
              <input inputMode="numeric" value={draft.minimumTradingDays || ""} onChange={(e) => updateNumber("minimumTradingDays", e.target.value)} />
            </Field>
            <Field icon="calendar" label="Days Traded">
              <input inputMode="numeric" value={draft.daysTraded || ""} onChange={(e) => updateNumber("daysTraded", e.target.value)} />
            </Field>
            <Field icon="chart" label="Current Balance">
              <input inputMode="decimal" value={draft.currentBalance || ""} onChange={(e) => updateNumber("currentBalance", e.target.value)} />
            </Field>
            <Field icon="pulse" label="Today's P&L" purple>
              <input inputMode="decimal" value={draft.todayPnl} onChange={(e) => updateNumber("todayPnl", e.target.value)} />
            </Field>
            <Field icon="flag" label="Phase">
              <select value={draft.phase} onChange={(e) => update("phase", e.target.value as ChallengePhase)}>
                <option value="EVALUATION">Evaluation</option>
                <option value="VERIFICATION">Verification</option>
                <option value="SIM_FUNDED">Sim Funded</option>
                <option value="FUNDED">Funded</option>
                <option value="PAYOUT">Payout</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field icon="flag" label="Status">
              <select value={draft.status} onChange={(e) => update("status", e.target.value as ChallengeStatus)}>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PAUSED">Paused</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
                <option value="FUNDED">Funded</option>
                <option value="CLOSED">Closed</option>
              </select>
            </Field>
            <Field icon="clipboard" label="Notes" purple>
              <textarea value={draft.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Short challenge note..." />
            </Field>
          </div>

          {apiError && <div className={styles.ruleNotice}><strong>Database error</strong><span>{apiError}</span></div>}
          {loading && <div className={styles.ruleNotice}><strong>Loading</strong><span>Reading challenges from PostgreSQL...</span></div>}

          {activePreset && (
            <div className={styles.ruleNotice}>
              <strong>{activePreset.label}</strong>
              <span>Verified {activePreset.verifiedAt} · {activePreset.drawdownMode.replaceAll("_", " ")} · max {activePreset.maxMinis ?? "—"} mini / {activePreset.maxMicros ?? "—"} micros.</span>
              {activePreset.reviewNote && <small>{activePreset.reviewNote}</small>}
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={saving}><Icon name="save" />{saving ? "SAVING..." : "SAVE CHALLENGE"}</button>
            <button className={styles.secondary} type="button" onClick={newChallenge}><Icon name="reset" />NEW CHALLENGE</button>
          </div>
        </form>

        <div className={styles.rightColumn}>
          <section className={styles.panel}>
            <div className={`${styles.panelTitle} ${styles.purple}`}><Icon name="chart" />CHALLENGE OVERVIEW</div>
            <div className={styles.overviewBody}>
              <div className={styles.overviewGrid}>
                <MetricCard icon="dollar" label="CURRENT BALANCE" value={money.format(draft.currentBalance)} sub={`${money.format(metrics.currentPnl)} current P&L`} />
                <MetricCard icon="target" label="PROFIT TARGET REMAINING" value={money.format(metrics.profitTargetRemaining)} sub={`${number.format(100 - metrics.targetProgressPct)}% to go`} />
                <MetricCard icon="shield" label="REMAINING DRAWDOWN" value={money.format(metrics.remainingDrawdown)} sub={`${ddSub} · floor ${money.format(metrics.drawdownFloor)}`} purple />
                <MetricCard icon="pulse" label="REMAINING DAILY LOSS" value={metrics.remainingDailyLoss == null ? "NO LIMIT" : money.format(metrics.remainingDailyLoss)} sub={dailySub} purple />

                <MetricCard icon="target" label="PROGRESS TO TARGET" value={`${number.format(metrics.targetProgressPct)}%`} sub={goalSub} progress={metrics.targetProgressPct} />
                <MetricCard icon="calendar" label="DAYS TRADED" value={String(draft.daysTraded)} sub={draft.minimumTradingDays ? `Min. required: ${draft.minimumTradingDays}` : "No minimum configured"} purple />
                <MetricCard icon="flag" label="STATUS" value={statusLabel(draft.status)} sub={`Phase: ${statusLabel(draft.phase as ChallengeStatus)}`} />
                <MetricCard icon="dollar" label="REAL MONEY COST" value={money.format(metrics.realMoneyCost)} sub={draft.resetsUsed ? `${draft.resetsUsed} reset(s) included` : "Challenge fee only"} purple />

                <div className={styles.healthCard}>
                  <div className={styles.healthInner}>
                    <div className={styles.healthLabel}><Icon name="pulse" />CHALLENGE HEALTH</div>
                    <div className={`${styles.healthValue} ${metrics.health === "CAUTION" ? styles.caution : metrics.health === "DANGER" ? styles.danger : ""}`}>{metrics.health}</div>
                    <div className={styles.healthShield}><Icon name="shield" /></div>
                    <div className={styles.healthText}>{healthCopy(metrics.health)}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}><Icon name="clipboard" />CHALLENGE SUMMARY</div>
            <div className={styles.summaryBody}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Prop Firm</span><span className={styles.summaryValue}>{draft.propFirm || "—"}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Phase</span><span className={styles.summaryValue}>{statusLabel(draft.phase as ChallengeStatus)}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Account</span><span className={styles.summaryValue}>{money.format(draft.accountSize).replace(".00", "")}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Fee Paid</span><span className={styles.summaryValue}>{money.format(metrics.realMoneyCost)}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Current P&L</span><span className={`${styles.summaryValue} ${metrics.currentPnl >= 0 ? styles.positive : styles.negative}`}>{money.format(metrics.currentPnl)}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Goal</span><span className={styles.summaryValue}>{money.format(draft.profitTarget)}</span></div>
                <div className={styles.summaryCell}><span className={styles.summaryLabel}>Rules</span><span className={styles.summaryValue}>{draft.drawdownMode?.replaceAll("_", " ") ?? "STATIC"}</span></div>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.activeChallengesPanel}`}>
            <div className={styles.panelTitle}><Icon name="flag" />ACTIVE CHALLENGES</div>
            {challenges.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.challengeTable}>
                  <thead>
                    <tr><th>Challenge Name</th><th>Prop Firm</th><th>Account</th><th>Status</th><th>Progress</th><th>Current Balance</th><th>P&L</th><th>Days</th></tr>
                  </thead>
                  <tbody>
                    {challenges.map((challenge) => {
                      const row = calculateChallengeMetrics(challenge);
                      return (
                        <tr key={challenge.id} className={challenge.id === draft.id ? styles.selected : ""} onClick={() => setDraft(challenge)}>
                          <td>{challenge.name || "Untitled Challenge"}</td>
                          <td>{challenge.propFirm || "—"}</td>
                          <td>{money.format(challenge.accountSize).replace(".00", "")}</td>
                          <td><span className={statusClass(challenge.status)}>{statusLabel(challenge.status)}</span></td>
                          <td><div className={styles.rowProgress}><span>{number.format(row.targetProgressPct)}%</span><span className={styles.rowBar}><span style={{ width: `${row.targetProgressPct}%` }} /></span></div></td>
                          <td>{money.format(challenge.currentBalance)}</td>
                          <td className={row.currentPnl >= 0 ? styles.positive : styles.negative}>{money.format(row.currentPnl)}</td>
                          <td>{challenge.daysTraded}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className={styles.emptyState}>No challenges saved yet.</div>}
          </section>
        </div>
      </div>

      <footer className={styles.footer}>Backend v1.2 · Challenge Planner is persisted in PostgreSQL.</footer>
    </main>
  );
}
