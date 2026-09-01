import Link from "next/link";
import styles from "./ModulePlaceholder.module.css";

export function ModulePlaceholder({
  title,
  description,
  nextStep,
}: {
  title: string;
  description: string;
  nextStep: string;
}) {
  return (
    <section className={styles.placeholder}>
      <div className={styles.kicker}>MODULE RESERVED</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.statusRow}>
        <span><i />Planned</span>
        <small>{nextStep}</small>
      </div>
      <Link href="/dashboard">Back to Dashboard</Link>
    </section>
  );
}
