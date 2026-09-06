"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchChallenges } from "@/lib/challenges/api-client";
import type { Challenge } from "@/lib/challenges/types";
import { createTradeViaApi, fetchTrades } from "@/lib/journal/api-client";
import {
  existingTradeFingerprint,
  importTradeFingerprint,
  parseDeepChartsCsv,
  type DeepChartsImportTimeZone,
  type DeepChartsParsedRow,
} from "@/lib/journal/deepcharts-import";
import type { TradeApiModel } from "@/lib/journal/types";
import styles from "./DeepChartsImport.module.css";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type PreviewStatus = "READY" | "DUPLICATE" | "ERROR";
type PreviewFilter = "ALL" | PreviewStatus;

type PreviewRow = DeepChartsParsedRow & {
  status: PreviewStatus;
};

type ImportResult = {
  imported: number;
  failed: string[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeepChartsImport() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [existingTrades, setExistingTrades] = useState<TradeApiModel[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [timeZone, setTimeZone] = useState<DeepChartsImportTimeZone>("LOCAL");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextChallenges, nextTrades] = await Promise.all([
          fetchChallenges(),
          fetchTrades(),
        ]);

        if (!cancelled) {
          setChallenges(nextChallenges);
          setExistingTrades(nextTrades);
          const preferred = nextChallenges.find((challenge) => challenge.status === "IN_PROGRESS");
          if (preferred) setChallengeId(preferred.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load Journal data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const parsed = useMemo(
    () => csvText
      ? parseDeepChartsCsv(csvText, {
          challengeId: challengeId || null,
          timeZone,
        })
      : { rows: [], fatalErrors: [] },
    [challengeId, csvText, timeZone],
  );

  const previewRows = useMemo<PreviewRow[]>(() => {
    const seen = new Set(existingTrades.map(existingTradeFingerprint));

    return parsed.rows.map((row) => {
      if (row.error || !row.input) return { ...row, status: "ERROR" };

      const fingerprint = importTradeFingerprint(row.input);
      if (seen.has(fingerprint)) return { ...row, status: "DUPLICATE" };

      seen.add(fingerprint);
      return { ...row, status: "READY" };
    });
  }, [existingTrades, parsed.rows]);

  const summary = useMemo(() => {
    const ready = previewRows.filter((row) => row.status === "READY");
    const duplicate = previewRows.filter((row) => row.status === "DUPLICATE");
    const invalid = previewRows.filter((row) => row.status === "ERROR");
    const reportedPnl = ready.reduce((sum, row) => sum + (row.reportedPnl ?? 0), 0);

    return {
      rows: previewRows.length,
      ready: ready.length,
      duplicate: duplicate.length,
      invalid: invalid.length,
      reportedPnl,
    };
  }, [previewRows]);

  const filteredPreviewRows = useMemo(
    () => previewFilter === "ALL"
      ? previewRows
      : previewRows.filter((row) => row.status === previewFilter),
    [previewFilter, previewRows],
  );

  async function readFile(file: File) {
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose the CSV file exported from DeepCharts Strategy Report → Trade List.");
      return;
    }

    if (file.size > MAX_CSV_BYTES) {
      setError("CSV file is larger than 5 MB.");
      return;
    }

    try {
      setFileName(file.name);
      setCsvText(await file.text());
      setPreviewFilter("ALL");
    } catch {
      setError("Unable to read the CSV file.");
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  function clearFile() {
    setFileName("");
    setCsvText("");
    setPreviewFilter("ALL");
    setResult(null);
    setProgress({ done: 0, total: 0 });
    setError(null);
  }

  async function importReadyTrades() {
    const readyRows = previewRows.filter(
      (row): row is PreviewRow & { input: NonNullable<PreviewRow["input"]> } =>
        row.status === "READY" && row.input != null,
    );

    if (readyRows.length === 0 || importing) return;

    setImporting(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: readyRows.length });

    let imported = 0;
    const failed: string[] = [];

    for (let index = 0; index < readyRows.length; index += 1) {
      const row = readyRows[index];
      try {
        await createTradeViaApi(row.input);
        imported += 1;
      } catch (err) {
        failed.push(
          `CSV row ${row.rowNumber}: ${err instanceof Error ? err.message : "Import failed."}`,
        );
      }
      setProgress({ done: index + 1, total: readyRows.length });
    }

    try {
      setExistingTrades(await fetchTrades());
    } catch {
      // Imported rows are already saved. A refresh will rebuild duplicate detection.
    }

    setResult({ imported, failed });
    setImporting(false);
  }

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "browser local time";
  const filterOptions: { value: PreviewFilter; label: string; count: number }[] = [
    { value: "ALL", label: "ALL", count: summary.rows },
    { value: "READY", label: "READY", count: summary.ready },
    { value: "DUPLICATE", label: "DUPLICATE", count: summary.duplicate },
    { value: "ERROR", label: "INVALID", count: summary.invalid },
  ];

  return (
    <main className={styles.page}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <section className={`${styles.panel} ${styles.setupPanel}`}>
        <header className={styles.panelHeader}>
          <div>
            <span>IMPORT SETUP</span>
            <small>Choose the destination and time zone, then add the original DeepCharts CSV.</small>
          </div>
        </header>

        <div className={styles.setupGrid}>
          <div className={styles.settings}>
            <label>
              <span>CHALLENGE / ACCOUNT</span>
              <select value={challengeId} onChange={(event) => setChallengeId(event.target.value)} disabled={loading || importing}>
                <option value="">No challenge / personal</option>
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name} — {challenge.propFirm}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>CSV TIME ZONE</span>
              <select value={timeZone} onChange={(event) => setTimeZone(event.target.value as DeepChartsImportTimeZone)} disabled={importing}>
                <option value="LOCAL">Browser local ({browserTimeZone})</option>
                <option value="America/New_York">New York (ET)</option>
                <option value="America/Chicago">Chicago (CT)</option>
                <option value="Europe/Belgrade">Belgrade</option>
                <option value="UTC">UTC</option>
              </select>
              <small>Choose the time zone DeepCharts used when it displayed Entry/Exit times.</small>
            </label>
          </div>

          <div className={styles.fileSide}>
            <div className={styles.fileHeading}>
              <div>
                <span>CSV FILE</span>
                <small>Nothing is written to the Journal until you confirm the import.</small>
              </div>
              {fileName && (
                <button className={styles.textButton} type="button" onClick={clearFile} disabled={importing}>
                  CLEAR
                </button>
              )}
            </div>

            <div
              className={`${styles.dropZone} ${fileName ? styles.dropZoneLoaded : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              onClick={() => !importing && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !importing) fileInputRef.current?.click();
              }}
            >
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} hidden />
              <strong>{fileName || "Drop DeepCharts CSV here"}</strong>
              <small>{fileName ? "CSV loaded · click to choose a different file" : "or click to browse · max 5 MB"}</small>
            </div>
          </div>
        </div>
      </section>

      <details className={styles.instructionsPanel}>
        <summary>
          <span>HOW TO EXPORT FROM DEEPCHARTS</span>
          <small>Strategy Report → Trade List → Export CSV</small>
          <b>VIEW INSTRUCTIONS</b>
        </summary>
        <div className={styles.instructions}>
          <ol>
            <li>DeepCharts → <b>Trading</b> → <b>Strategy Report</b>.</li>
            <li>Select broker, account, date range and symbols, then generate the report.</li>
            <li>Open <b>Trade List</b> and choose <b>Export CSV</b>.</li>
            <li>Upload the original CSV here and review the preview before importing.</li>
          </ol>
          <p>
            Expected columns: <b>Symbol</b>, <b>Quantity</b>, <b>Entry DT</b>, <b>Entry Price</b>, <b>Exit DT</b>, <b>Exit Price</b>, <b>ProfitLoss</b>.
          </p>
        </div>
      </details>

      {parsed.fatalErrors.length > 0 && (
        <section className={styles.fatalPanel}>
          {parsed.fatalErrors.map((message) => <p key={message}>{message}</p>)}
        </section>
      )}

      {csvText && parsed.fatalErrors.length === 0 && (
        <>
          <section className={styles.summaryGrid}>
            <article><span>CSV ROWS</span><strong>{summary.rows}</strong></article>
            <article><span>READY</span><strong className={styles.positive}>{summary.ready}</strong></article>
            <article><span>DUPLICATES</span><strong>{summary.duplicate}</strong></article>
            <article><span>INVALID</span><strong className={summary.invalid ? styles.negative : ""}>{summary.invalid}</strong></article>
            <article><span>READY P&amp;L</span><strong className={summary.reportedPnl > 0 ? styles.positive : summary.reportedPnl < 0 ? styles.negative : ""}>{money.format(summary.reportedPnl)}</strong></article>
          </section>

          <section className={`${styles.panel} ${styles.previewPanel}`}>
            <header className={styles.panelHeader}>
              <div>
                <span>PREVIEW</span>
                <small>Duplicates are skipped automatically. Invalid rows are never imported.</small>
              </div>
              <button className={styles.importButton} type="button" onClick={() => void importReadyTrades()} disabled={summary.ready === 0 || importing}>
                {importing ? `IMPORTING ${progress.done}/${progress.total}` : `IMPORT ${summary.ready} TRADE${summary.ready === 1 ? "" : "S"}`}
              </button>
            </header>

            <div className={styles.previewFilters} aria-label="Preview status filter">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={previewFilter === option.value ? styles.activeFilter : undefined}
                  onClick={() => setPreviewFilter(option.value)}
                >
                  {option.label} <span>{option.count}</span>
                </button>
              ))}
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>ROW</th>
                    <th>STATUS</th>
                    <th>SYMBOL</th>
                    <th>SIDE</th>
                    <th>QTY</th>
                    <th>ENTRY</th>
                    <th>EXIT</th>
                    <th>P&amp;L</th>
                    <th>NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreviewRows.slice(0, 200).map((row) => (
                    <tr key={`${row.rowNumber}-${row.rawSymbol}`}>
                      <td>{row.rowNumber}</td>
                      <td><span className={`${styles.status} ${styles[`status${row.status}`]}`}>{row.status}</span></td>
                      <td>{row.input?.instrument ?? (row.rawSymbol || "—")}</td>
                      <td>{row.input?.direction ?? "—"}</td>
                      <td>{row.input?.contracts ?? "—"}</td>
                      <td>{formatDateTime(row.input?.openedAt)}<small>{row.input ? ` @ ${row.input.entryPrice}` : ""}</small></td>
                      <td>{formatDateTime(row.input?.closedAt)}<small>{row.input?.exitPrice != null ? ` @ ${row.input.exitPrice}` : ""}</small></td>
                      <td className={(row.reportedPnl ?? 0) > 0 ? styles.positive : (row.reportedPnl ?? 0) < 0 ? styles.negative : ""}>{row.reportedPnl == null ? "—" : money.format(row.reportedPnl)}</td>
                      <td>{row.error ?? row.warnings[0] ?? (row.status === "DUPLICATE" ? "Already in Journal or repeated in this CSV." : "Ready to import.")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPreviewRows.length === 0 && (
                <div className={styles.tableEmpty}>No rows match this status filter.</div>
              )}
              {filteredPreviewRows.length > 200 && (
                <div className={styles.tableNote}>Showing first 200 of {filteredPreviewRows.length} matching rows. All ready rows will still be imported.</div>
              )}
            </div>
          </section>
        </>
      )}

      {result && (
        <section className={`${styles.resultBanner} ${result.failed.length ? styles.resultWarning : styles.resultSuccess}`}>
          <div>
            <strong>{result.imported} trade{result.imported === 1 ? "" : "s"} imported.</strong>
            <small>{result.failed.length ? `${result.failed.length} row(s) failed.` : "Journal data is now updated."}</small>
          </div>
          <Link href="/journal">Open Journal</Link>
          {result.failed.length > 0 && (
            <details>
              <summary>Show failures</summary>
              {result.failed.map((message) => <p key={message}>{message}</p>)}
            </details>
          )}
        </section>
      )}
    </main>
  );
}
