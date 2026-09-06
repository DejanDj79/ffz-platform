"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import {
  createTradeViaApi,
  deleteTradeAttachmentViaApi,
  deleteTradeViaApi,
  fetchTradeAttachments,
  fetchTrades,
  tradeAttachmentImageUrl,
  updateTradeViaApi,
  uploadTradeAttachments,
} from "@/lib/journal/api-client";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TRADE,
} from "@/lib/journal/attachments-validation";
import { calculateJournalStats } from "@/lib/journal/stats";
import type {
  JournalInstrument,
  TradeApiModel,
  TradeAttachmentApiModel,
  TradeDirection,
  TradeEditableInput,
} from "@/lib/journal/types";
import styles from "./TradeJournal.module.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

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

type QueuedImage = { id: string; file: File; previewUrl: string };
type LightboxImage = { id: string; src: string; label: string };
type LightboxState = { images: LightboxImage[]; index: number };

function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate()),
    "T", pad(date.getHours()), ":", pad(date.getMinutes()),
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
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than 0.`);
  return value;
}

function parseOptionalNumber(raw: string) {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Optional price values must be greater than 0.");
  return value;
}

function parseNonNegativeNumber(raw: string, label: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

function toIso(localValue: string) {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}

function tradeToDraft(trade: TradeApiModel): Draft {
  return {
    challengeId: trade.challengeId ?? "",
    instrument: trade.instrument,
    direction: trade.direction,
    openedAt: toLocalDateTimeInput(new Date(trade.openedAt)),
    closedAt: trade.closedAt ? toLocalDateTimeInput(new Date(trade.closedAt)) : "",
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

function challengeLabel(challengeId: string | null, challenges: Challenge[]) {
  if (!challengeId) return "No challenge";
  return challenges.find((item) => item.id === challengeId)?.name ?? "Unknown challenge";
}

function attachmentLightboxImages(
  tradeId: string,
  attachments: TradeAttachmentApiModel[],
): LightboxImage[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    src: tradeAttachmentImageUrl(tradeId, attachment.id),
    label: attachment.originalFilename,
  }));
}

export function TradeJournal() {
  const [trades, setTrades] = useState<TradeApiModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<TradeAttachmentApiModel[]>([]);
  const [queuedImages, setQueuedImages] = useState<QueuedImage[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingTrade, setViewingTrade] = useState<TradeApiModel | null>(null);
  const [viewAttachments, setViewAttachments] = useState<TradeAttachmentApiModel[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterInstrument, setFilterInstrument] = useState("ALL");
  const [filterOutcome, setFilterOutcome] = useState("ALL");
  const [filterChallenge, setFilterChallenge] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [nextTrades, nextChallenges] = await Promise.all([fetchTrades(), fetchChallenges()]);
      setTrades(nextTrades);
      setChallenges(nextChallenges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Trade Journal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (!lightbox && !viewingTrade && !editorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightbox) setLightbox(null);
        else if (editorOpen) closeEditor();
        else setViewingTrade(null);
      }
      if (lightbox && event.key === "ArrowRight") {
        setLightbox((current) => current ? {
          ...current,
          index: (current.index + 1) % current.images.length,
        } : current);
      }
      if (lightbox && event.key === "ArrowLeft") {
        setLightbox((current) => current ? {
          ...current,
          index: (current.index - 1 + current.images.length) % current.images.length,
        } : current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editorOpen, lightbox, viewingTrade]);

  const stats = useMemo(() => calculateJournalStats(trades), [trades]);

  const filteredTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return trades.filter((trade) => {
      if (filterInstrument !== "ALL" && trade.instrument !== filterInstrument) return false;
      if (filterOutcome !== "ALL" && (trade.outcome ?? "OPEN") !== filterOutcome) return false;
      if (filterChallenge !== "ALL" && (trade.challengeId ?? "NONE") !== filterChallenge) return false;
      if (query) {
        const haystack = [
          trade.instrument,
          trade.direction,
          trade.status,
          trade.outcome ?? "",
          trade.setup ?? "",
          trade.tags.join(" "),
          trade.notes ?? "",
          challengeLabel(trade.challengeId, challenges),
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [trades, challenges, filterInstrument, filterOutcome, filterChallenge, searchQuery]);

  const editorImages = useMemo(() => {
    const existing = editingId ? attachmentLightboxImages(editingId, existingAttachments) : [];
    const queued = queuedImages.map((image) => ({ id: image.id, src: image.previewUrl, label: image.file.name }));
    return [...existing, ...queued];
  }, [editingId, existingAttachments, queuedImages]);

  const filtersActive = filterInstrument !== "ALL" || filterOutcome !== "ALL" || filterChallenge !== "ALL" || searchQuery.trim() !== "";

  function clearQueuedImages() {
    setQueuedImages((current) => {
      for (const image of current) URL.revokeObjectURL(image.previewUrl);
      return [];
    });
  }

  function resetEditorState() {
    clearQueuedImages();
    setEditingId(null);
    setExistingAttachments([]);
    setDraft(blankDraft());
    setError(null);
  }

  function closeEditor() {
    resetEditorState();
    setEditorOpen(false);
  }

  function beginNew() {
    resetEditorState();
    setEditorOpen(true);
  }

  function clearFilters() {
    setFilterInstrument("ALL");
    setFilterOutcome("ALL");
    setFilterChallenge("ALL");
    setSearchQuery("");
  }

  async function loadEditorAttachments(tradeId: string) {
    setAttachmentsLoading(true);
    try {
      setExistingAttachments(await fetchTradeAttachments(tradeId));
    } finally {
      setAttachmentsLoading(false);
    }
  }

  async function beginEdit(trade: TradeApiModel) {
    clearQueuedImages();
    setEditingId(trade.id);
    setDraft(tradeToDraft(trade));
    setExistingAttachments([]);
    setError(null);
    setEditorOpen(true);
    try {
      await loadEditorAttachments(trade.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load screenshots.");
    }
  }

  function buildInput(): TradeEditableInput {
    const entryPrice = parseRequiredNumber(draft.entryPrice, "Entry Price");
    const contracts = Number(draft.contracts);
    if (!Number.isInteger(contracts) || contracts <= 0) throw new Error("Contracts must be a positive whole number.");

    const hasExit = draft.exitPrice.trim() !== "";
    const hasClosedAt = draft.closedAt.trim() !== "";
    if (hasExit !== hasClosedAt) throw new Error("Closed trade requires both Exit Price and Closed At.");

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
      commissionFees: parseNonNegativeNumber(draft.commissionFees || "0", "Commission & Fees"),
      setup: draft.setup.trim() || null,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: draft.notes.trim() || null,
    };
  }

  function queueFiles(files: File[]) {
    setError(null);
    const allowed = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
    for (const file of files) {
      if (!allowed.has(file.type)) {
        setError("Screenshots support JPG, PNG and WEBP only.");
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than 8 MB.`);
        return;
      }
    }
    const remaining = MAX_ATTACHMENTS_PER_TRADE - existingAttachments.length - queuedImages.length;
    if (files.length > remaining) {
      setError(`A trade can have up to ${MAX_ATTACHMENTS_PER_TRADE} screenshots. You can add ${Math.max(0, remaining)} more.`);
      return;
    }
    setQueuedImages((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) queueFiles(files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) queueFiles(files);
  }

  function removeQueuedImage(imageId: string) {
    setQueuedImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== imageId);
    });
  }

  async function removeExistingAttachment(attachment: TradeAttachmentApiModel) {
    if (!editingId) return;
    if (!window.confirm(`Remove screenshot "${attachment.originalFilename}"?`)) return;
    try {
      await deleteTradeAttachmentViaApi(editingId, attachment.id);
      setExistingAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete screenshot.");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    let savedTrade: TradeApiModel | null = null;
    try {
      const input = buildInput();
      savedTrade = editingId
        ? await updateTradeViaApi(editingId, input)
        : await createTradeViaApi(input);

      if (!editingId) setEditingId(savedTrade.id);
      if (queuedImages.length > 0) {
        await uploadTradeAttachments(savedTrade.id, queuedImages.map((image) => image.file));
      }

      closeEditor();
      await loadAll();
    } catch (err) {
      if (savedTrade && !editingId) {
        setEditingId(savedTrade.id);
        try { await loadEditorAttachments(savedTrade.id); } catch { /* Keep original error. */ }
      }
      const message = err instanceof Error ? err.message : "Unable to save trade.";
      setError(savedTrade ? `Trade was saved, but the screenshot step failed: ${message}` : message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(trade: TradeApiModel) {
    const ok = window.confirm(`Delete ${trade.instrument} trade from ${new Date(trade.openedAt).toLocaleString()}? Its screenshots will also be deleted.`);
    if (!ok) return;
    try {
      setError(null);
      await deleteTradeViaApi(trade.id);
      if (editingId === trade.id) closeEditor();
      if (viewingTrade?.id === trade.id) setViewingTrade(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete trade.");
    }
  }

  async function openTrade(trade: TradeApiModel) {
    setViewingTrade(trade);
    setViewAttachments([]);
    setViewLoading(true);
    setError(null);
    try {
      setViewAttachments(await fetchTradeAttachments(trade.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load screenshots.");
    } finally {
      setViewLoading(false);
    }
  }

  function openEditorLightbox(index: number) {
    if (editorImages.length > 0) setLightbox({ images: editorImages, index });
  }

  function openViewLightbox(index: number) {
    if (!viewingTrade) return;
    const images = attachmentLightboxImages(viewingTrade.id, viewAttachments);
    if (images.length > 0) setLightbox({ images, index });
  }

  return (
    <main className={styles.page}>
      <section className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>NET P&amp;L</span>
          <strong className={stats.netPnl > 0 ? styles.positive : stats.netPnl < 0 ? styles.negative : ""}>{money.format(stats.netPnl)}</strong>
          <small>{stats.closedTrades} closed trades</small>
        </article>
        <article className={styles.statCard}>
          <span>WIN RATE</span>
          <strong>{stats.winRate == null ? "—" : `${stats.winRate}%`}</strong>
          <small>{stats.wins}W / {stats.losses}L / {stats.breakeven}BE</small>
        </article>
        <article className={styles.statCard}>
          <span>AVERAGE R</span>
          <strong>{stats.averageR == null ? "—" : `${stats.averageR > 0 ? "+" : ""}${number.format(stats.averageR)}R`}</strong>
          <small>Net P&amp;L / initial risk</small>
        </article>
        <article className={styles.statCard}>
          <span>PROFIT FACTOR</span>
          <strong>{stats.profitFactor == null ? "—" : stats.profitFactor === Infinity ? "∞" : number.format(stats.profitFactor)}</strong>
          <small>Gross wins / gross losses</small>
        </article>
        <article className={styles.statCard}>
          <span>TOTAL TRADES</span>
          <strong>{stats.totalTrades}</strong>
          <small>{stats.openTrades} currently open</small>
        </article>
      </section>

      {error && !editorOpen && <p className={styles.pageError}>{error}</p>}

      <section className={`${styles.panel} ${styles.historyPanel}`}>
        <div className={styles.panelTitle}>
          <div>
            <span>TRADE HISTORY</span>
            <small>{filteredTrades.length} of {trades.length} trades shown</small>
          </div>
          <div className={styles.historyActions}>
            <button type="button" className={styles.newTradeButton} onClick={beginNew}>+ NEW TRADE</button>
            <button type="button" className={styles.textButton} onClick={() => void loadAll()} disabled={loading}>REFRESH</button>
          </div>
        </div>

        <div className={styles.filters}>
          <select value={filterInstrument} onChange={(event) => setFilterInstrument(event.target.value)}>
            <option value="ALL">All instruments</option>
            <option value="MNQ">MNQ</option><option value="MES">MES</option><option value="NQ">NQ</option><option value="ES">ES</option>
          </select>
          <select value={filterOutcome} onChange={(event) => setFilterOutcome(event.target.value)}>
            <option value="ALL">All outcomes</option>
            <option value="WIN">Wins</option><option value="LOSS">Losses</option><option value="BREAKEVEN">Breakeven</option><option value="OPEN">Open</option>
          </select>
          <select value={filterChallenge} onChange={(event) => setFilterChallenge(event.target.value)}>
            <option value="ALL">All challenges</option><option value="NONE">No challenge</option>
            {challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}
          </select>
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search setup, tags, account..."
            aria-label="Search trades"
          />
          <button type="button" className={styles.clearFiltersButton} onClick={clearFilters} disabled={!filtersActive}>CLEAR</button>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.emptyState}>Loading trades...</div>
          ) : filteredTrades.length === 0 ? (
            <div className={styles.emptyState}>No trades match the current filters.</div>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Date</th><th>Instrument</th><th>Side</th><th>Challenge</th><th>Contracts</th><th>Net P&amp;L</th><th>R</th><th>Outcome</th><th /></tr></thead>
              <tbody>
                {filteredTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td><strong>{new Date(trade.openedAt).toLocaleDateString()}</strong><small>{new Date(trade.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></td>
                    <td><strong>{trade.instrument}</strong><small>{trade.setup || "No setup"}</small></td>
                    <td><span className={trade.direction === "LONG" ? styles.longBadge : styles.shortBadge}>{trade.direction}</span></td>
                    <td><span className={styles.challengeCell}>{challengeLabel(trade.challengeId, challenges)}</span></td>
                    <td>{trade.contracts}</td>
                    <td className={trade.netPnl == null ? "" : trade.netPnl > 0 ? styles.positive : trade.netPnl < 0 ? styles.negative : ""}>{trade.netPnl == null ? "—" : money.format(trade.netPnl)}</td>
                    <td>{trade.rMultiple == null ? "—" : `${trade.rMultiple > 0 ? "+" : ""}${number.format(trade.rMultiple)}R`}</td>
                    <td><span className={`${styles.outcomeBadge} ${trade.status === "OPEN" ? styles.open : trade.outcome === "WIN" ? styles.win : trade.outcome === "LOSS" ? styles.loss : styles.be}`}>{trade.status === "OPEN" ? "OPEN" : trade.outcome}</span></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" onClick={() => void openTrade(trade)}>View</button>
                        <button type="button" onClick={() => void beginEdit(trade)}>Edit</button>
                        <button type="button" onClick={() => void remove(trade)}>Delete</button>
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
        <div className={styles.tradeModalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) closeEditor();
        }}>
          <section className={styles.editorModal} role="dialog" aria-modal="true" aria-label={editingId ? "Edit trade" : "New trade"}>
            <header className={styles.editorModalHeader}>
              <div>
                <span>{editingId ? "EDIT TRADE" : "NEW TRADE"}</span>
                <strong>{editingId ? "Update execution details and screenshots" : "Record a Journal trade"}</strong>
                <small>P&amp;L and R are calculated by the server.</small>
              </div>
              <button type="button" onClick={closeEditor} disabled={saving} aria-label="Close trade editor">×</button>
            </header>

            <form className={`${styles.form} ${styles.editorForm}`} onSubmit={save}>
              <div className={styles.editorModalBody}>
                <section className={styles.formSection}>
                  <div className={styles.formSectionTitle}>ACCOUNT</div>
                  <div className={styles.formGrid}>
                    <label className={styles.fieldWide}>
                      <span>Challenge</span>
                      <select value={draft.challengeId} onChange={(event) => setDraft((current) => ({ ...current, challengeId: event.target.value }))}>
                        <option value="">No challenge / personal</option>
                        {challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name} — {challenge.propFirm}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Instrument</span>
                      <select value={draft.instrument} onChange={(event) => setDraft((current) => ({ ...current, instrument: event.target.value as JournalInstrument }))}>
                        <option value="MNQ">MNQ</option><option value="MES">MES</option><option value="NQ">NQ</option><option value="ES">ES</option>
                      </select>
                    </label>
                    <div className={styles.directionField}>
                      <span>Direction</span>
                      <div className={styles.directionToggle}>
                        <button type="button" className={draft.direction === "LONG" ? styles.activeLong : ""} onClick={() => setDraft((current) => ({ ...current, direction: "LONG" }))}>LONG</button>
                        <button type="button" className={draft.direction === "SHORT" ? styles.activeShort : ""} onClick={() => setDraft((current) => ({ ...current, direction: "SHORT" }))}>SHORT</button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className={styles.formSection}>
                  <div className={styles.formSectionTitle}>EXECUTION</div>
                  <div className={`${styles.formGrid} ${styles.executionGrid}`}>
                    <label><span>Opened At</span><input type="datetime-local" value={draft.openedAt} onChange={(event) => setDraft((current) => ({ ...current, openedAt: event.target.value }))} required /></label>
                    <label><span>Closed At</span><input type="datetime-local" value={draft.closedAt} onChange={(event) => setDraft((current) => ({ ...current, closedAt: event.target.value }))} /></label>
                    <label><span>Entry Price</span><input inputMode="decimal" value={draft.entryPrice} onChange={(event) => setDraft((current) => ({ ...current, entryPrice: event.target.value }))} placeholder="20000.00" required /></label>
                    <label><span>Stop Price</span><input inputMode="decimal" value={draft.stopPrice} onChange={(event) => setDraft((current) => ({ ...current, stopPrice: event.target.value }))} placeholder="optional" /></label>
                    <label><span>Target Price</span><input inputMode="decimal" value={draft.targetPrice} onChange={(event) => setDraft((current) => ({ ...current, targetPrice: event.target.value }))} placeholder="optional" /></label>
                    <label><span>Exit Price</span><input inputMode="decimal" value={draft.exitPrice} onChange={(event) => setDraft((current) => ({ ...current, exitPrice: event.target.value }))} placeholder="leave empty if open" /></label>
                    <label><span>Contracts</span><input inputMode="numeric" value={draft.contracts} onChange={(event) => setDraft((current) => ({ ...current, contracts: event.target.value }))} required /></label>
                    <label>
                      <span>Commission &amp; Fees</span>
                      <div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={draft.commissionFees} onChange={(event) => setDraft((current) => ({ ...current, commissionFees: event.target.value }))} /></div>
                    </label>
                  </div>
                </section>

                <section className={styles.formSection}>
                  <div className={styles.formSectionTitle}>CONTEXT</div>
                  <div className={styles.formGrid}>
                    <label className={styles.fieldWide}><span>Setup</span><input value={draft.setup} onChange={(event) => setDraft((current) => ({ ...current, setup: event.target.value }))} placeholder="e.g. Opening range breakout" maxLength={120} /></label>
                    <label className={styles.fieldWide}><span>Tags</span><input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="scalp, A+, trend" /></label>
                    <label className={styles.fieldWide}><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="What did you see? What was done well? What would you change?" /></label>
                  </div>
                </section>

                <section className={styles.formSection}>
                  <div className={styles.screenshotHeader}>
                    <div><span>SCREENSHOTS</span><small>{existingAttachments.length + queuedImages.length} / {MAX_ATTACHMENTS_PER_TRADE}</small></div>
                    {attachmentsLoading && <small>Loading...</small>}
                  </div>
                  <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFileInput} />
                  <div className={styles.dropZone} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
                    <strong>Drop screenshots here</strong><span>or</span>
                    <button type="button" onClick={() => fileInputRef.current?.click()}>ADD IMAGES</button>
                    <small>JPG · PNG · WEBP · max 8 MB each · up to 10 per trade</small>
                  </div>
                  {(existingAttachments.length > 0 || queuedImages.length > 0) && (
                    <div className={styles.thumbnailGrid}>
                      {existingAttachments.map((attachment, index) => (
                        <figure key={attachment.id} className={styles.thumbnailCard}>
                          <button type="button" className={styles.thumbnailButton} onClick={() => openEditorLightbox(index)}>
                            <img src={tradeAttachmentImageUrl(editingId!, attachment.id)} alt={attachment.originalFilename} />
                          </button>
                          <figcaption><span>{attachment.originalFilename}</span><button type="button" aria-label="Remove screenshot" onClick={() => void removeExistingAttachment(attachment)}>×</button></figcaption>
                        </figure>
                      ))}
                      {queuedImages.map((image, queuedIndex) => (
                        <figure key={image.id} className={styles.thumbnailCard}>
                          <button type="button" className={styles.thumbnailButton} onClick={() => openEditorLightbox(existingAttachments.length + queuedIndex)}>
                            <img src={image.previewUrl} alt={image.file.name} /><em>NEW</em>
                          </button>
                          <figcaption><span>{image.file.name}</span><button type="button" aria-label="Remove queued screenshot" onClick={() => removeQueuedImage(image.id)}>×</button></figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </section>

                {error && <p className={styles.error}>{error}</p>}
              </div>

              <footer className={styles.editorFooter}>
                <button type="button" className={styles.secondaryButton} onClick={closeEditor} disabled={saving}>CANCEL</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "SAVING..." : editingId ? "UPDATE TRADE" : "SAVE TRADE"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {viewingTrade && (
        <div className={styles.tradeModalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingTrade(null); }}>
          <article className={styles.tradeModal}>
            <header>
              <div><span>TRADE DETAILS</span><strong>{viewingTrade.instrument} · {viewingTrade.direction}</strong></div>
              <button type="button" onClick={() => setViewingTrade(null)} aria-label="Close trade details">×</button>
            </header>
            <div className={styles.tradeModalBody}>
              <section className={styles.tradeFacts}>
                <Detail label="Challenge" value={challengeLabel(viewingTrade.challengeId, challenges)} />
                <Detail label="Opened" value={new Date(viewingTrade.openedAt).toLocaleString()} />
                <Detail label="Entry" value={String(viewingTrade.entryPrice)} />
                <Detail label="Exit" value={viewingTrade.exitPrice == null ? "—" : String(viewingTrade.exitPrice)} />
                <Detail label="Contracts" value={String(viewingTrade.contracts)} />
                <Detail label="Net P&L" value={viewingTrade.netPnl == null ? "—" : money.format(viewingTrade.netPnl)} tone={viewingTrade.netPnl == null ? "neutral" : viewingTrade.netPnl > 0 ? "positive" : viewingTrade.netPnl < 0 ? "negative" : "neutral"} />
                <Detail label="R" value={viewingTrade.rMultiple == null ? "—" : `${viewingTrade.rMultiple > 0 ? "+" : ""}${number.format(viewingTrade.rMultiple)}R`} />
                <Detail label="Outcome" value={viewingTrade.status === "OPEN" ? "OPEN" : viewingTrade.outcome ?? "—"} />
              </section>

              {(viewingTrade.setup || viewingTrade.tags.length > 0 || viewingTrade.notes) && (
                <section className={styles.tradeNarrative}>
                  {viewingTrade.setup && <div><span>SETUP</span><p>{viewingTrade.setup}</p></div>}
                  {viewingTrade.tags.length > 0 && <div><span>TAGS</span><p>{viewingTrade.tags.join(", ")}</p></div>}
                  {viewingTrade.notes && <div><span>NOTES</span><p>{viewingTrade.notes}</p></div>}
                </section>
              )}

              <section className={styles.tradeScreenshots}>
                <div className={styles.tradeScreenshotsTitle}><span>SCREENSHOTS</span><small>{viewAttachments.length}</small></div>
                {viewLoading ? (
                  <div className={styles.screenshotEmpty}>Loading screenshots...</div>
                ) : viewAttachments.length === 0 ? (
                  <div className={styles.screenshotEmpty}>No screenshots attached to this trade.</div>
                ) : (
                  <div className={styles.detailThumbnailGrid}>
                    {viewAttachments.map((attachment, index) => (
                      <button type="button" key={attachment.id} onClick={() => openViewLightbox(index)}>
                        <img src={tradeAttachmentImageUrl(viewingTrade.id, attachment.id)} alt={attachment.originalFilename} />
                        <span>{attachment.originalFilename}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <footer><button type="button" onClick={() => { const trade = viewingTrade; setViewingTrade(null); void beginEdit(trade); }}>EDIT TRADE</button></footer>
          </article>
        </div>
      )}

      {lightbox && (
        <div className={styles.lightboxBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className={styles.lightbox}>
            <button type="button" className={styles.lightboxClose} aria-label="Close screenshot" onClick={() => setLightbox(null)}>×</button>
            {lightbox.images.length > 1 && <button type="button" className={styles.lightboxPrev} aria-label="Previous screenshot" onClick={() => setLightbox((current) => current ? { ...current, index: (current.index - 1 + current.images.length) % current.images.length } : current)}>‹</button>}
            <img src={lightbox.images[lightbox.index].src} alt={lightbox.images[lightbox.index].label} />
            {lightbox.images.length > 1 && <button type="button" className={styles.lightboxNext} aria-label="Next screenshot" onClick={() => setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.images.length } : current)}>›</button>}
            <div className={styles.lightboxCaption}><span>{lightbox.images[lightbox.index].label}</span><strong>{lightbox.index + 1} / {lightbox.images.length}</strong></div>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({ label, value, tone = "neutral" }: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className={styles.detail}>
      <span>{label}</span>
      <strong className={tone === "positive" ? styles.positive : tone === "negative" ? styles.negative : ""}>{value}</strong>
    </div>
  );
}
