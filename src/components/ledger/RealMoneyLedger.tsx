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
  createLedgerEntryViaApi,
  deleteLedgerEntryViaApi,
  fetchLedgerEntries,
  updateLedgerEntryViaApi,
} from "@/lib/ledger/api-client";
import {
  CATEGORY_LABELS,
  categoriesForType,
} from "@/lib/ledger/presentation";
import { calculateLedgerStats } from "@/lib/ledger/stats";
import type {
  LedgerCategory,
  LedgerEntryApiModel,
  LedgerEntryInput,
  LedgerEntryType,
} from "@/lib/ledger/types";
import styles from "./RealMoneyLedger.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type Draft = {
  challengeId: string;
  entryType: LedgerEntryType;
  category: LedgerCategory;
  occurredAt: string;
  amount: string;
  currency: string;
  provider: string;
  description: string;
  reference: string;
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
    entryType: "EXPENSE",
    category: "CHALLENGE_FEE",
    occurredAt: toLocalDateTimeInput(new Date()),
    amount: "",
    currency: "USD",
    provider: "",
    description: "",
    reference: "",
    notes: "",
  };
}

function toIso(localValue: string) {
  const date = new Date(localValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  return date.toISOString();
}

function entryToDraft(entry: LedgerEntryApiModel): Draft {
  return {
    challengeId: entry.challengeId ?? "",
    entryType: entry.entryType,
    category: entry.category,
    occurredAt: toLocalDateTimeInput(new Date(entry.occurredAt)),
    amount: String(entry.amount),
    currency: entry.currency,
    provider: entry.provider ?? "",
    description: entry.description ?? "",
    reference: entry.reference ?? "",
    notes: entry.notes ?? "",
  };
}

function challengeLabel(
  challengeId: string | null,
  challenges: Challenge[],
) {
  if (!challengeId) return "General";

  const challenge = challenges.find(
    (item) => item.id === challengeId,
  );

  return challenge?.name ?? "Unknown challenge";
}

export function RealMoneyLedger() {
  const [entries, setEntries] = useState<LedgerEntryApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterChallenge, setFilterChallenge] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [nextEntries, nextChallenges] = await Promise.all([
        fetchLedgerEntries(),
        fetchChallenges(),
      ]);

      setEntries(nextEntries);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Real Money Ledger.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!editorOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setEditingId(null);
        setDraft(blankDraft());
        setError(null);
        setEditorOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editorOpen, saving]);

  const stats = useMemo(
    () => calculateLedgerStats(entries),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (
        filterType !== "ALL" &&
        entry.entryType !== filterType
      ) {
        return false;
      }

      if (
        filterCategory !== "ALL" &&
        entry.category !== filterCategory
      ) {
        return false;
      }

      if (
        filterChallenge !== "ALL" &&
        (entry.challengeId ?? "NONE") !== filterChallenge
      ) {
        return false;
      }

      if (query) {
        const searchable = [
          entry.provider,
          entry.description,
          entry.reference,
          entry.notes,
          challengeLabel(entry.challengeId, challenges),
          CATEGORY_LABELS[entry.category],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    entries,
    challenges,
    filterType,
    filterCategory,
    filterChallenge,
    searchQuery,
  ]);

  const availableCategories = categoriesForType(draft.entryType);
  const filtersActive = filterType !== "ALL"
    || filterCategory !== "ALL"
    || filterChallenge !== "ALL"
    || searchQuery.trim().length > 0;

  function openNewEntry() {
    setEditingId(null);
    setDraft(blankDraft());
    setError(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditingId(null);
    setDraft(blankDraft());
    setError(null);
    setEditorOpen(false);
  }

  function beginEdit(entry: LedgerEntryApiModel) {
    setEditingId(entry.id);
    setDraft(entryToDraft(entry));
    setError(null);
    setEditorOpen(true);
  }

  function clearFilters() {
    setFilterType("ALL");
    setFilterCategory("ALL");
    setFilterChallenge("ALL");
    setSearchQuery("");
  }

  function changeEntryType(nextType: LedgerEntryType) {
    const nextCategories = categoriesForType(nextType);

    setDraft((current) => ({
      ...current,
      entryType: nextType,
      category: nextCategories[0],
    }));
  }

  function buildInput(): LedgerEntryInput {
    const amount = Number(draft.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0.");
    }

    const currency = draft.currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Currency must use a 3-letter code such as USD.");
    }

    return {
      challengeId: draft.challengeId || null,
      tradingAccountId: null,
      entryType: draft.entryType,
      category: draft.category,
      occurredAt: toIso(draft.occurredAt),
      amount,
      currency,
      provider: draft.provider.trim() || null,
      description: draft.description.trim() || null,
      reference: draft.reference.trim() || null,
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
        await updateLedgerEntryViaApi(editingId, input);
      } else {
        await createLedgerEntryViaApi(input);
      }

      setEditorOpen(false);
      setEditingId(null);
      setDraft(blankDraft());
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save ledger entry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: LedgerEntryApiModel) {
    const ok = window.confirm(
      `Delete ${CATEGORY_LABELS[entry.category]} entry for ${money.format(
        entry.amount,
      )}?`,
    );

    if (!ok) return;

    try {
      setError(null);
      await deleteLedgerEntryViaApi(entry.id);

      if (editingId === entry.id) {
        closeEditor();
      }

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete ledger entry.",
      );
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>REAL MONEY NET</span>
          <strong
            className={
              stats.netCashFlow > 0
                ? styles.positive
                : stats.netCashFlow < 0
                  ? styles.negative
                  : ""
            }
          >
            {money.format(stats.netCashFlow)}
          </strong>
          <small>Income minus real expenses</small>
        </article>

        <article className={styles.statCard}>
          <span>TOTAL PAID</span>
          <strong className={styles.negative}>
            {money.format(stats.totalExpenses)}
          </strong>
          <small>Money actually spent</small>
        </article>

        <article className={styles.statCard}>
          <span>TOTAL RECEIVED</span>
          <strong className={styles.positive}>
            {money.format(stats.totalIncome)}
          </strong>
          <small>Payouts, refunds and other income</small>
        </article>

        <article className={styles.statCard}>
          <span>REAL PAYOUTS</span>
          <strong className={styles.positive}>
            {money.format(stats.payouts)}
          </strong>
          <small>Confirmed payout income</small>
        </article>

        <article className={styles.statCard}>
          <span>CHALLENGE COSTS</span>
          <strong>{money.format(stats.challengeCosts)}</strong>
          <small>Fees, resets and activations</small>
        </article>
      </section>

      {error && !editorOpen && <p className={styles.pageError}>{error}</p>}

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div>
            <span>REAL MONEY HISTORY</span>
            <small>
              {filteredEntries.length} of {entries.length} entries shown
            </small>
          </div>

          <div className={styles.historyActions}>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => void loadAll()}
              disabled={loading}
            >
              REFRESH
            </button>
            <button
              type="button"
              className={styles.newEntryButton}
              onClick={openNewEntry}
            >
              + NEW ENTRY
            </button>
          </div>
        </div>

        <div className={styles.filters}>
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="ALL">All money directions</option>
            <option value="EXPENSE">Expenses</option>
            <option value="INCOME">Income</option>
          </select>

          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
          >
            <option value="ALL">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
              <option key={category} value={category}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterChallenge}
            onChange={(event) => setFilterChallenge(event.target.value)}
          >
            <option value="ALL">All challenges</option>
            <option value="NONE">General / no challenge</option>
            {challenges.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.name}
              </option>
            ))}
          </select>

          <input
            className={styles.searchInput}
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search provider, description, reference..."
            aria-label="Search ledger entries"
          />

          <button
            type="button"
            className={styles.clearButton}
            onClick={clearFilters}
            disabled={!filtersActive}
          >
            CLEAR
          </button>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.emptyState}>
              Loading ledger...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>
              No ledger entries match the current filters.
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Challenge</th>
                  <th>Provider</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>
                        {new Date(entry.occurredAt).toLocaleDateString()}
                      </strong>
                      <small>
                        {new Date(entry.occurredAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>

                    <td>
                      <span
                        className={
                          entry.entryType === "INCOME"
                            ? styles.incomeBadge
                            : styles.expenseBadge
                        }
                      >
                        {entry.entryType}
                      </span>
                    </td>

                    <td>
                      <span className={styles.categoryCell}>
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    </td>

                    <td>
                      <span className={styles.challengeCell}>
                        {challengeLabel(entry.challengeId, challenges)}
                      </span>
                    </td>

                    <td>{entry.provider || "—"}</td>

                    <td>
                      <span className={styles.descriptionCell}>
                        {entry.description || "—"}
                      </span>
                    </td>

                    <td
                      className={
                        entry.entryType === "INCOME"
                          ? styles.positive
                          : styles.negative
                      }
                    >
                      {entry.entryType === "INCOME" ? "+" : "-"}
                      {money.format(entry.amount)}
                    </td>

                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          onClick={() => beginEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(entry)}
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

      {editorOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeEditor();
            }
          }}
        >
          <section
            className={styles.editorModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-editor-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span id="ledger-editor-title">
                  {editingId ? "EDIT LEDGER ENTRY" : "NEW LEDGER ENTRY"}
                </span>
                <small>Record only money that actually left or entered your pocket.</small>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeEditor}
                disabled={saving}
                aria-label="Close ledger editor"
              >
                ×
              </button>
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
                    <option value="">General / not linked to a challenge</option>
                    {challenges.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>
                        {challenge.name} — {challenge.propFirm}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.typeField}>
                  <span>Money Direction</span>
                  <div className={styles.typeToggle}>
                    <button
                      type="button"
                      className={draft.entryType === "EXPENSE" ? styles.activeExpense : ""}
                      onClick={() => changeEntryType("EXPENSE")}
                    >
                      EXPENSE
                    </button>
                    <button
                      type="button"
                      className={draft.entryType === "INCOME" ? styles.activeIncome : ""}
                      onClick={() => changeEntryType("INCOME")}
                    >
                      INCOME
                    </button>
                  </div>
                </div>

                <label>
                  <span>Category</span>
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        category: event.target.value as LedgerCategory,
                      }))
                    }
                  >
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Date &amp; Time</span>
                  <input
                    type="datetime-local"
                    value={draft.occurredAt}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        occurredAt: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Amount</span>
                  <div className={styles.moneyInput}>
                    <b>$</b>
                    <input
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      placeholder="65.00"
                      required
                    />
                  </div>
                </label>

                <label>
                  <span>Currency</span>
                  <input
                    value={draft.currency}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    maxLength={3}
                    placeholder="USD"
                    required
                  />
                </label>

                <label>
                  <span>Provider / Company</span>
                  <input
                    value={draft.provider}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        provider: event.target.value,
                      }))
                    }
                    placeholder="Blue Guardian Futures"
                    maxLength={160}
                  />
                </label>

                <label className={styles.fieldWide}>
                  <span>Description</span>
                  <input
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="e.g. Standard 25K challenge purchase"
                    maxLength={240}
                  />
                </label>

                <label className={styles.fieldWide}>
                  <span>Reference</span>
                  <input
                    value={draft.reference}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="optional invoice, payout or transaction reference"
                    maxLength={160}
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
                    rows={4}
                    placeholder="Anything useful for the public Real Money Ledger story."
                  />
                </label>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeEditor}
                  disabled={saving}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : editingId
                      ? "UPDATE ENTRY"
                      : "SAVE ENTRY"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
