import Link from "next/link";
import styles from "./EpisodeWorkflowNav.module.css";

export function EpisodeWorkflowNav({
  briefHref,
  storyHref,
  scriptHref,
  recordHref,
  publishHref,
  activeStep,
  storySaved,
  scriptSaved,
  recorded,
  published,
}: {
  briefHref: string;
  storyHref: string;
  scriptHref: string;
  recordHref: string;
  publishHref: string;
  activeStep: "brief" | "story" | "script" | "record" | "publish";
  storySaved: boolean;
  scriptSaved: boolean;
  recorded: boolean;
  published: boolean;
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
      {storySaved ? (
        <Link className={activeStep === "script" ? styles.active : ""} href={scriptHref}>
          <span>03</span>
          <strong>SCRIPT</strong>
          {scriptSaved ? <b>READY</b> : <small>NEXT</small>}
        </Link>
      ) : (
        <div className={styles.locked}>
          <span>03</span>
          <strong>SCRIPT</strong>
          <small>SAVE STORY</small>
        </div>
      )}
      {scriptSaved ? (
        <Link className={activeStep === "record" ? styles.active : ""} href={recordHref}>
          <span>04</span>
          <strong>RECORD</strong>
          {recorded ? <b>RECORDED</b> : <small>NEXT</small>}
        </Link>
      ) : (
        <div className={styles.locked}>
          <span>04</span>
          <strong>RECORD</strong>
          <small>SAVE SCRIPT</small>
        </div>
      )}
      {recorded ? (
        <Link className={activeStep === "publish" ? styles.active : ""} href={publishHref}>
          <span>05</span>
          <strong>PUBLISH</strong>
          {published ? <b>PUBLISHED</b> : <small>NEXT</small>}
        </Link>
      ) : (
        <div className={styles.locked}>
          <span>05</span>
          <strong>PUBLISH</strong>
          <small>MARK RECORDED</small>
        </div>
      )}
    </nav>
  );
}
