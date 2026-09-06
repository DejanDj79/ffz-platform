"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const params = new URLSearchParams({
    from: pathname,
    feature: title,
  });

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
      <div className={styles.action}>
        <Link className={styles.button} href={`/upgrade?${params.toString()}`}>
          UNLOCK WITH FFZ PRO
        </Link>
        <small>From $8.25/mo billed yearly</small>
      </div>
    </section>
  );
}
