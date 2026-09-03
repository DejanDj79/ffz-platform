"use client";

import type { JournalBreakdownRow } from "@/lib/journal/analytics";
import { ALL_SETUPS } from "@/lib/journal/setup-analytics";
import styles from "./SetupAnalyticsPanel.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

function ratio(value: number | null) {
  if (value == null) return "—";
  if (value === Infinity) return "∞";
  return number.format(value);
}

function pnlClass(value: number) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}

function SetupRows({
  rows,
  selectedSetup,
  onSelectSetup,
}: {
  rows: JournalBreakdownRow[];
  selectedSetup: string;
  onSelectSetup: (setup: string) => void;
}) {
  if (rows.length === 0) {
    return <div className={styles.empty}>Add Setup names to Journal trades to compare ORB, IVB and other playbooks.</div>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>SETUP</th>
            <th>TRADES</th>
            <th>WIN RATE</th>
            <th>EXPECTANCY</th>
            <th>AVG R</th>
            <th>PROFIT FACTOR</th>
            <th>NET P&amp;L</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = row.label === selectedSetup;
            return (
              <tr key={row.key} className={active ? styles.activeRow : ""}>
                <td><strong>{row.label}</strong></td>
                <td>{row.trades}</td>
                <td>{row.winRate == null ? "—" : `${row.winRate}%`}</td>
                <td className={pnlClass(row.averagePnl ?? 0)}>{row.averagePnl == null ? "—" : signedMoney(row.averagePnl)}</td>
                <td>{row.averageR == null ? "—" : `${row.averageR > 0 ? "+" : ""}${number.format(row.averageR)}R`}</td>
                <td>{ratio(row.profitFactor)}</td>
                <td className={pnlClass(row.netPnl)}>{signedMoney(row.netPnl)}</td>
                <td>
                  <button type="button" onClick={() => onSelectSetup(active ? ALL_SETUPS : row.label)}>
                    {active ? "CLEAR" : "VIEW"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimeRows({ rows }: { rows: JournalBreakdownRow[] }) {
  if (rows.length === 0) {
    return <div className={styles.empty}>No closed trades for the current setup and filters.</div>;
  }

  return (
    <div className={styles.timeRows}>
      {rows.map((row) => (
        <div key={row.key} className={styles.timeRow}>
          <div>
            <strong>{row.label}</strong>
            <small>{row.trades} trade{row.trades === 1 ? "" : "s"}</small>
          </div>
          <div>
            <span>WIN RATE</span>
            <strong>{row.winRate == null ? "—" : `${row.winRate}%`}</strong>
          </div>
          <div>
            <span>AVG R</span>
            <strong>{row.averageR == null ? "—" : `${row.averageR > 0 ? "+" : ""}${number.format(row.averageR)}R`}</strong>
          </div>
          <div>
            <span>PF</span>
            <strong>{ratio(row.profitFactor)}</strong>
          </div>
          <div>
            <span>NET P&amp;L</span>
            <strong className={pnlClass(row.netPnl)}>{signedMoney(row.netPnl)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SetupAnalyticsPanel({
  selectedSetup,
  comparisonRows,
  timeOfDayRows,
  onSelectSetup,
}: {
  selectedSetup: string;
  comparisonRows: JournalBreakdownRow[];
  timeOfDayRows: JournalBreakdownRow[];
  onSelectSetup: (setup: string) => void;
}) {
  const focusLabel = selectedSetup === ALL_SETUPS ? "ALL SETUPS" : selectedSetup;

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span>SETUP EDGE</span>
          <strong>{focusLabel}</strong>
          <small>
            Compare playbooks, then focus the entire Analytics page on one setup. Timing uses trade entry time in America/New_York.
          </small>
        </div>
        {selectedSetup !== ALL_SETUPS && (
          <button type="button" onClick={() => onSelectSetup(ALL_SETUPS)}>SHOW ALL SETUPS</button>
        )}
      </header>

      <div className={styles.body}>
        <article className={styles.comparison}>
          <div className={styles.sectionTitle}>
            <div>
              <span>SETUP COMPARISON</span>
              <small>Choose VIEW to make a setup the active filter.</small>
            </div>
          </div>
          <SetupRows rows={comparisonRows} selectedSetup={selectedSetup} onSelectSetup={onSelectSetup} />
        </article>

        <article className={styles.timing}>
          <div className={styles.sectionTitle}>
            <div>
              <span>TIME OF DAY</span>
              <small>{selectedSetup === ALL_SETUPS ? "All current filtered trades" : `${selectedSetup} entry performance by New York time`}</small>
            </div>
          </div>
          <TimeRows rows={timeOfDayRows} />
        </article>
      </div>
    </section>
  );
}
