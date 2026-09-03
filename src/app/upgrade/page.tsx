import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLemonBillingAvailability } from "@/lib/billing/availability";
import { getUserBillingState } from "@/lib/billing/repository";
import {
  ManageSubscriptionButton,
  SubscribeAction,
} from "./BillingActions";
import styles from "./Upgrade.module.css";

const FREE_FEATURES = [
  "Public Risk Calculator",
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
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

export default async function UpgradePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/upgrade");

  const isPro = user.plan === "PRO";
  const billingAvailability = getLemonBillingAvailability();
  const billing = isPro ? await getUserBillingState(user.id) : null;
  const hasSubscription = Boolean(
    billing?.provider === "LEMON_SQUEEZY" && billing.subscriptionId,
  );
  const renewalLabel = billing?.status === "cancelled"
    ? formatDate(billing.endsAt)
    : formatDate(billing?.renewsAt ?? null);
  const currentBillingInterval = billing?.variantId === process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID
    ? "MONTHLY"
    : billing?.variantId === process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID
      ? "ANNUAL"
      : null;

  function proState(interval: "MONTHLY" | "ANNUAL") {
    if (!isPro) {
      return <SubscribeAction available={billingAvailability.available} interval={interval} />;
    }

    const isCurrentSubscription = hasSubscription && currentBillingInterval === interval;

    if (!isCurrentSubscription) {
      return (
        <div className={styles.planState}>
          {hasSubscription ? "Included with your current Pro subscription" : "Included in your Pro plan"}
        </div>
      );
    }

    return (
      <div className={styles.activeBilling}>
        <div className={`${styles.planState} ${styles.active}`}>
          PRO ACTIVE
          {billing?.status && <small>{billing.status.replaceAll("_", " ").toUpperCase()}</small>}
          {renewalLabel && (
            <small>
              {billing?.status === "cancelled" ? "ACCESS UNTIL" : "NEXT BILLING"} {renewalLabel}
            </small>
          )}
        </div>
        <ManageSubscriptionButton />
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>FFZ PLANS</span>
        <h1>Turn FFZ from a tracker into your prop trading operating system.</h1>
        <p>
          Free keeps the core workflow useful. Pro removes account limits and unlocks automation,
          guardrails and edge analytics. Your existing data stays visible if your plan changes.
        </p>
        <div className={styles.current}>
          CURRENT PLAN <strong>{user.plan}</strong>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.planKicker}>CORE</span>
            <h2>FREE</h2>
            <div className={styles.priceRow}>
              <strong>$0</strong>
              <small>forever</small>
            </div>
            <p>Core prop tracking and journaling tools.</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <div className={styles.planState}>{isPro ? "Included in your Pro plan" : "Your current plan"}</div>
        </article>

        <article className={`${styles.card} ${styles.proCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.planKicker}>MONTHLY</span>
            <h2>PRO</h2>
            <div className={styles.priceRow}>
              <strong>$12.99</strong>
              <small>/ month</small>
            </div>
            <p>Full FFZ access with flexible monthly billing.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          {proState("MONTHLY")}
        </article>

        <article className={`${styles.card} ${styles.proCard} ${styles.yearlyCard}`}>
          <div className={styles.savingsBadge}>SAVE 36%</div>
          <div className={styles.cardHeader}>
            <span className={styles.planKicker}>YEARLY</span>
            <h2>PRO</h2>
            <div className={styles.priceRow}>
              <strong>$99</strong>
              <small>/ year</small>
            </div>
            <p>$8.25/month equivalent · best value for long-term use.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          {proState("ANNUAL")}
        </article>
      </section>

      <section className={styles.footerCard}>
        <div>
          <span>NO DATA HOSTAGE</span>
          <strong>Downgrading never deletes your Journal, challenges or custom data.</strong>
          <p>Pro-only creation and automation pause; historical data remains visible.</p>
        </div>
        <Link href="/dashboard">BACK TO DASHBOARD</Link>
      </section>
    </main>
  );
}
