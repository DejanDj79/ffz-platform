"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  CreateCreatorEpisodeInput,
  CreatorEpisodeApiModel,
} from "@/lib/creator/episodes-types";
import styles from "./EpisodeDraftWorkspace.module.css";

function dateInputValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function episodeHref(episode: CreatorEpisodeApiModel) {
  const params = new URLSearchParams({
    episode: episode.id,
    from: dateInputValue(episode.periodFrom),
    to: dateInputValue(episode.periodTo),
  });

  if (episode.challengeId) params.set("challenge", episode.challengeId);
  if (episode.source === "WEEKLY_REVIEW") params.set("source", "weekly-review");

  return `/creator/episodes?${params.toString()}`;
}

function periodLabel(episode: CreatorEpisodeApiModel) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(episode.periodFrom))} → ${formatter.format(new Date(episode.periodTo))}`;
}

export function EpisodeDraftWorkspace({
  episodes,
  activeEpisodeId,
  createInput,
}: {
  episodes: CreatorEpisodeApiModel[];
  activeEpisodeId: string | null;
  createInput: CreateCreatorEpisodeInput;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(createInput.title);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeEpisode = useMemo(
    () => episodes.find((episode) => episode.id === activeEpisodeId) ?? null,
    [episodes, activeEpisodeId],
  );

  async function saveDraft() {
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/creator/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createInput, title: cleanTitle }),
      });
      const json = (await response.json()) as {
        data?: CreatorEpisodeApiModel;
        error?: string;
      };

      if (!response.ok || !json.data) {
        throw new Error(json.error || "Unable to save episode draft.");
      }

      setMessage("Episode draft saved.");
      router.push(episodeHref(json.data));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save episode draft.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.saveArea}>
        <div className={styles.heading}>
          <span>EPISODE WORKSPACE</span>
          <strong>{activeEpisode ? "Draft loaded" : "Save this snapshot as a draft"}</strong>
          <small>
            {activeEpisode
              ? `${activeEpisode.title} · ${activeEpisode.status.replaceAll("_", " ")}`
              : "The saved draft becomes the persistent home for Story, Script, Record and Publish steps."}
          </small>
        </div>

        <div className={styles.saveControls}>
          <label>
            <span>EPISODE TITLE</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
            />
          </label>
          <button type="button" onClick={() => void saveDraft()} disabled={saving || !title.trim()}>
            {saving ? "SAVING..." : "SAVE EPISODE DRAFT"}
          </button>
        </div>

        {(message || error) && (
          <p className={error ? styles.error : styles.message}>{error || message}</p>
        )}
      </div>

      <div className={styles.savedArea}>
        <div className={styles.savedHeader}>
          <span>SAVED DRAFTS</span>
          <small>{episodes.length} recent</small>
        </div>

        {episodes.length > 0 ? (
          <div className={styles.draftList}>
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                href={episodeHref(episode)}
                className={`${styles.draftRow} ${episode.id === activeEpisodeId ? styles.activeDraft : ""}`}
              >
                <div>
                  <strong>{episode.title}</strong>
                  <small>{periodLabel(episode)}</small>
                </div>
                <span>{episode.status.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No saved episodes yet.</p>
        )}
      </div>
    </section>
  );
}
