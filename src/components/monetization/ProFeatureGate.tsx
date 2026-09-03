import Link from "next/link";
import styles from "./ProFeatureGate.module.css";

export function ProFeatureGate({
  title,
  description,
  features = [],
  compact = false,
}: {
  title: string;
  description: string;
  features?: string[];
  compact?: boolean;
}) {
  return (
    <section className={`${styles.gate} ${compact ? styles.compact : ""}`}>
      <div className={styles.badge}>FFZ PRO</div>
      <div className={styles.copy}>
        <span>PREMIUM FEATURE</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {features.length > 0 && (
          <ul>
            {features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
        )}
      </div>
      <Link className={styles.button} href="/upgrade">VIEW FFZ PRO</Link>
    </section>
  );
}
