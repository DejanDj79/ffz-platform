"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  PublicScoreboardData,
  ScoreboardCalendarDay,
} from "@/lib/scoreboard/types";
import styles from "./ScoreboardOverlay.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const money0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
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

        if (!response.ok) throw new Error();

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
      <div className={styles.offline}>FFZ SCOREBOARD OFFLINE</div>
    ) : null;
  }

  if (!data.enabled) return null;

  return data.layout === "COMPACT" ? (
    <CompactBoard data={data} />
  ) : (
    <PremiereBoard data={data} />
  );
}

function PremiereBoard({ data }: { data: PublicScoreboardData }) {
  const challenge = data.challenge;
  const pnlTone = challenge
    ? challenge.pnl > 0
      ? "positive"
      : challenge.pnl < 0
        ? "negative"
        : undefined
    : undefined;

  const startDate = data.startDate
    ? new Date(data.startDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className={styles.fullCanvas}>
      <section className={styles.premiereBoard}>
        <header className={styles.topHeader}>
          <div className={styles.brandBlock}>
            <Image
              src="/ffz-logo.png"
              alt="Futures From Zero"
              width={600}
              height={200}
              priority
              className={styles.logo}
            />
          </div>

          <div className={styles.titleBlock}>
            <span>SCOREBOARD</span>
            <h1>Futures From Zero</h1>
          </div>

          <div className={styles.dayBlock}>
            <div>
              <span>SEASON</span>
              <strong>01</strong>
            </div>
            <div>
              <span>DAY</span>
              <strong>{data.currentDay}</strong>
            </div>
          </div>
        </header>

        <section className={styles.summaryRow}>
          <SummaryTile
            icon="shield"
            title="ACCOUNT STATUS"
            value={formatState(challenge?.status ?? "WAITING")}
          />

          <SummaryTile
            icon="target"
            title="CURRENT PHASE"
            value={formatState(challenge?.phase ?? "NO PHASE")}
          />

          <SummaryTile
            icon="bars"
            title="CURRENT P&L"
            value={challenge ? signedMoney(challenge.pnl) : money.format(0)}
            sub="ALL TIME"
            valueTone={pnlTone}
          />

          <SummaryTile
            icon="trophy"
            title="GOAL"
            value={data.goalLabel}
            sub={
              data.ledger.payouts > 0
                ? `ACHIEVED · ${money.format(data.ledger.payouts)}`
                : "SEASON 1"
            }
          />
        </section>

        <section className={styles.middleRow}>
          <Panel
            tone="blue"
            icon="clipboard"
            title="CHALLENGE DETAILS"
            className={styles.challengeDetails}
          >
            <DetailsRow label="PROP FIRM" value={challenge?.propFirm ?? "—"} />
            <DetailsRow
              label="ACCOUNT SIZE"
              value={challenge ? money0.format(challenge.accountSize) : "—"}
            />
            <DetailsRow
              label="PROFIT TARGET"
              value={
                challenge
                  ? `${money0.format(challenge.profitTarget)} · ${number.format(challenge.profitTargetPct)}%`
                  : "—"
              }
            />
            <DetailsRow
              label="MAX DAILY LOSS"
              value={
                challenge?.dailyLossLimit == null
                  ? "N/A"
                  : `${money0.format(challenge.dailyLossLimit)} · ${number.format(challenge.dailyLossLimitPct ?? 0)}%`
              }
            />
            <DetailsRow
              label="MAX DRAWDOWN"
              value={
                challenge
                  ? `${money0.format(challenge.maxDrawdown)} · ${number.format(challenge.maxDrawdownPct)}%`
                  : "—"
              }
            />
            <DetailsRow label="TRADING STYLE" value={data.tradingStyle} />
            <DetailsRow label="INSTRUMENTS" value={data.instrumentsLabel} />
            <DetailsRow label="START DATE" value={startDate.toUpperCase()} />
          </Panel>

          <Panel
            tone="purple"
            icon="trend"
            title="PERFORMANCE"
            className={styles.performancePanel}
          >
            <div className={styles.performanceGrid}>
              <PerformanceMetric
                label="TOTAL TRADES"
                value={String(data.journal.totalTrades)}
                tone="cyan"
              />
              <PerformanceMetric
                label="WIN RATE"
                value={data.journal.winRate == null ? "—" : `${data.journal.winRate}%`}
                tone="cyan"
              />
              <PerformanceMetric
                label="WINS"
                value={String(data.journal.wins)}
                tone="green"
              />
              <PerformanceMetric
                label="LOSSES"
                value={String(data.journal.losses)}
                tone="red"
              />
              <PerformanceMetric
                label="BEST TRADE"
                value={nullableMoney(data.performance.bestTrade)}
                tone="green"
              />
              <PerformanceMetric
                label="WORST TRADE"
                value={nullableMoney(data.performance.worstTrade)}
                tone="red"
              />
              <PerformanceMetric
                label="AVG WIN"
                value={nullableMoney(data.performance.averageWin)}
                tone="green"
              />
              <PerformanceMetric
                label="AVG LOSS"
                value={nullableMoney(data.performance.averageLoss)}
                tone="red"
              />
            </div>
          </Panel>
        </section>

        <section className={styles.bottomRow}>
          <Panel
            tone="blue"
            icon="calendar"
            title="DAILY RESULTS"
            trailing={data.calendar.label}
            className={styles.calendarPanel}
          >
            <Calendar days={data.calendar.days} />
          </Panel>

          <Panel
            tone="blue"
            icon="notes"
            title="NOTES"
            className={styles.notesPanel}
          >
            <Notes
              value={
                data.scoreboardNotes ||
                challenge?.name ||
                "One trade at a time."
              }
            />

            <div className={styles.realMoneyMini}>
              <span>REAL MONEY NET</span>
              <strong
                className={
                  data.ledger.netCashFlow > 0
                    ? styles.positive
                    : data.ledger.netCashFlow < 0
                      ? styles.negative
                      : ""
                }
              >
                {signedMoney(data.ledger.netCashFlow)}
              </strong>
              <span>REAL PAYOUTS</span>
              <strong className={data.ledger.payouts > 0 ? styles.positive : ""}>
                {money.format(data.ledger.payouts)}
              </strong>
            </div>
          </Panel>
        </section>

        <footer className={styles.boardFooter}>
          <span>DISCIPLINE · RULES · CONSISTENCY</span>
          <strong>ONE TRADE AT A TIME.</strong>
          <span>FUTURES FROM ZERO</span>
        </footer>
      </section>
    </div>
  );
}

