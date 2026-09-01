"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { INSTRUMENTS } from "@/lib/trading/instruments";
import { fetchChallenges } from "@/lib/challenges/api-client";
import { calculatePositionSize } from "@/lib/trading/position-size";
import type { AccountType, InstrumentCode, PositionSizeResult } from "@/lib/trading/types";
import type { Challenge } from "@/lib/challenges/types";
import { calculateChallengeMetrics } from "@/lib/challenges/calculations";
import { normalizeChallenge } from "@/lib/challenges/defaults";
import { applyChallengeContractLimit, getChallengeContractLimit } from "@/lib/prop-firms/calculator-integration";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function parsePositive(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

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
    sliders: <><path d="M4 6h10M18 6h2M10 12h10M4 12h2M4 18h6M14 18h6"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"/></>,
    bars: <><path d="M5 20v-7h3v7M10.5 20V8h3v12M16 20V4h3v16"/></>,
    up: <><path d="M5 17 12 8l7 9"/><path d="M5 12 12 3l7 9"/></>,
    down: <><path d="m5 7 7 9 7-9"/><path d="m5 12 7 9 7-9"/></>,
    target: <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    shield: <><path d="M12 3 5.5 6v5.5c0 4.3 2.6 7.6 6.5 9.5 3.9-1.9 6.5-5.2 6.5-9.5V6L12 3Z"/><path d="M9.5 12.3 11.3 14l3.5-4"/></>,
    money: <><circle cx="12" cy="12" r="8"/><path d="M15 9.5c-.8-.7-1.7-1-3-1-1.5 0-2.5.6-2.5 1.6 0 2.4 5.5 1.1 5.5 3.8 0 1.1-1.1 1.9-2.8 1.9-1.3 0-2.4-.4-3.2-1.2M12 6.5v11"/></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/><path d="M15 10h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    calc: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.1M8 15h2M12 15h2M16 15h.1M8 18h2M12 18h4"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/></>,
    crosshair: <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    contracts: <><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3.5 19c.5-4 2.3-6 5.5-6 3.3 0 5 2 5.5 6M14 14c3.5-.5 5.6 1.2 6.5 4.5"/></>,
    scale: <><path d="M12 4v16M6 7h12M7 7l-3 6h6L7 7ZM17 7l-3 6h6l-3-6Z"/></>,
    pie: <><path d="M11 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M14 3.5A7.5 7.5 0 0 1 20.5 10H14V3.5Z"/></>,
    pulse: <><path d="M3 13h4l2-5 4 10 2-5h6"/></>,
    reset: <><path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 5v6h6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    cap: <><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v4c3 2.2 7 2.2 10 0v-4M21 9v6"/></>,
    briefcase: <><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 11h16"/></>,
  };

  return <svg {...common}>{icons[name] ?? icons.info}</svg>;
}

