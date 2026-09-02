import Link from "next/link";
import styles from "./JournalNav.module.css";

export function JournalNav({ active }: { active: "TRADES" | "ANALYTICS" }) {
  return (
    <nav className={styles.nav} aria-label="Journal views">
      <div>
        <span className={styles.eyebrow}>TRADE JOURNAL</span>
        <strong>{active === "TRADES" ? "Trades" : "Analytics"}</strong>
      </div>

      <div className={styles.tabs}>
        <Link href="/journal" className={active === "TRADES" ? styles.active : ""}>
          TRADES
        </Link>
        <Link
          href="/journal/analytics"
          className={active === "ANALYTICS" ? styles.active : ""}
        >
          ANALYTICS
        </Link>
      </div>
    </nav>
  );
}
