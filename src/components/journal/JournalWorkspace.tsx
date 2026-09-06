"use client";

import { useState } from "react";
import { DisciplineReviewPanel } from "./DisciplineReviewPanel";
import { PlannedTradesPanel } from "./PlannedTradesPanel";
import { TradeJournal } from "./TradeJournal";
import styles from "./JournalWorkspace.module.css";

export function JournalWorkspace() {
  const [journalVersion, setJournalVersion] = useState(0);

  return (
    <>
      <TradeJournal key={`journal-${journalVersion}`} />

      <div className={styles.secondaryGrid}>
        <PlannedTradesPanel
          onTradeStarted={() => setJournalVersion((current) => current + 1)}
        />
        <DisciplineReviewPanel key={`discipline-${journalVersion}`} />
      </div>
    </>
  );
}
