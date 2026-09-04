"use client";

import { useState } from "react";
import { DisciplineReviewPanel } from "./DisciplineReviewPanel";
import { PlannedTradesPanel } from "./PlannedTradesPanel";
import { TradeJournal } from "./TradeJournal";

export function JournalWorkspace() {
  const [journalVersion, setJournalVersion] = useState(0);

  return (
    <>
      <PlannedTradesPanel
        onTradeStarted={() => setJournalVersion((current) => current + 1)}
      />
      <DisciplineReviewPanel key={`discipline-${journalVersion}`} />
      <TradeJournal key={`journal-${journalVersion}`} />
    </>
  );
}
