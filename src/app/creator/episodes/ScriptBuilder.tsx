"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatorEpisodeApiModel,
  CreatorScriptDraft,
} from "@/lib/creator/episodes-types";
import styles from "./ScriptBuilder.module.css";

function durationLabel(minutes: number) {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${mins}:00` : `${mins}:${String(seconds).padStart(2, "0")}`;
}

export function ScriptBuilder({
  episode,
  draft,
}: {
  episode: CreatorEpisodeApiModel;
  draft: CreatorScriptDraft;
}) {
  const router = useRouter();
  const [script, setScript] = useState(episode.script ?? draft.text);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = useMemo(
    () => script.trim() ? script.trim().split(/\s+/).length : 0,
    [script],
  );

  function resetToGenerated() {
    setScript(draft.text);
    setMessage("Generated FFZ draft restored. Save when you are ready.");
    setError(null);
  }

  async function saveScript() {
    const cleanScript = script.trim();
    if (!cleanScript || saving) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/creator/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: cleanScript,
          status: "SCRIPT_READY",
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Unable to save script.");

      setMessage("Script saved. Episode is now SCRIPT READY.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save script.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.scriptWorkspace}>
      <header className={styles.header}>
        <div>
          <span>SCRIPT BUILDER</span>
          <h2>Turn the story into a recording plan</h2>
          <p>
            This is a rule-based first draft built only from verified FFZ episode data. Keep the facts,
            rewrite the voice until it sounds natural, then save it as the recording script.
          </p>
        </div>
        <div className={styles.scriptState}>
          <span>PLANNED LENGTH</span>
          <strong>~{draft.totalMinutes.toFixed(1)} MIN</strong>
          <small>{episode.script ? "SAVED SCRIPT" : "GENERATED FIRST DRAFT"}</small>
        </div>
      </header>

      <div className={styles.sectionGrid}>
        {draft.sections.map((section, index) => (
          <article className={styles.sectionCard} key={section.id}>
            <div className={styles.sectionTopline}>
              <span>{String(index + 1).padStart(2, "0")} · {section.label}</span>
              <b>{durationLabel(section.durationMinutes)}</b>
            </div>
            <strong>{section.title}</strong>
            <div className={styles.visualCue}>{section.visualCue}</div>
          </article>
        ))}
      </div>

      <section className={styles.editorCard}>
        <div className={styles.editorHeader}>
          <div>
            <span>RECORDING SCRIPT</span>
            <strong>{episode.storyAngle}</strong>
          </div>
          <div className={styles.editorStats}>
            <span>{wordCount} WORDS</span>
            <span>{draft.sections.length} SECTIONS</span>
          </div>
        </div>

        <textarea
          value={script}
          onChange={(event) => {
            setScript(event.target.value);
            setMessage(null);
            setError(null);
          }}
          maxLength={100000}
          spellCheck
          placeholder="Write the episode script..."
        />

        <div className={styles.actions}>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={resetToGenerated}>
              RESET TO GENERATED
            </button>
            <p className={error ? styles.error : styles.message}>
              {error || message || "All closed trades remain in chronological order. Key trades only receive more emphasis."}
            </p>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => void saveScript()}
            disabled={saving || !script.trim()}
          >
            {saving ? "SAVING..." : episode.script ? "UPDATE SCRIPT" : "SAVE SCRIPT"}
          </button>
        </div>
      </section>
    </section>
  );
}
