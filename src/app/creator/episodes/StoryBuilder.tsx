"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatorEpisodeApiModel,
  CreatorStorySuggestion,
} from "@/lib/creator/episodes-types";
import styles from "./StoryBuilder.module.css";

function roleLabel(role: CreatorStorySuggestion["role"]) {
  if (role === "PRIMARY") return "PRIMARY STORY";
  if (role === "ALTERNATIVE") return "ALTERNATIVE STORY";
  return "OTHER THREAD";
}

function buttonLabel(suggestion: CreatorStorySuggestion, selected: boolean) {
  if (selected) return "SELECTED";
  if (suggestion.role === "PRIMARY") return "USE PRIMARY STORY";
  if (suggestion.role === "ALTERNATIVE") return "USE ALTERNATIVE";
  return "USE THIS THREAD";
}

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
            Creator ranks the evidence instead of forcing a fixed number of angles. The primary
            story is the strongest narrative supported by the period; weaker ideas become threads
            that can live inside the script rather than compete with it.
          </p>
        </div>
        <div className={styles.savedState}>
          <span>CURRENT STORY</span>
          <strong>{episode.storyAngle || "NOT SELECTED"}</strong>
        </div>
      </header>

      <div className={styles.suggestionGrid}>
        {suggestions.map((suggestion) => {
          const selected = selectedId === suggestion.id;
          return (
            <article
              key={suggestion.id}
              className={`${styles.suggestionCard} ${suggestion.role === "PRIMARY" ? styles.primaryCard : ""} ${suggestion.role === "THREAD" ? styles.threadCard : ""} ${selected ? styles.selectedCard : ""}`}
            >
              <div className={styles.cardTopline}>
                <span>{roleLabel(suggestion.role)}</span>
                <div className={styles.storyBadges}>
                  <b>{suggestion.strength}</b>
                  <em>{suggestion.tone}</em>
                </div>
              </div>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.why}</p>
              <div className={styles.keyMoments}>
                <span>{suggestion.role === "THREAD" ? "WHY THIS THREAD MATTERS" : "WHY THE STORY HOLDS"}</span>
                <ul>
                  {suggestion.keyMoments.map((moment) => <li key={moment}>{moment}</li>)}
                </ul>
              </div>
              <button type="button" onClick={() => chooseSuggestion(suggestion)}>
                {buttonLabel(suggestion, selected)}
              </button>
            </article>
          );
        })}
      </div>

      <section className={styles.finalStory}>
        <div className={styles.finalHeading}>
          <div>
            <span>FINAL STORY ANGLE</span>
            <strong>Make the primary story yours</strong>
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
