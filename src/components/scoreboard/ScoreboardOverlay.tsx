"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PublicScoreboardData } from "@/lib/scoreboard/types";
import styles from "./ScoreboardOverlay.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const money2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function ScoreboardOverlay({
  overlayKey,
}: {
  overlayKey: string;
}) {
  const [data, setData] = useState<PublicScoreboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlBackground: html.style.background,
      bodyBackground: body.style.background,
      bodyMargin: body.style.margin,
      bodyOverflow: body.style.overflow,
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.margin = "0";
    body.style.overflow = "hidden";

    return () => {
      html.style.background = previous.htmlBackground;
      body.style.background = previous.bodyBackground;
      body.style.margin = previous.bodyMargin;
      body.style.overflow = previous.bodyOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/public/scoreboard/${overlayKey}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Scoreboard unavailable.");
        }

        const json = (await response.json()) as {
          data: PublicScoreboardData;
        };

        if (cancelled) return;

        setData(json.data);
        setFailed(false);

        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(
          () => void load(),
          Math.max(2, json.data.refreshSeconds) * 1000,
        );
      } catch {
        if (cancelled) return;

        setFailed(true);

        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(
          () => void load(),
          5000,
        );
      }
    }

    void load();

    return () => {
      cancelled = true;

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [overlayKey]);

  if (!data) {
    return failed ? (
      <div className={styles.errorBadge}>
        FFZ SCOREBOARD OFFLINE
      </div>
    ) : null;
  }

  if (!data.enabled) return null;

  return data.layout === "FULL" ? (
    <FullScoreboard data={data} />
  ) : (
    <CompactScoreboard data={data} />
  );
}

function Brand({ goalLabel }: { goalLabel: string }) {
  return (
    <div className={styles.brand}>
      <div className={styles.logoWrap}>
        <Image
          src="/ffz-logo.png"
          alt="Futures From Zero"
          width={320}
          height={95}
          className={styles.logo}
          priority
        />
      </div>

      <div className={styles.goal}>
        <span>SEASON 1 GOAL</span>
        <strong>{goalLabel}</strong>
      </div>
    </div>
  );
}

