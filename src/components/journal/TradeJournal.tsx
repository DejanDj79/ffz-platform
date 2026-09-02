"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  createTradeViaApi,
  deleteTradeViaApi,
  fetchTrades,
  updateTradeViaApi,
} from "@/lib/journal/api-client";
import { calculateJournalStats } from "@/lib/journal/stats";
import type {
  JournalInstrument,
  TradeApiModel,
  TradeDirection,
  TradeEditableInput,
} from "@/lib/journal/types";
import styles from "./TradeJournal.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

type Draft = {
  challengeId: string;
  instrument: JournalInstrument;
  direction: TradeDirection;
  openedAt: string;
  closedAt: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  exitPrice: string;
  contracts: string;
  commissionFees: string;
  setup: string;
  tags: string;
  notes: string;
};

function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function blankDraft(): Draft {
  return {
    challengeId: "",
    instrument: "MNQ",
    direction: "LONG",
    openedAt: toLocalDateTimeInput(new Date()),
    closedAt: "",
    entryPrice: "",
    stopPrice: "",
    targetPrice: "",
    exitPrice: "",
    contracts: "1",
    commissionFees: "0",
    setup: "",
    tags: "",
    notes: "",
  };
}

function parseRequiredNumber(raw: string, label: string) {
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  return value;
}

function parseOptionalNumber(raw: string) {
  if (!raw.trim()) return null;
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Optional price values must be greater than 0.");
  }

  return value;
}

