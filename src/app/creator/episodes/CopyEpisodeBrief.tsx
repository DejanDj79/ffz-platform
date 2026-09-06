"use client";

import { useState } from "react";
import styles from "./EpisodeBuilder.module.css";

export function CopyEpisodeBrief({ brief }: { brief: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className={styles.copyButton} onClick={() => void copy()}>
      {copied ? "COPIED" : "COPY BRIEF"}
    </button>
  );
}
