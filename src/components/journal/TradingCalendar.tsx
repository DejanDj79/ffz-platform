"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TradingCalendar.module.css";

type DailyPoint = {
  date: string;
  pnl: number;
  trades: number;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function signedMoney(value: number) {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

export function TradingCalendar({ points }: { points: DailyPoint[] }) {
  const latestMonth = useMemo(() => {
    const latest = points.at(-1)?.date;
    const date = latest ? new Date(`${latest}T12:00:00`) : new Date();
    return monthKey(date);
  }, [points]);

  const [visibleMonth, setVisibleMonth] = useState(latestMonth);

  useEffect(() => {
    setVisibleMonth(latestMonth);
  }, [latestMonth]);

  const month = monthFromKey(visibleMonth);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const pointMap = new Map(points.map((point) => [point.date, point]));
  const today = new Date();
  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: Array<{ day: number; key: string; point?: DailyPoint } | null> = [];

  for (let index = 0; index < mondayOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = isoDate(year, monthIndex, day);
    cells.push({ day, key, point: pointMap.get(key) });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setVisibleMonth(monthKey(next));
  }

  const monthTotal = points
    .filter((point) => point.date.startsWith(`${visibleMonth}-`))
    .reduce((sum, point) => sum + point.pnl, 0);

  const monthTrades = points
    .filter((point) => point.date.startsWith(`${visibleMonth}-`))
    .reduce((sum, point) => sum + point.trades, 0);

  return (
    <div className={styles.calendar}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
        <div>
          <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
          <small>{monthTrades} trades · <span className={monthTotal > 0 ? styles.positive : monthTotal < 0 ? styles.negative : ""}>{signedMoney(monthTotal)}</span></small>
        </div>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <div className={styles.emptyDay} key={`empty-${index}`} />;
          }

          const point = cell.point;
          const resultClass = !point
            ? styles.noTrade
            : point.pnl > 0
              ? styles.winDay
              : point.pnl < 0
                ? styles.lossDay
                : styles.flatDay;

          return (
            <div
              key={cell.key}
              className={`${styles.day} ${resultClass} ${cell.key === todayKey ? styles.today : ""}`}
              title={point ? `${cell.key}: ${signedMoney(point.pnl)} · ${point.trades} trades` : `${cell.key}: no trades`}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              {point ? (
                <>
                  <strong>{signedMoney(point.pnl)}</strong>
                  <small>{point.trades} {point.trades === 1 ? "trade" : "trades"}</small>
                </>
              ) : (
                <small className={styles.noTradeLabel}>—</small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