function parseNonNegativeNumber(raw: string, label: string) {
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function toIso(localValue: string) {
  const date = new Date(localValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  return date.toISOString();
}

function tradeToDraft(trade: TradeApiModel): Draft {
  return {
    challengeId: trade.challengeId ?? "",
    instrument: trade.instrument,
    direction: trade.direction,
    openedAt: toLocalDateTimeInput(new Date(trade.openedAt)),
    closedAt: trade.closedAt
      ? toLocalDateTimeInput(new Date(trade.closedAt))
      : "",
    entryPrice: String(trade.entryPrice),
    stopPrice: trade.stopPrice == null ? "" : String(trade.stopPrice),
    targetPrice: trade.targetPrice == null ? "" : String(trade.targetPrice),
    exitPrice: trade.exitPrice == null ? "" : String(trade.exitPrice),
    contracts: String(trade.contracts),
    commissionFees: String(trade.commissionFees),
    setup: trade.setup ?? "",
    tags: trade.tags.join(", "),
    notes: trade.notes ?? "",
  };
}

function challengeLabel(
  challengeId: string | null,
  challenges: Challenge[],
) {
  if (!challengeId) return "No challenge";

  const challenge = challenges.find(
    (item) => item.id === challengeId,
  );

  return challenge?.name ?? "Unknown challenge";
}

export function TradeJournal() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterInstrument, setFilterInstrument] = useState("ALL");
  const [filterOutcome, setFilterOutcome] = useState("ALL");
  const [filterChallenge, setFilterChallenge] = useState("ALL");

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [nextTrades, nextChallenges] = await Promise.all([
        fetchTrades(),
        fetchChallenges(),
      ]);

      setTrades(nextTrades);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Trade Journal.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const stats = useMemo(
    () => calculateJournalStats(trades),
    [trades],
  );

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (
        filterInstrument !== "ALL" &&
        trade.instrument !== filterInstrument
      ) {
        return false;
      }

      if (
        filterOutcome !== "ALL" &&
        (trade.outcome ?? "OPEN") !== filterOutcome
      ) {
        return false;
      }

      if (
        filterChallenge !== "ALL" &&
        (trade.challengeId ?? "NONE") !== filterChallenge
      ) {
        return false;
      }

      return true;
    });
  }, [
    trades,
    filterInstrument,
    filterOutcome,
    filterChallenge,
  ]);

  function resetForm() {
    setEditingId(null);
    setDraft(blankDraft());
    setError(null);
  }

  function beginEdit(trade: TradeApiModel) {
    setEditingId(trade.id);
    setDraft(tradeToDraft(trade));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildInput(): TradeEditableInput {
    const entryPrice = parseRequiredNumber(
      draft.entryPrice,
      "Entry Price",
    );

    const contracts = Number(draft.contracts);

    if (!Number.isInteger(contracts) || contracts <= 0) {
      throw new Error("Contracts must be a positive whole number.");
    }

    const hasExit = draft.exitPrice.trim() !== "";
    const hasClosedAt = draft.closedAt.trim() !== "";

    if (hasExit !== hasClosedAt) {
      throw new Error(
        "Closed trade requires both Exit Price and Closed At.",
      );
    }

    return {
      challengeId: draft.challengeId || null,
      tradingAccountId: null,

      instrument: draft.instrument,
      direction: draft.direction,

      openedAt: toIso(draft.openedAt),
      closedAt: hasClosedAt ? toIso(draft.closedAt) : null,

      entryPrice,
      stopPrice: parseOptionalNumber(draft.stopPrice),
      targetPrice: parseOptionalNumber(draft.targetPrice),
      exitPrice: parseOptionalNumber(draft.exitPrice),

      contracts,
      commissionFees: parseNonNegativeNumber(
        draft.commissionFees || "0",
        "Commission & Fees",
      ),

      setup: draft.setup.trim() || null,

      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),

      notes: draft.notes.trim() || null,
    };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const input = buildInput();

      if (editingId) {
        await updateTradeViaApi(editingId, input);
      } else {
        await createTradeViaApi(input);
      }

      resetForm();
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save trade.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(trade: TradeApiModel) {
    const ok = window.confirm(
      `Delete ${trade.instrument} trade from ${new Date(
        trade.openedAt,
      ).toLocaleString()}?`,
    );

    if (!ok) return;

    try {
      setError(null);
      await deleteTradeViaApi(trade.id);

      if (editingId === trade.id) {
        resetForm();
      }

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete trade.",
      );
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>NET P&amp;L</span>
          <strong
            className={
              stats.netPnl > 0
                ? styles.positive
                : stats.netPnl < 0
                  ? styles.negative
                  : ""
            }
          >
            {money.format(stats.netPnl)}
          </strong>
          <small>{stats.closedTrades} closed trades</small>
        </article>

        <article className={styles.statCard}>
          <span>WIN RATE</span>
          <strong>
            {stats.winRate == null ? "—" : `${stats.winRate}%`}
          </strong>
          <small>
            {stats.wins}W / {stats.losses}L / {stats.breakeven}BE
          </small>
        </article>

        <article className={styles.statCard}>
          <span>AVERAGE R</span>
          <strong>
            {stats.averageR == null
              ? "—"
              : `${stats.averageR > 0 ? "+" : ""}${number.format(
                  stats.averageR,
                )}R`}
          </strong>
          <small>Net P&amp;L / initial risk</small>
        </article>

        <article className={styles.statCard}>
          <span>PROFIT FACTOR</span>
          <strong>
            {stats.profitFactor == null
              ? "—"
              : stats.profitFactor === Infinity
                ? "∞"
                : number.format(stats.profitFactor)}
          </strong>
          <small>Gross wins / gross losses</small>
        </article>

        <article className={styles.statCard}>
          <span>TOTAL TRADES</span>
          <strong>{stats.totalTrades}</strong>
          <small>{stats.openTrades} currently open</small>
        </article>
      </section>

      <div className={styles.workspace}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <div>
              <span>{editingId ? "EDIT TRADE" : "NEW TRADE"}</span>
              <small>
                Execution facts are stored; P&amp;L and R are calculated
                by the server.
              </small>
            </div>
            {editingId && (
              <button
                type="button"
                className={styles.textButton}
                onClick={resetForm}
              >
                Cancel edit
              </button>
            )}
          </div>

          <form className={styles.form} onSubmit={save}>
            <div className={styles.formGrid}>
              <label className={styles.fieldWide}>
                <span>Challenge</span>
                <select
                  value={draft.challengeId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      challengeId: event.target.value,
                    }))
                  }
                >
                  <option value="">No challenge / personal</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name} — {challenge.propFirm}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Instrument</span>
                <select
                  value={draft.instrument}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      instrument: event.target
                        .value as JournalInstrument,
                    }))
                  }
                >
                  <option value="MNQ">MNQ</option>
                  <option value="MES">MES</option>
                  <option value="NQ">NQ</option>
                  <option value="ES">ES</option>
                </select>
              </label>

              <div className={styles.directionField}>
                <span>Direction</span>
                <div className={styles.directionToggle}>
                  <button
                    type="button"
                    className={
                      draft.direction === "LONG"
                        ? styles.activeLong
                        : ""
                    }
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        direction: "LONG",
                      }))
                    }
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    className={
                      draft.direction === "SHORT"
                        ? styles.activeShort
                        : ""
                    }
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        direction: "SHORT",
                      }))
                    }
                  >
                    SHORT
                  </button>
                </div>
              </div>

              <label>
                <span>Opened At</span>
                <input
                  type="datetime-local"
                  value={draft.openedAt}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      openedAt: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                <span>Closed At</span>
                <input
                  type="datetime-local"
                  value={draft.closedAt}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      closedAt: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Entry Price</span>
                <input
                  inputMode="decimal"
                  value={draft.entryPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      entryPrice: event.target.value,
                    }))
                  }
                  placeholder="20000.00"
                  required
                />
              </label>

              <label>
                <span>Stop Price</span>
                <input
                  inputMode="decimal"
                  value={draft.stopPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stopPrice: event.target.value,
                    }))
                  }
                  placeholder="optional"
                />
              </label>

              <label>
                <span>Target Price</span>
                <input
                  inputMode="decimal"
                  value={draft.targetPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetPrice: event.target.value,
                    }))
                  }
                  placeholder="optional"
                />
              </label>

              <label>
                <span>Exit Price</span>
                <input
                  inputMode="decimal"
                  value={draft.exitPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exitPrice: event.target.value,
                    }))
                  }
                  placeholder="leave empty if open"
                />
              </label>

              <label>
                <span>Contracts</span>
                <input
                  inputMode="numeric"
                  value={draft.contracts}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      contracts: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                <span>Commission &amp; Fees</span>
                <div className={styles.moneyInput}>
                  <b>$</b>
                  <input
                    inputMode="decimal"
                    value={draft.commissionFees}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        commissionFees: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>

              <label className={styles.fieldWide}>
                <span>Setup</span>
                <input
                  value={draft.setup}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      setup: event.target.value,
                    }))
                  }
                  placeholder="e.g. Opening range breakout"
                  maxLength={120}
                />
              </label>

              <label className={styles.fieldWide}>
                <span>Tags</span>
                <input
                  value={draft.tags}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="scalp, A+, trend"
                />
              </label>

              <label className={styles.fieldWide}>
                <span>Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="What did you see? What was done well? What would you change?"
                />
              </label>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={saving}
              >
                {saving
                  ? "SAVING..."
                  : editingId
                    ? "UPDATE TRADE"
                    : "SAVE TRADE"}
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={resetForm}
                disabled={saving}
              >
                RESET
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <div>
              <span>TRADE HISTORY</span>
              <small>
                {filteredTrades.length} of {trades.length} trades shown
              </small>
            </div>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => void loadAll()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <div className={styles.filters}>
            <select
              value={filterInstrument}
              onChange={(event) =>
                setFilterInstrument(event.target.value)
              }
            >
              <option value="ALL">All instruments</option>
              <option value="MNQ">MNQ</option>
              <option value="MES">MES</option>
              <option value="NQ">NQ</option>
              <option value="ES">ES</option>
            </select>

            <select
              value={filterOutcome}
              onChange={(event) => setFilterOutcome(event.target.value)}
            >
              <option value="ALL">All outcomes</option>
              <option value="WIN">Wins</option>
              <option value="LOSS">Losses</option>
              <option value="BREAKEVEN">Breakeven</option>
              <option value="OPEN">Open</option>
            </select>

            <select
              value={filterChallenge}
              onChange={(event) =>
                setFilterChallenge(event.target.value)
              }
            >
              <option value="ALL">All challenges</option>
              <option value="NONE">No challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.tableWrap}>
            {loading ? (
              <div className={styles.emptyState}>Loading trades...</div>
            ) : filteredTrades.length === 0 ? (
              <div className={styles.emptyState}>
                No trades match the current filters.
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Instrument</th>
                    <th>Side</th>
                    <th>Challenge</th>
                    <th>Contracts</th>
                    <th>Net P&amp;L</th>
                    <th>R</th>
                    <th>Outcome</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        <strong>
                          {new Date(trade.openedAt).toLocaleDateString()}
                        </strong>
                        <small>
                          {new Date(trade.openedAt).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </small>
                      </td>

                      <td>
                        <strong>{trade.instrument}</strong>
                        <small>{trade.setup || "No setup"}</small>
                      </td>

                      <td>
                        <span
                          className={
                            trade.direction === "LONG"
                              ? styles.longBadge
                              : styles.shortBadge
                          }
                        >
                          {trade.direction}
                        </span>
                      </td>

                      <td>
                        <span className={styles.challengeCell}>
                          {challengeLabel(
                            trade.challengeId,
                            challenges,
                          )}
                        </span>
                      </td>

                      <td>{trade.contracts}</td>

                      <td
                        className={
                          trade.netPnl == null
                            ? ""
                            : trade.netPnl > 0
                              ? styles.positive
                              : trade.netPnl < 0
                                ? styles.negative
                                : ""
                        }
                      >
                        {trade.netPnl == null
                          ? "—"
                          : money.format(trade.netPnl)}
                      </td>

                      <td>
                        {trade.rMultiple == null
                          ? "—"
                          : `${trade.rMultiple > 0 ? "+" : ""}${number.format(
                              trade.rMultiple,
                            )}R`}
                      </td>

                      <td>
                        <span
                          className={`${styles.outcomeBadge} ${
                            trade.status === "OPEN"
                              ? styles.open
                              : trade.outcome === "WIN"
                                ? styles.win
                                : trade.outcome === "LOSS"
                                  ? styles.loss
                                  : styles.be
                          }`}
                        >
                          {trade.status === "OPEN"
                            ? "OPEN"
                            : trade.outcome}
                        </span>
                      </td>

                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            onClick={() => beginEdit(trade)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(trade)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
