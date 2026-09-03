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
    <button className={styles.copyButton} type="button" onClick={() => void copy()}>
      {copied ? "COPIED" : "COPY EPISODE BRIEF"}
    </button>
  );
}
