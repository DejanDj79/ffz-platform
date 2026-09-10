import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./Pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing | FFZ Platform",
  description:
    "FFZ Platform pricing for futures trading journaling, risk management, prop challenge tracking and analytics.",
};

const FREE_FEATURES = [
  "Risk Calculator",
  "1 active Challenge / Funded account",
  "Manual Trade Journal",
  "Basic Journal Analytics",
  "Economic Calendar",
  "Built-in prop firm rules",
];

const PRO_FEATURES = [
  "Unlimited Challenge / Funded accounts",
  "CSV trade import",
  "Journal → Challenge automatic sync",
  "Setup Edge analytics",
  "Time-of-day analytics",
  "Personal Trading Guardrails",
  "Economic-news lockout",
  "Reusable custom prop rules",
  "Prop Journey cost / payout analytics",
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className={styles.features}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/pricing" aria-label="FFZ Platform pricing">
          <Image src="/ffz-logo.png" alt="FFZ" width={58} height={58} priority />
          <strong>FUTURES FROM ZERO</strong>
        </Link>
        <div className={styles.navActions}>
          <Link href="/journey">JOURNEY</Link>
          <Link href="/tools/risk-calculator">RISK CALCULATOR</Link>
          <Link href="/login">LOG IN</Link>
          <Link className={styles.primaryNav} href="/register">START FREE</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>FFZ PLATFORM PRICING</span>
        <h1>A futures trading workflow built around process, risk and accountability.</h1>
        <p>
          Use the core FFZ workflow for free, or unlock deeper prop challenge tracking,
          automation, guardrails and analytics with Pro.
        </p>
      </section>

      <section className={styles.grid} aria-label="FFZ pricing plans">
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <span>CORE</span>
            <h2>FREE</h2>
            <div className={styles.price}><strong>$0</strong><small>forever</small></div>
            <p>Core tools for risk planning, journaling and one active prop account.</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <Link className={styles.secondaryButton} href="/register">START FREE</Link>
        </article>

        <article className={`${styles.card} ${styles.proCard}`}>
          <div className={styles.badge}>RECOMMENDED</div>
          <div className={styles.cardHeader}>
            <span>FULL WORKFLOW</span>
            <h2>PRO</h2>
            <div className={styles.splitPrice}>
              <div><strong>$12.99</strong><small>/ month</small></div>
              <div><strong>$99</strong><small>/ year</small></div>
            </div>
            <p>Yearly billing equals $8.25/month and saves about 36% versus monthly.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          <Link className={styles.primaryButton} href="/login?next=%2Fupgrade">CHOOSE PRO</Link>
        </article>

        <article className={`${styles.card} ${styles.founderCard}`}>
          <div className={styles.founderBadge}>LIMITED TO 150 TRADERS</div>
          <div className={styles.cardHeader}>
            <span>ONE-TIME</span>
            <h2>FOUNDER</h2>
            <div className={styles.price}><strong>$199</strong><small>one-time</small></div>
            <p>Lifetime FFZ Pro access with one payment, available only while Founder spots remain.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          <Link className={styles.secondaryButton} href="/login?next=%2Fupgrade">VIEW FOUNDER OFFER</Link>
        </article>
      </section>

      <section className={styles.note}>
        <div>
          <span>WHAT FFZ IS</span>
          <h2>Software for managing your own trading process.</h2>
          <p>
            FFZ Platform provides journaling, analytics, risk calculation and prop challenge workflow tools.
            It does not provide brokerage services, trading signals, investment management or personalized financial advice.
          </p>
        </div>
        <Link href="/register">CREATE FREE ACCOUNT</Link>
      </section>

      <footer className={styles.footer}>
        <div>
          <strong>FUTURES FROM ZERO</strong>
          <p>Trading involves risk. FFZ is a software tool, not financial advice.</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refunds</Link>
          <Link href="/journey">Public Journey</Link>
          <Link href="/login">Log in</Link>
        </div>
      </footer>
    </main>
  );
}
