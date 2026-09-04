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
      <DisciplineReviewPanel key={`discipline-${journalVersion}`} />
      <div ref={journalRef} onClickCapture={scrollEditorAfterEdit}>
        <TradeJournal key={`journal-${journalVersion}`} />
      </div>
    </>
  );
}
