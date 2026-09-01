import Link from "next/link";
import styles from "./DashboardHome.module.css";

const modules = [
  {
    href: "/tools/risk-calculator",
    title: "Risk Calculator",
    description: "Calculate position size from stop distance, risk budget and challenge constraints.",
    status: "READY",
    accent: "cyan",
  },
  {
    href: "/challenges",
    title: "Challenge Planner",
    description: "Track prop rules, target progress, drawdown and active challenge state.",
    status: "READY",
    accent: "purple",
  },
  {
    href: "/journal",
    title: "Trade Journal",
    description: "Plan and review trades with execution, discipline and process scoring.",
    status: "NEXT",
    accent: "cyan",
  },
  {
    href: "/ledger",
    title: "Real Money Ledger",
    description: "Separate account P&L from the money that actually enters or leaves your bank account.",
    status: "NEXT",
    accent: "purple",
  },
];

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span>PLATFORM FOUNDATION</span>
          <h2>One workspace for the full trading journey.</h2>
          <p>Risk Calculator and Challenge Planner are live. Journal and Ledger are reserved for the next development stages.</p>
        </div>
        <div className={styles.foundationStatus}>
          <strong>2 / 4</strong>
          <span>core modules started</span>
        </div>
      </section>

      <section className={styles.grid}>
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className={`${styles.card} ${styles[module.accent]}`}>
            <div className={styles.cardTop}>
              <span className={styles.status}>{module.status}</span>
              <span className={styles.arrow}>→</span>
            </div>
            <h3>{module.title}</h3>
            <p>{module.description}</p>
            <div className={styles.bar} />
          </Link>
        ))}
      </section>

      <section className={styles.note}>
        <strong>Current storage mode</strong>
        <p>Challenge data is still stored locally in the browser. The App Shell is intentionally independent from the backend sprint.</p>
      </section>
    </div>
  );
}
