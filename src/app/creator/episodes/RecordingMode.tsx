"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreatorEpisodeApiModel } from "@/lib/creator/episodes-types";
import styles from "./RecordingMode.module.css";

type ScriptBlock =
  | { type: "section"; text: string; cue: string | null }
  | { type: "talking-point"; text: string }
  | { type: "key-trade"; text: string }
  | { type: "speech"; text: string };

function parseScript(script: string): ScriptBlock[] {
  return script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const section = line.match(/^\[(.+?) · ~.+? MIN · (.+?)\]$/);
      if (section) return { type: "section", text: section[1], cue: section[2] } as const;

      const talkingPoint = line.match(/^\[TALKING POINT:\s*(.+)\]$/);
      if (talkingPoint) return { type: "talking-point", text: talkingPoint[1] } as const;

      if (/^KEY TRADE \d+$/i.test(line)) {
        return { type: "key-trade", text: line } as const;
      }

      return { type: "speech", text: line } as const;
    });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const MIN_SCROLL_SPEED = 2;
const MAX_SCROLL_SPEED = 60;
const SCROLL_SPEED_STEP = 2;

export function RecordingMode({ episode }: { episode: CreatorEpisodeApiModel }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(12);
  const [fontSize, setFontSize] = useState(34);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const blocks = useMemo(() => parseScript(episode.script ?? ""), [episode.script]);
  const talkingPoints = useMemo(
    () => blocks.filter((block) => block.type === "talking-point").length,
    [blocks],
  );

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    function tick(timestamp: number) {
      const scroller = scrollerRef.current;
      if (!scroller || !playingRef.current) {
        lastFrameRef.current = timestamp;
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const previous = lastFrameRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.1, (timestamp - previous) / 1000);
      lastFrameRef.current = timestamp;
      scroller.scrollTop += speed * deltaSeconds;

      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      if (atEnd) setPlaying(false);
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [speed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      if (event.key === "F13" || event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
        return;
      }
      if (event.key === "F14") {
        event.preventDefault();
        setSpeed((value) => clamp(value - SCROLL_SPEED_STEP, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED));
        return;
      }
      if (event.key === "F15") {
        event.preventDefault();
        setSpeed((value) => clamp(value + SCROLL_SPEED_STEP, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED));
        return;
      }
      if (event.key === "F16") {
        event.preventDefault();
        setFontSize((value) => clamp(value - 2, 22, 54));
        return;
      }
      if (event.key === "F17") {
        event.preventDefault();
        setFontSize((value) => clamp(value + 2, 22, 54));
        return;
      }
      if (event.key === "F18") {
        event.preventDefault();
        if (scrollerRef.current) scrollerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        setPlaying(false);
        return;
      }
      if (event.key === "F19") {
        event.preventDefault();
        void toggleFullscreen();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await stageRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  function restart() {
    setPlaying(false);
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function markRecorded() {
    if (saving || episode.status === "RECORDED") return;
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/creator/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECORDED" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Unable to mark episode recorded.");
      setMessage("Episode marked RECORDED.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark episode recorded.");
    } finally {
      setSaving(false);
    }
  }

  if (!episode.script) return null;

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>RECORD MODE</span>
          <h2>Teleprompter + producer cues</h2>
          <p>
            Spoken copy scrolls normally. Talking points are producer cues: use them to speak naturally,
            do not read the bracketed prompt word-for-word.
          </p>
        </div>
        <div className={styles.headerStats}>
          <span>{talkingPoints} TALKING POINTS</span>
          <strong>{episode.status.replaceAll("_", " ")}</strong>
        </div>
      </header>

      <div ref={stageRef} className={styles.stage}>
        <div className={styles.toolbar}>
          <button type="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? "PAUSE" : "PLAY"}
          </button>
          <button type="button" onClick={() => setSpeed((value) => clamp(value - SCROLL_SPEED_STEP, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED))}>SLOWER</button>
          <span>{speed} PX/S</span>
          <button type="button" onClick={() => setSpeed((value) => clamp(value + SCROLL_SPEED_STEP, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED))}>FASTER</button>
          <button type="button" onClick={() => setFontSize((value) => clamp(value - 2, 22, 54))}>A−</button>
          <span>{fontSize} PX</span>
          <button type="button" onClick={() => setFontSize((value) => clamp(value + 2, 22, 54))}>A+</button>
          <button type="button" onClick={restart}>RESTART</button>
          <button type="button" onClick={() => void toggleFullscreen()}>FULLSCREEN</button>
        </div>

        <div ref={scrollerRef} className={styles.scroller}>
          <div className={styles.script} style={{ "--record-font-size": `${fontSize}px` } as React.CSSProperties}>
            <div className={styles.leadSpace} />
            {blocks.map((block, index) => {
              if (block.type === "section") {
                return (
                  <div className={styles.sectionMarker} key={`${block.text}-${index}`}>
                    <strong>{block.text}</strong>
                    {block.cue && <span>{block.cue}</span>}
                  </div>
                );
              }
              if (block.type === "talking-point") {
                return (
                  <aside className={styles.producerCue} key={`${block.text}-${index}`}>
                    <span>PRODUCER CUE · DON&apos;T READ</span>
                    <strong>{block.text}</strong>
                  </aside>
                );
              }
              if (block.type === "key-trade") {
                return <h3 className={styles.keyTrade} key={`${block.text}-${index}`}>{block.text}</h3>;
              }
              return <p className={styles.speech} key={`${block.text}-${index}`}>{block.text}</p>;
            })}
            <div className={styles.tailSpace} />
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div>
          <strong>CV09 / KEYBOARD</strong>
          <span>F13 Play/Pause · F14/F15 Speed · F16/F17 Text · F18 Restart · F19 Fullscreen · Space Play/Pause</span>
        </div>
        <div className={styles.recordAction}>
          {message && <span>{message}</span>}
          <button type="button" onClick={() => void markRecorded()} disabled={saving || episode.status === "RECORDED"}>
            {episode.status === "RECORDED" ? "RECORDED" : saving ? "SAVING..." : "MARK RECORDED"}
          </button>
        </div>
      </footer>
    </section>
  );
}
