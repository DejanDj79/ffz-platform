import Link from "next/link";
import styles from "./EpisodeWorkflowNav.module.css";

export function EpisodeWorkflowNav({
  briefHref,
  storyHref,
  activeStep,
  storySaved,
}: {
  briefHref: string;
  storyHref: string;
  activeStep: "brief" | "story";
  storySaved: boolean;
}) {
  return (
    <nav className={styles.workflow} aria-label="Episode workflow">
      <Link className={activeStep === "brief" ? styles.active : ""} href={briefHref}>
        <span>01</span>
        <strong>BRIEF</strong>
      </Link>
      <Link className={activeStep === "story" ? styles.active : ""} href={storyHref}>
        <span>02</span>
        <strong>STORY</strong>
        {storySaved && <b>SAVED</b>}
      </Link>
      <div className={styles.locked}>
        <span>03</span>
        <strong>SCRIPT</strong>
        <small>NEXT</small>
      </div>
      <div className={styles.locked}>
        <span>04</span>
        <strong>RECORD</strong>
      </div>
      <div className={styles.locked}>
        <span>05</span>
        <strong>PUBLISH</strong>
      </div>
    </nav>
  );
}