function CompactBoard({ data }: { data: PublicScoreboardData }) {
  const challenge = data.challenge;
  const hasCompactStats =
    data.showBalance ||
    data.showTradeCount ||
    data.showWinRate ||
    data.showAverageR ||
    data.showRealMoneyNet ||
    data.showRealPayouts;

  return (
    <div className={styles.compactCanvas}>
      <section className={styles.compactBoard}>
        <div className={styles.compactHeader}>
          <Image
            src="/ffz-logo.png"
            alt="FFZ"
            width={180}
            height={70}
            priority
            className={styles.compactLogo}
          />
          <div>
            <span>SEASON 1 · DAY {data.currentDay}</span>
            <strong>{data.goalLabel}</strong>
          </div>
        </div>

        <div className={styles.compactChallenge}>
          <div>
            <span>CHALLENGE</span>
            <strong>{challenge?.name ?? "NO CHALLENGE"}</strong>
            <small>
              {challenge
                ? `${challenge.propFirm} · ${formatState(challenge.status)}`
                : "FFZ PLATFORM"}
            </small>
          </div>

          {data.showChallengePnl && (
            <b
              className={
                challenge && challenge.pnl > 0
                  ? styles.positive
                  : challenge && challenge.pnl < 0
                    ? styles.negative
                    : ""
              }
            >
              {challenge ? signedMoney(challenge.pnl) : money.format(0)}
            </b>
          )}
        </div>

        {hasCompactStats && (
          <div className={styles.compactStats}>
            {data.showBalance && (
              <MiniStat
                label="BALANCE"
                value={challenge ? money0.format(challenge.currentBalance) : "—"}
              />
            )}
            {data.showTradeCount && (
              <MiniStat label="TRADES" value={String(data.journal.totalTrades)} />
            )}
            {data.showWinRate && (
              <MiniStat
                label="WIN RATE"
                value={data.journal.winRate == null ? "—" : `${data.journal.winRate}%`}
              />
            )}
            {data.showAverageR && (
              <MiniStat
                label="AVERAGE R"
                value={data.journal.averageR == null ? "—" : `${number.format(data.journal.averageR)}R`}
              />
            )}
            {data.showRealMoneyNet && (
              <MiniStat
                label="REAL MONEY"
                value={signedMoney(data.ledger.netCashFlow)}
                tone={
                  data.ledger.netCashFlow > 0
                    ? "green"
                    : data.ledger.netCashFlow < 0
                      ? "red"
                      : "blue"
                }
              />
            )}
            {data.showRealPayouts && (
              <MiniStat
                label="PAYOUTS"
                value={money.format(data.ledger.payouts)}
                tone={data.ledger.payouts > 0 ? "green" : "blue"}
              />
            )}
          </div>
        )}

        {challenge && data.showTargetProgress && (
          <div className={styles.compactProgress}>
            <div>
              <span>PROFIT TARGET</span>
              <strong>{number.format(challenge.targetProgressPct)}%</strong>
            </div>
            <div>
              <i style={{ width: `${challenge.targetProgressPct}%` }} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({
  icon,
  title,
  value,
  sub,
  valueTone,
}: {
  icon: IconName;
  title: string;
  value: string;
  sub?: string;
  valueTone?: "positive" | "negative";
}) {
  return (
    <article className={styles.summaryTile}>
      <div className={styles.summaryIcon}>
        <Icon name={icon} />
      </div>
      <div>
        <span>{title}</span>
        <strong
          className={
            valueTone === "positive"
              ? styles.positive
              : valueTone === "negative"
                ? styles.negative
                : ""
          }
        >
          {value}
        </strong>
        {sub && <small>{sub}</small>}
      </div>
    </article>
  );
}

function Panel({
  tone,
  icon,
  title,
  trailing,
  className = "",
  children,
}: {
  tone: "blue" | "purple";
  icon: IconName;
  title: string;
  trailing?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`${styles.panel} ${styles[`panel_${tone}`]} ${className}`}>
      <header>
        <div>
          <Icon name={icon} />
          <strong>{title}</strong>
        </div>
        {trailing && <span>{trailing}</span>}
      </header>
      {children}
    </article>
  );
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailsRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PerformanceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "red";
}) {
  return (
    <div className={`${styles.performanceMetric} ${styles[`metric_${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Calendar({ days }: { days: ScoreboardCalendarDay[] }) {
  return (
    <div className={styles.calendar}>
      <div className={styles.calendarDays}>
        {days.map((item) => <div key={`number-${item.day}`}>{item.day}</div>)}
      </div>

      <div className={styles.calendarResults}>
        {days.map((item) => (
          <div
            key={`result-${item.day}`}
            className={
              item.status === "PROFIT"
                ? styles.calendarProfit
                : item.status === "LOSS"
                  ? styles.calendarLoss
                  : item.status === "NO_TRADE"
                    ? styles.calendarNoTrade
                    : item.status === "FUTURE"
                      ? styles.calendarFuture
                      : styles.calendarOutside
            }
            title={
              item.status === "PROFIT" || item.status === "LOSS"
                ? `${item.day}: ${signedMoney(item.pnl)}`
                : item.status.replaceAll("_", " ")
            }
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span><i className={styles.legendProfit} /> PROFIT</span>
        <span><i className={styles.legendLoss} /> LOSS</span>
        <span><i className={styles.legendNoTrade} /> NO TRADE</span>
      </div>
    </div>
  );
}

function Notes({ value }: { value: string }) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className={styles.notes}>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index}><span>{lines[index] ?? ""}</span></div>
      ))}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "red";
}) {
  return (
    <div className={styles.miniStat}>
      <span>{label}</span>
      <strong
        className={
          tone === "green"
            ? styles.positive
            : tone === "red"
              ? styles.negative
              : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

type IconName =
  | "shield"
  | "target"
  | "bars"
  | "trophy"
  | "clipboard"
  | "trend"
  | "calendar"
  | "notes";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    shield: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />,
    target: <><circle cx="11" cy="13" r="7" /><circle cx="11" cy="13" r="3" /><path d="M14 10l7-7M16 3h5v5" /></>,
    bars: <><path d="M4 20V13h4v7M10 20V8h4v12M16 20V4h4v16" /></>,
    trophy: <><path d="M8 4h8v4c0 4-2 6-4 7-2-1-4-3-4-7V4z" /><path d="M8 6H4c0 4 2 6 5 6M16 6h4c0 4-2 6-5 6M12 15v4M8 21h8" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 10h6M9 14h6M9 18h4" /></>,
    trend: <path d="M3 18l6-6 4 3 8-9M16 6h5v5" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" /></>,
    notes: <><rect x="5" y="4" width="13" height="17" rx="2" /><path d="M8 8h7M8 12h7M8 16h5M18 15l3 3-4 4" /></>,
  };

  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}

function nullableMoney(value: number | null) {
  return value == null ? "—" : signedMoney(value);
}

function formatState(value: string) {
  return value.replaceAll("_", " ");
}
