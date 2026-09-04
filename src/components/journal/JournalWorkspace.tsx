"use client";

import { MouseEvent, useRef, useState } from "react";
import { DisciplineReviewPanel } from "./DisciplineReviewPanel";
import { PlannedTradesPanel } from "./PlannedTradesPanel";
import { TradeJournal } from "./TradeJournal";

export function JournalWorkspace() {
  const [journalVersion, setJournalVersion] = useState(0);
  const journalRef = useRef<HTMLDivElement | null>(null);

  function scrollEditorAfterEdit(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    const label = button?.textContent?.trim().toUpperCase();

    if (label !== "EDIT" && label !== "EDIT TRADE") return;

    window.setTimeout(() => {
      const editorForm = journalRef.current?.querySelector("form");
      const editorPanel = editorForm?.closest("section");

      (editorPanel ?? editorForm)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  return (
    <>
      <PlannedTradesPanel
        onTradeStarted={() => setJournalVersion((current) => current + 1)}
      />
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          border: "1px dashed #6b7d8a",
          borderRadius: 8,
          background: "#09131c",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ fontSize: 12 }}>DEBUG NATIVE SELECT</strong>
          <select defaultValue="" style={{ minWidth: 180, minHeight: 36 }}>
            <option value="">Choose...</option>
            <option value="one">Option one</option>
            <option value="two">Option two</option>
            <option value="three">Option three</option>
          </select>
        </label>
      </div>
      <DisciplineReviewPanel key={`discipline-${journalVersion}`} />
      <div ref={journalRef} onClickCapture={scrollEditorAfterEdit}>
        <TradeJournal key={`journal-${journalVersion}`} />
      </div>
    </>
  );
}