function FieldRow({
  icon,
  label,
  accent = "cyan",
  children,
  hint,
}: {
  icon: string;
  label: ReactNode;
  accent?: "cyan" | "purple";
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field-row">
      <span className={`field-icon ${accent}`}><Icon name={icon} /></span>
      <div className="field-label-wrap">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

function ResultCard({
  icon,
  title,
  value,
  sub,
  accent = "cyan",
  className = "",
}: {
  icon: string;
  title: string;
  value: string;
  sub?: string;
  accent?: "cyan" | "purple";
  className?: string;
}) {
  return (
    <article className={`result-card ${accent} ${className}`}>
      <div className="result-title"><span><Icon name={icon} /></span>{title}</div>
      <div className="result-value">{value}</div>
      {sub && <div className="result-sub">{sub}</div>}
    </article>
  );
}

export function RiskCalculator() {
  const [accountType, setAccountType] = useState<AccountType>("PROP");
  const [instrument, setInstrument] = useState<InstrumentCode>("MNQ");
  const [entry, setEntry] = useState("18950.25");
  const [stop, setStop] = useState("18930.25");
  const [target, setTarget] = useState("18990.25");
  const [maxRisk, setMaxRisk] = useState("100");
  const [commissionAndFees, setCommissionAndFees] = useState("0");
  const [slippageBufferTicks, setSlippageBufferTicks] = useState("0");
  const [remainingDrawdown, setRemainingDrawdown] = useState("1450");
  const [remainingDailyLoss, setRemainingDailyLoss] = useState("225");
  const [currentBalance, setCurrentBalance] = useState("10250");
  const [result, setResult] = useState<PositionSizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");

  const spec = useMemo(() => INSTRUMENTS[instrument], [instrument]);

  const contractType =
    instrument === "MNQ" || instrument === "MES"
      ? "MICRO"
      : "MINI";

  
  const selectedChallenge = useMemo(
    () => savedChallenges.find((challenge) => challenge.id === selectedChallengeId) ?? null,
    [savedChallenges, selectedChallengeId],
  );

  const challengeContractLimit =
    getChallengeContractLimit(selectedChallenge, instrument);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedChallenges() {
      try {
        const items = await fetchChallenges();

        if (!cancelled) {
          setSavedChallenges(items);
        }
      } catch (error) {
        console.error("Failed to load FFZ challenges from API:", error);

        if (!cancelled) {
          setSavedChallenges([]);
        }
      }
    }

    void loadSavedChallenges();

    const refresh = () => {
      void loadSavedChallenges();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  function useChallenge(challengeId: string) {
    setSelectedChallengeId(challengeId);
    const challenge = savedChallenges.find((item) => item.id === challengeId);
    if (!challenge) return;

    const metrics = calculateChallengeMetrics(challenge);
    setAccountType("PROP");
    setCurrentBalance(String(challenge.currentBalance));
    setRemainingDrawdown(metrics.remainingDrawdown.toFixed(2));
    setRemainingDailyLoss(metrics.remainingDailyLoss == null ? "" : metrics.remainingDailyLoss.toFixed(2));
  }

  function calculate(event?: FormEvent) {
    event?.preventDefault();
    setError(null);

    const parsedEntry = parsePositive(entry);
    const parsedStop = parsePositive(stop);
    const parsedMaxRisk = parsePositive(maxRisk);

    if (parsedEntry == null || parsedStop == null || parsedMaxRisk == null) {
      setResult(null);
      setError("Enter valid values for Entry, Stop Loss and Max Risk.");
      return;
    }

    try {
      const next = calculatePositionSize({
        instrument,
        entry: parsedEntry,
        stop: parsedStop,
        target: parsePositive(target),
        maxRisk: parsedMaxRisk,
        commissionAndFeesPerContract: parsePositive(commissionAndFees) ?? 0,
        slippageBufferTicks: parsePositive(slippageBufferTicks) ?? 0,
        accountType,
        remainingDrawdown: accountType === "PROP" ? parsePositive(remainingDrawdown) : null,
        remainingDailyLoss: accountType === "PROP" ? parsePositive(remainingDailyLoss) : null,
      });
      const contractLimit = getChallengeContractLimit(selectedChallenge, instrument);
      const adjusted = applyChallengeContractLimit(
        next,
        contractLimit,
        accountType === "PROP" ? parsePositive(remainingDrawdown) : null,
        accountType === "PROP" ? parsePositive(remainingDailyLoss) : null,
      );
      setResult(adjusted);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unable to calculate this setup.");
    }
  }

  function reset() {
    setAccountType("PROP");
    setInstrument("MNQ");
    setEntry("18950.25");
    setStop("18930.25");
    setTarget("18990.25");
    setMaxRisk("100");
    setCommissionAndFees("0");
    setSlippageBufferTicks("0");
    setRemainingDrawdown("1450");
    setRemainingDailyLoss("225");
    setCurrentBalance("10250");
    setSelectedChallengeId("");
    setResult(null);
    setError(null);
  }

  const display = result ?? {
    stopDistancePoints: 20,
    stopDistanceTicks: 80,
    riskPerContract: 40,
    maxContracts: 2,
    actualRisk: 80,
    rewardRiskRatio: 2,
    drawdownUsagePct: 5.5,
    dailyLossUsagePct: 35.56,
    direction: "LONG",
    riskLevel: "MODERATE",
    effectiveRiskBudget: 100,
    unusedRiskBudget: 20,
    marketRiskPerContract: 40,
    commissionAndFeesPerContract: 0,
    slippageBufferTicks: 0,
    slippageBufferPerContract: 0,
    totalCostBufferPerContract: 0,
    rewardDistancePoints: 40,
    warnings: [],
  } as PositionSizeResult;

  const parsedRemainingDailyLoss = parsePositive(remainingDailyLoss);
  const remainingDailyAfterLoss = accountType === "PROP" && parsedRemainingDailyLoss != null
    ? Math.max(0, parsedRemainingDailyLoss - display.actualRisk)
    : null;

  const healthStatus = accountType === "PROP" ? display.riskLevel : "N/A";
  const healthClassName = healthStatus === "N/A" ? "na" : healthStatus.toLowerCase();
  const healthLabel = healthStatus === "LOW" ? "SAFE" : healthStatus === "MODERATE" ? "CAUTION" : healthStatus === "HIGH" ? "HIGH RISK" : "—";
  const healthReason = accountType !== "PROP"
    ? "Challenge Health is available for Prop accounts with remaining drawdown."
    : display.drawdownUsagePct == null
      ? "Enter remaining drawdown to classify this setup."
      : healthStatus === "LOW"
        ? `This trade uses ${display.drawdownUsagePct}% of remaining drawdown. LOW is 5% or less.`
        : healthStatus === "MODERATE"
          ? `This trade uses ${display.drawdownUsagePct}% of remaining drawdown. CAUTION appears above 5% and up to 10%.`
          : `This trade uses ${display.drawdownUsagePct}% of remaining drawdown. HIGH RISK appears above 10%.`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-logo-frame">
            <img src="/ffz-logo.png" alt="Futures From Zero logo" className="brand-logo" />
          </div>
        </div>

        <div className="page-title">
          <span className="title-icon"><Icon name="calc" /></span>
          <div><h1>Risk Calculator</h1><p>Position sizing for futures &amp; prop challenges</p></div>
        </div>

        <div className="education-chip"><Icon name="cap" /><span>Calculate size<small>from risk and stop distance.</small></span></div>
      </header>

      <form className="workspace" onSubmit={calculate}>
        <section className="main-panel inputs-panel">
          <div className="section-title cyan"><Icon name="sliders" /><span>INPUTS</span></div>

          <div className="input-list">
            <FieldRow icon="user" label="Account Type">
              <div className="account-toggle">
                <button type="button" className={accountType === "PERSONAL" ? "active" : ""} onClick={() => setAccountType("PERSONAL")}>Personal</button>
                <button type="button" className={accountType === "PROP" ? "active" : ""} onClick={() => setAccountType("PROP")}>Prop</button>
              </div>
            </FieldRow>

            {accountType === "PROP" && (
              <FieldRow icon="briefcase" label="Use Challenge" hint="from Challenge Planner">
                <select value={selectedChallengeId} onChange={(e) => useChallenge(e.target.value)}>
                  <option value="">Manual values</option>
                  {savedChallenges
                    .filter((challenge) => !["FAILED", "CLOSED"].includes(challenge.status))
                    .map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>
                        {challenge.name || `${challenge.propFirm} ${challenge.accountSize / 1000}K`}
                      </option>
                    ))}
                </select>
              </FieldRow>
            )}

            <FieldRow icon="bars" label="Instrument" hint="MNQ, MES, NQ, ES">
              <select value={instrument} onChange={(e) => setInstrument(e.target.value as InstrumentCode)}>
                {Object.values(INSTRUMENTS).map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
              </select>
            </FieldRow>

            <FieldRow icon="up" label="Entry"><input inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} /></FieldRow>
            <FieldRow icon="down" label="Stop Loss" accent="purple"><input inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} /></FieldRow>
            <FieldRow icon="target" label={<>Optional Target <span className="optional">(optional)</span></>} accent="purple"><input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></FieldRow>
            <FieldRow icon="shield" label="Max Risk per Trade"><div className="money-input"><span>$</span><input inputMode="decimal" value={maxRisk} onChange={(e) => setMaxRisk(e.target.value)} /></div></FieldRow>
            <FieldRow icon="money" label="Commission & Fees" hint="$ per contract round trip"><div className="money-input"><span>$</span><input inputMode="decimal" value={commissionAndFees} onChange={(e) => setCommissionAndFees(e.target.value)} /></div></FieldRow>
            <FieldRow icon="chart" label="Slippage Buffer" hint="ticks per contract"><input inputMode="decimal" value={slippageBufferTicks} onChange={(e) => setSlippageBufferTicks(e.target.value)} /></FieldRow>

            {accountType === "PROP" && <>
              <FieldRow icon="chart" label="Remaining Drawdown" accent="purple"><div className="money-input"><span>$</span><input inputMode="decimal" value={remainingDrawdown} onChange={(e) => setRemainingDrawdown(e.target.value)} /></div></FieldRow>
              <FieldRow icon="calendar" label="Remaining Daily Loss Limit" accent="purple"><div className="money-input"><span>$</span><input inputMode="decimal" value={remainingDailyLoss} onChange={(e) => setRemainingDailyLoss(e.target.value)} /></div></FieldRow>
              <FieldRow icon="wallet" label={<>Current Balance <span className="optional">(optional)</span></>}><div className="money-input"><span>$</span><input inputMode="decimal" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} /></div></FieldRow>
            </>}
          </div>

          <div className="input-actions">
            <button className="primary-btn" type="submit"><Icon name="calc" />CALCULATE</button>
            <button className="secondary-btn" type="button" onClick={reset}><Icon name="reset" />RESET</button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          {selectedChallenge && (
            <div className="input-note">
              <Icon name="shield" />
              <span>
                Using {selectedChallenge.name || selectedChallenge.propFirm}: {selectedChallenge.drawdownMode?.replaceAll("_", " ") ?? "STATIC"} drawdown · max {selectedChallenge.maxMinis ?? "—"} mini / {selectedChallenge.maxMicros ?? "—"} micros.
              </span>
            </div>
          )}

          <div className="input-note"><Icon name="info" /><span>All values are editable. Calculator uses exchange tick values.</span></div>
        </section>

        <section className="main-panel results-panel">
          <div className="section-title purple"><Icon name="chart" /><span>RESULTS</span></div>

          <div className="results-grid">
            <ResultCard icon="crosshair" title="STOP DISTANCE" value={number.format(display.stopDistancePoints)} sub={`pts / ${number.format(display.stopDistanceTicks)} ticks`} />
            <ResultCard icon="money" title="TOTAL RISK / CONTRACT" value={money.format(display.riskPerContract)} sub={`${money.format(display.marketRiskPerContract)} market + ${money.format(display.totalCostBufferPerContract)} buffer`} />
            <ResultCard
              icon="contracts"
              title="MAXIMUM CONTRACTS"
              value={String(display.maxContracts)}
              sub={
                challengeContractLimit
                  ? `${contractType} • ${instrument} • Challenge max: ${challengeContractLimit}`
                  : `${contractType} • ${instrument}`
              }
              accent="purple"
            />
            <ResultCard icon="shield" title="ACTUAL TRADE RISK" value={money.format(display.actualRisk)} accent="purple" />

            <ResultCard icon="scale" title="RISK / REWARD" value={display.rewardRiskRatio == null ? "—" : `1 : ${number.format(display.rewardRiskRatio)}`} accent="purple" />
            <ResultCard icon="calendar" title="REMAINING DAILY RISK AFTER LOSS" value={remainingDailyAfterLoss == null ? "—" : money.format(remainingDailyAfterLoss)} accent="purple" />
            <ResultCard icon="pie" title="DRAWDOWN USED BY TRADE" value={display.drawdownUsagePct == null ? "—" : `${display.drawdownUsagePct}%`} accent="purple" />

            <article className={`health-card ${healthClassName}`} tabIndex={0} aria-describedby="challenge-health-tooltip">
              <div className="health-title"><Icon name="pulse" />CHALLENGE HEALTH</div>
              <strong>{healthLabel}</strong>
              <span className="health-shield"><Icon name="shield" /></span>
              <span className="health-tooltip" id="challenge-health-tooltip" role="tooltip">{healthReason}</span>
            </article>
          </div>

          <section className="trade-summary">
            <div className="summary-header"><Icon name="briefcase" /><span>TRADE SUMMARY</span></div>
            <div className="summary-stats">
              <div><span>Instrument</span><strong>{instrument}</strong></div>
              <div><span>Direction</span><strong>{display.direction}</strong></div>
              <div><span>Contracts</span><strong>{display.maxContracts}</strong></div>
              <div><span>Max Risk</span><strong>{money.format(parsePositive(maxRisk) ?? 0)}</strong></div>
            </div>
            <p>Risk is calculated from your stop distance and converted to dollar risk per contract.</p>
          </section>

          {result && result.warnings.length > 0 && <div className="warnings">{result.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}

          <div className="spec-note">{spec.tickSize} pt tick · {money.format(spec.tickValue)} per tick · {money.format(spec.pointValue)} per point</div>
        </section>
      </form>

      <footer className="app-footer">
        <span>© 2026 Futures From Zero. All rights reserved.</span>
        <span className="footer-sep">|</span>
        <span>Trade well. Risk small. Consistency compounds.</span>
        <strong>FUTURES FROM <em>ZERO</em></strong>
      </footer>
    </main>
  );
}
