import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getFounderBillingAvailability,
  getLemonBillingAvailability,
} from "@/lib/billing/availability";
import { getFounderOfferState } from "@/lib/billing/founder-repository";
import { getUserBillingState } from "@/lib/billing/repository";
import {
  safeFeatureName,
  safeInternalReturnPath,
} from "@/lib/navigation/safe-return";
import {
  FounderAction,
  ManageSubscriptionButton,
  ProPlanSelector,
  UpgradeActivationBanner,
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

type UpgradePageProps = {
  searchParams: Promise<{
    checkout?: string;
    from?: string;
    feature?: string;
  }>;
};

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const query = await searchParams;
  const returnTo = safeInternalReturnPath(query.from);
  const feature = safeFeatureName(query.feature);
  const checkout = query.checkout === "success" || query.checkout === "founder-success"
    ? query.checkout
    : null;

  const user = await getCurrentUser();
  if (!user) {
    const next = new URLSearchParams();
    if (returnTo) next.set("from", returnTo);
    if (feature) next.set("feature", feature);
    const suffix = next.size > 0 ? `?${next.toString()}` : "";
    redirect(`/login?next=${encodeURIComponent(`/upgrade${suffix}`)}`);
  }

  const isPro = user.plan === "PRO";
  const billingAvailability = getLemonBillingAvailability();
  const founderAvailability = getFounderBillingAvailability();
  const founderOffer = await getFounderOfferState(user.id);
  const isFounder = founderOffer.userStatus === "PURCHASED";
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
  const founderDisplayRemaining = founderOffer.remaining + (founderOffer.hasActiveReservation ? 1 : 0);

  function proState() {
    if (isFounder) {
      return <div className={styles.planState}>Included with Founder lifetime access</div>;
    }

    if (!isPro) {
      return (
        <ProPlanSelector
          available={billingAvailability.available}
          returnTo={returnTo}
          feature={feature}
        />
      );
    }

    if (!hasSubscription) {
      return <div className={`${styles.planState} ${styles.active}`}>PRO ACTIVE</div>;
    }

    return (
      <div className={styles.activeBilling}>
        <div className={`${styles.planState} ${styles.active}`}>
          PRO ACTIVE
          {currentBillingInterval && <small>{currentBillingInterval}</small>}
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
      <UpgradeActivationBanner
        checkout={checkout}
        returnTo={returnTo}
        feature={feature}
      />

      <section className={styles.hero}>
        <span className={styles.eyebrow}>FFZ PLANS</span>
        <h1>Turn FFZ from a tracker into your prop trading operating system.</h1>
        <p>
          Free keeps the core workflow useful. Pro removes account limits and unlocks automation,
          guardrails and edge analytics. Founder Trader adds a limited lifetime option for the first
          150 traders. Your existing data stays visible if your plan changes.
        </p>
        <div className={styles.heroMeta}>
          <div className={styles.current}>
            CURRENT PLAN <strong>{isFounder ? "FOUNDER" : user.plan}</strong>
          </div>
          {feature && returnTo && !checkout && (
            <div className={styles.contextChip}>
              UNLOCKING <strong>{feature}</strong>
              <span>Return automatically after activation</span>
            </div>
          )}
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
            <p>Core prop tracking and journaling tools that stay useful without a subscription.</p>
          </div>
          <FeatureList items={FREE_FEATURES} />
          <div className={styles.planState}>
            {isFounder ? "Included in your Founder access" : isPro ? "Included in your Pro plan" : "Your current plan"}
          </div>
        </article>

        <article className={`${styles.card} ${styles.proCard}`}>
          <div className={styles.recommendedBadge}>RECOMMENDED</div>
          <div className={styles.cardHeader}>
            <span className={styles.planKicker}>FULL WORKFLOW</span>
            <h2>PRO</h2>
            <div className={styles.priceRow}>
              <strong>From $8.25</strong>
              <small>/ month</small>
            </div>
            <p>Choose monthly flexibility or save 36% with yearly billing.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          {proState()}
        </article>

        <article className={`${styles.card} ${styles.founderCard}`}>
          <div className={styles.founderBadge}>
            {founderOffer.soldOut
              ? "SOLD OUT · 150 CLAIMED"
              : `LIMITED · ${founderDisplayRemaining} SPOTS LEFT`}
          </div>
          <div className={styles.cardHeader}>
            <span className={styles.planKicker}>ONE-TIME</span>
            <h2>FOUNDER</h2>
            <div className={styles.founderName}>TRADER</div>
            <div className={styles.priceRow}>
              <strong>$199</strong>
              <small>one-time</small>
            </div>
            <p>Lifetime FFZ Pro access with one payment. Available only to the first 150 traders.</p>
          </div>
          <FeatureList items={PRO_FEATURES} />
          {user.role === "CREATOR" ? (
            <div className={styles.planState}>Creator access already includes Pro</div>
          ) : isFounder ? (
            <div className={`${styles.planState} ${styles.active}`}>
              FOUNDER ACTIVE
              {founderOffer.userSlotNo && <small>FOUNDER SLOT #{founderOffer.userSlotNo}</small>}
            </div>
          ) : founderOffer.userStatus === "REFUNDED" ? (
            <div className={styles.planState}>Founder purchase refunded</div>
          ) : (
            <FounderAction
              available={founderAvailability.available}
              soldOut={founderOffer.soldOut}
              remaining={founderDisplayRemaining}
              hasSubscription={hasSubscription}
              returnTo={returnTo}
              feature={feature}
            />
          )}
        </article>
      </section>

      <section className={styles.footerCard}>
        <div>
          <span>NO DATA HOSTAGE</span>
          <strong>Downgrading never deletes your Journal, challenges or custom data.</strong>
          <p>Pro-only creation and automation pause; historical data remains visible.</p>
        </div>
        <Link href={returnTo ?? "/dashboard"}>
          {feature && returnTo ? `BACK TO ${feature.toUpperCase()}` : "BACK TO DASHBOARD"}
        </Link>
      </section>
    </main>
  );
}