function CompactScoreboard({
  data,
}: {
  data: PublicScoreboardData;
}) {
  const challenge = data.challenge;

  return (
    <div className={styles.compactRoot}>
      <section className={styles.compactCard}>
        <Brand goalLabel={data.goalLabel} />

        <div className={styles.challengeLine}>
          <div>
            <span>CHALLENGE</span>
            <strong>{challenge?.name ?? "NO CHALLENGE"}</strong>
            <small>
              {challenge
                ? `${challenge.propFirm} · ${challenge.phase.replaceAll(
                    "_",
                    " ",
                  )}`
                : "FFZ PLATFORM"}
            </small>
          </div>

          {challenge && (
            <b>{challenge.status.replaceAll("_", " ")}</b>
          )}
        </div>

        <div className={styles.compactMetrics}>
          {data.showBalance && (
            <Metric
              label="BALANCE"
              value={
                challenge
                  ? money.format(challenge.currentBalance)
                  : "—"
              }
            />
          )}

          {data.showChallengePnl && (
            <Metric
              label="CHALLENGE P&L"
              value={
                challenge
                  ? `${challenge.pnl > 0 ? "+" : ""}${money2.format(
                      challenge.pnl,
                    )}`
                  : "—"
              }
              tone={
                challenge
                  ? challenge.pnl > 0
                    ? "positive"
                    : challenge.pnl < 0
                      ? "negative"
                      : "neutral"
                  : "neutral"
              }
            />
          )}

          {data.showWinRate && (
            <Metric
              label="WIN RATE"
              value={
                data.journal.winRate == null
                  ? "—"
                  : `${data.journal.winRate}%`
              }
            />
          )}

          {data.showRealMoneyNet && (
            <Metric
              label="REAL MONEY"
              value={`${
                data.ledger.netCashFlow > 0 ? "+" : ""
              }${money2.format(data.ledger.netCashFlow)}`}
              tone={
                data.ledger.netCashFlow > 0
                  ? "positive"
                  : data.ledger.netCashFlow < 0
                    ? "negative"
                    : "neutral"
              }
            />
          )}
        </div>

        {data.showTargetProgress && challenge && (
          <Progress
            value={challenge.targetProgressPct}
            remaining={challenge.targetRemaining}
          />
        )}

        <div className={styles.compactFooter}>
          {data.showTradeCount && (
            <span>
              TRADES <b>{data.journal.totalTrades}</b>
            </span>
          )}

          {data.showAverageR && (
            <span>
              AVG R{" "}
              <b>
                {data.journal.averageR == null
                  ? "—"
                  : `${
                      data.journal.averageR > 0 ? "+" : ""
                    }${number.format(data.journal.averageR)}R`}
              </b>
            </span>
          )}

          {data.showRealPayouts && (
            <span>
              PAYOUTS <b>{money2.format(data.ledger.payouts)}</b>
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function FullScoreboard({
  data,
}: {
  data: PublicScoreboardData;
}) {
  const challenge = data.challenge;

  return (
    <div className={styles.fullRoot}>
      <section className={styles.fullCard}>
        <div className={styles.fullBrand}>
          <Brand goalLabel={data.goalLabel} />
        </div>

        <div className={styles.fullChallenge}>
          <span>ACTIVE CHALLENGE</span>
          <strong>{challenge?.name ?? "NO CHALLENGE"}</strong>
          <small>
            {challenge
              ? `${challenge.propFirm} · ${challenge.phase.replaceAll(
                  "_",
                  " ",
                )} · ${challenge.status.replaceAll("_", " ")}`
              : "FFZ PLATFORM"}
          </small>
        </div>

        <div className={styles.fullMetrics}>
          {data.showBalance && (
            <Metric
              label="BALANCE"
              value={
                challenge
                  ? money.format(challenge.currentBalance)
                  : "—"
              }
            />
          )}

          {data.showChallengePnl && (
            <Metric
              label="CHALLENGE P&L"
              value={
                challenge
                  ? `${challenge.pnl > 0 ? "+" : ""}${money2.format(
                      challenge.pnl,
                    )}`
                  : "—"
              }
              tone={
                challenge
                  ? challenge.pnl > 0
                    ? "positive"
                    : challenge.pnl < 0
                      ? "negative"
                      : "neutral"
                  : "neutral"
              }
            />
          )}

          {data.showTradeCount && (
            <Metric
              label="TRADES"
              value={String(data.journal.totalTrades)}
            />
          )}

          {data.showWinRate && (
            <Metric
              label="WIN RATE"
              value={
                data.journal.winRate == null
                  ? "—"
                  : `${data.journal.winRate}%`
              }
            />
          )}

          {data.showAverageR && (
            <Metric
              label="AVERAGE R"
              value={
                data.journal.averageR == null
                  ? "—"
                  : `${
                      data.journal.averageR > 0 ? "+" : ""
                    }${number.format(data.journal.averageR)}R`
              }
            />
          )}

          {data.showRealMoneyNet && (
            <Metric
              label="REAL MONEY NET"
              value={`${
                data.ledger.netCashFlow > 0 ? "+" : ""
              }${money2.format(data.ledger.netCashFlow)}`}
              tone={
                data.ledger.netCashFlow > 0
                  ? "positive"
                  : data.ledger.netCashFlow < 0
                    ? "negative"
                    : "neutral"
              }
            />
          )}

          {data.showRealPayouts && (
            <Metric
              label="REAL PAYOUTS"
              value={money2.format(data.ledger.payouts)}
              tone={
                data.ledger.payouts > 0
                  ? "positive"
                  : "neutral"
              }
            />
          )}
        </div>

        {data.showTargetProgress && challenge && (
          <div className={styles.fullProgress}>
            <Progress
              value={challenge.targetProgressPct}
              remaining={challenge.targetRemaining}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong
        className={
          tone === "positive"
            ? styles.positive
            : tone === "negative"
              ? styles.negative
              : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

function Progress({
  value,
  remaining,
}: {
  value: number;
  remaining: number;
}) {
  return (
    <div className={styles.progress}>
      <div className={styles.progressLabels}>
        <span>PROFIT TARGET</span>
        <strong>{number.format(value)}%</strong>
        <small>{money2.format(remaining)} remaining</small>
      </div>

      <div className={styles.progressTrack}>
        <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
