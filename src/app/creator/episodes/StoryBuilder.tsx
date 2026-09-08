"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatorEpisodeApiModel,
  CreatorStorySuggestion,
} from "@/lib/creator/episodes-types";
import styles from "./StoryBuilder.module.css";

export function StoryBuilder({
  episode,
  suggestions,
}: {
  episode: CreatorEpisodeApiModel;
  suggestions: CreatorStorySuggestion[];
}) {
  const router = useRouter();
  const initialSuggestion = useMemo(
    () => suggestions.find((item) => item.title === episode.storyAngle) ?? null,
    [episode.storyAngle, suggestions],
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialSuggestion?.id ?? null);
  const [storyAngle, setStoryAngle] = useState(episode.storyAngle ?? initialSuggestion?.title ?? "");
  const [featuredTradeIds, setFeaturedTradeIds] = useState<string[]>(
    episode.featuredTradeIds.length > 0
      ? episode.featuredTradeIds
      : initialSuggestion?.featuredTradeIds ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function chooseSuggestion(suggestion: CreatorStorySuggestion) {
    setSelectedId(suggestion.id);
    setStoryAngle(suggestion.title);
    setFeaturedTradeIds(suggestion.featuredTradeIds);
    setMessage(null);
    setError(null);
  }

  async function saveStory() {
    const cleanAngle = storyAngle.trim();
    if (!cleanAngle || saving) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/creator/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyAngle: cleanAngle,
          featuredTradeIds,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Unable to save story.");

      setMessage("Story angle saved to this episode.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save story.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.storyWorkspace}>
      <header className={styles.storyHeader}>
        <div>
          <span>STORY BUILDER</span>
          <h2>Find the episode inside the trading data</h2>
          <p>
            These angles are generated from the actual episode period. Choose the strongest one,
            then edit it until it sounds like the story you want to tell.
          </p>
        </div>
        <div className={styles.savedState}>
          <span>CURRENT STORY</span>
          <strong>{episode.storyAngle || "NOT SELECTED"}</strong>
        </div>
      </header>

      <div className={styles.suggestionGrid}>
        {suggestions.map((suggestion, index) => (
          <article
            key={suggestion.id}
            className={`${styles.suggestionCard} ${selectedId === suggestion.id ? styles.selectedCard : ""}`}
          >
            <div className={styles.cardTopline}>
              <span>ANGLE {String(index + 1).padStart(2, "0")}</span>
              <b>{suggestion.tone}</b>
            </div>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.why}</p>
            <div className={styles.keyMoments}>
              <span>WHY THE STORY HOLDS</span>
              <ul>
                {suggestion.keyMoments.map((moment) => <li key={moment}>{moment}</li>)}
              </ul>
            </div>
            <button type="button" onClick={() => chooseSuggestion(suggestion)}>
              {selectedId === suggestion.id ? "SELECTED" : "USE THIS ANGLE"}
            </button>
          </article>
        ))}
      </div>

      <section className={styles.finalStory}>
        <div className={styles.finalHeading}>
          <div>
            <span>FINAL STORY ANGLE</span>
            <strong>Make the suggested angle yours</strong>
          </div>
          <small>{featuredTradeIds.length} key {featuredTradeIds.length === 1 ? "trade" : "trades"} attached</small>
        </div>

        <textarea
          value={storyAngle}
          onChange={(event) => {
            setStoryAngle(event.target.value);
            setSelectedId(null);
            setMessage(null);
          }}
          maxLength={1000}
          placeholder="Write the central story of this episode..."
        />

        <div className={styles.actions}>
          <p className={error ? styles.error : styles.message}>{error || message || "This becomes the anchor for the Script Builder."}</p>
          <button type="button" onClick={() => void saveStory()} disabled={saving || !storyAngle.trim()}>
            {saving ? "SAVING..." : episode.storyAngle ? "UPDATE STORY" : "SAVE STORY"}
          </button>
        </div>
      </section>
    </section>
  );
}
