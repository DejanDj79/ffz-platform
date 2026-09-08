"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatorEpisodeApiModel,
  CreatorPublishDraft,
} from "@/lib/creator/episodes-types";
import styles from "./PublishWorkspace.module.css";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function PublishWorkspace({
  episode,
  draft,
}: {
  episode: CreatorEpisodeApiModel;
  draft: CreatorPublishDraft;
}) {
  const router = useRouter();
  const [publishTitle, setPublishTitle] = useState(episode.publishTitle ?? draft.titleIdeas[0] ?? "");
  const [thumbnailText, setThumbnailText] = useState(episode.thumbnailText ?? draft.thumbnailIdeas[0] ?? "");
  const [description, setDescription] = useState(episode.description ?? draft.description);
  const [chapters, setChapters] = useState(episode.chapters ?? draft.chapters);
  const [youtubeUrl, setYoutubeUrl] = useState(episode.youtubeUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(status: "EDITED" | "PUBLISHED") {
    if (saving || !publishTitle.trim()) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/creator/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishTitle: publishTitle.trim(),
          thumbnailText: thumbnailText.trim() || null,
          description: description.trim() || null,
          chapters: chapters.trim() || null,
          youtubeUrl: youtubeUrl.trim() || null,
          status,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Unable to save publish package.");

      setMessage(status === "PUBLISHED"
        ? "Episode marked PUBLISHED."
        : "Publish package saved. Episode is now EDITED.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save publish package.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>PUBLISH BUILDER</span>
          <h2>Turn the finished episode into a YouTube package</h2>
          <p>
            Titles and thumbnail text are suggestions, not promises. Description and chapters are generated
            from the saved FFZ episode facts and the final recording script.
          </p>
        </div>
        <div className={styles.statusBlock}>
          <span>EPISODE STATUS</span>
          <strong>{episode.status.replaceAll("_", " ")}</strong>
        </div>
      </header>

      <div className={styles.ideaGrid}>
        <section className={styles.ideaCard}>
          <div className={styles.cardHeader}>
            <div>
              <span>TITLE IDEAS</span>
              <strong>Choose the strongest honest hook</strong>
            </div>
          </div>
          <div className={styles.ideaList}>
            {draft.titleIdeas.map((idea, index) => (
              <button
                className={publishTitle === idea ? styles.selectedIdea : ""}
                key={idea}
                type="button"
                onClick={() => setPublishTitle(idea)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{idea}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.ideaCard}>
          <div className={styles.cardHeader}>
            <div>
              <span>THUMBNAIL TEXT</span>
              <strong>Short enough to read at a glance</strong>
            </div>
          </div>
          <div className={styles.thumbnailIdeas}>
            {draft.thumbnailIdeas.map((idea) => (
              <button
                className={thumbnailText === idea ? styles.selectedThumb : ""}
                key={idea}
                type="button"
                onClick={() => setThumbnailText(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.editorCard}>
        <div className={styles.fieldRow}>
          <label>
            <span>FINAL YOUTUBE TITLE</span>
            <div className={styles.inlineControl}>
              <input
                value={publishTitle}
                onChange={(event) => setPublishTitle(event.target.value)}
                maxLength={180}
              />
              <button type="button" onClick={() => void copyText(publishTitle)}>COPY</button>
            </div>
            <small>{publishTitle.length}/180</small>
          </label>

          <label>
            <span>FINAL THUMBNAIL TEXT</span>
            <div className={styles.inlineControl}>
              <input
                value={thumbnailText}
                onChange={(event) => setThumbnailText(event.target.value)}
                maxLength={120}
              />
              <button type="button" onClick={() => void copyText(thumbnailText)}>COPY</button>
            </div>
            <small>{thumbnailText.length}/120</small>
          </label>
        </div>

        <label>
          <div className={styles.labelRow}>
            <span>DESCRIPTION</span>
            <button type="button" onClick={() => void copyText(description)}>COPY DESCRIPTION</button>
          </div>
          <textarea
            className={styles.description}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={20000}
          />
        </label>

        <label>
          <div className={styles.labelRow}>
            <span>CHAPTERS</span>
            <button type="button" onClick={() => void copyText(chapters)}>COPY CHAPTERS</button>
          </div>
          <textarea
            className={styles.chapters}
            value={chapters}
            onChange={(event) => setChapters(event.target.value)}
            maxLength={10000}
          />
        </label>

        <label>
          <span>YOUTUBE URL · OPTIONAL</span>
          <input
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            maxLength={500}
          />
        </label>

        <div className={styles.actions}>
          <p className={error ? styles.error : styles.message}>
            {error || message || "Save the package before publishing so the final metadata stays attached to this FFZ episode."}
          </p>
          <div>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={saving || !publishTitle.trim()}
              onClick={() => void persist("EDITED")}
            >
              {saving ? "SAVING..." : episode.publishTitle ? "UPDATE PACKAGE" : "SAVE PACKAGE"}
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={saving || !publishTitle.trim() || episode.status === "PUBLISHED"}
              onClick={() => void persist("PUBLISHED")}
            >
              {episode.status === "PUBLISHED" ? "PUBLISHED" : "MARK PUBLISHED"}
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
