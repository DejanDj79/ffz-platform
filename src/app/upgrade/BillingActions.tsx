"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeInternalReturnPath } from "@/lib/navigation/safe-return";
import styles from "./Upgrade.module.css";

type BillingInterval = "MONTHLY" | "ANNUAL";
type CheckoutKind = "success" | "founder-success";
type AccessLabel = "FREE" | "PRO" | "FOUNDER" | "CREATOR";

type FastSpringCheckoutConfig = {
  provider: "FASTSPRING";
  productPath: string;
  customerEmail: string;
  testMode: boolean;
  tags: Record<string, string>;
};

type ApiResponse = {
  data?: {
    url?: string;
    checkout?: FastSpringCheckoutConfig;
  };
  error?: string;
};

type AuthResponse = {
  data?: {
    plan?: "FREE" | "PRO";
    access?: AccessLabel;
  };
};

type FastSpringSession = {
  reset: boolean;
  products: Array<{ path: string; quantity: number }>;
  paymentContact: { email: string };
  tags: Record<string, string>;
  checkout: boolean;
};

type FastSpringSdk = {
  builder: {
    push: (session: FastSpringSession) => void;
  };
};

declare global {
  interface Window {
    fastspring?: FastSpringSdk;
  }
}

async function getFastSpring() {
  if (window.fastspring?.builder) return window.fastspring;

  return new Promise<FastSpringSdk>((resolve, reject) => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.fastspring?.builder) {
        window.clearInterval(timer);
        resolve(window.fastspring);
        return;
      }

      if (attempts >= 50) {
        window.clearInterval(timer);
        reject(new Error("FastSpring checkout did not load. Reload the page and try again."));
      }
    }, 100);
  });
}

async function billingRequest(path: string, body?: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json() as ApiResponse;
  if (!response.ok) throw new Error(json.error || "Billing request failed.");
  return json;
}

async function openFastSpringFromApi(path: string, body?: object) {
  const json = await billingRequest(path, body);
  const checkout = json.data?.checkout;
  if (!checkout || checkout.provider !== "FASTSPRING") {
    throw new Error("FastSpring checkout configuration is unavailable.");
  }

  const fastSpring = await getFastSpring();
  fastSpring.builder.push({
    reset: true,
    products: [{ path: checkout.productPath, quantity: 1 }],
    paymentContact: { email: checkout.customerEmail },
    tags: checkout.tags,
    checkout: true,
  });
}

async function redirectFromApi(path: string) {
  const json = await billingRequest(path);
  if (!json.data?.url) throw new Error(json.error || "Billing request failed.");
  window.location.assign(json.data.url);
}

export function UpgradeActivationBanner({
  checkout,
  returnTo,
  feature,
}: {
  checkout: CheckoutKind | null;
  returnTo: string | null;
  feature: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "active" | "delayed">("checking");

  useEffect(() => {
    if (!checkout) return;

    let cancelled = false;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const requiresFounder = checkout === "founder-success";

    async function check() {
      if (cancelled) return;
      attempts += 1;

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await response.json() as AuthResponse;
        const access = json.data?.access;
        const activated = requiresFounder
          ? access === "FOUNDER"
          : access === "PRO" || access === "FOUNDER" || access === "CREATOR";

        if (response.ok && activated) {
          setPhase("active");
          const safeReturn = safeInternalReturnPath(returnTo);
          timeout = setTimeout(() => {
            if (safeReturn && safeReturn !== "/upgrade") {
              router.replace(safeReturn);
            } else {
              router.replace("/upgrade");
              router.refresh();
            }
          }, 900);
          return;
        }
      } catch {
        // Webhook activation can lag briefly; keep polling until the timeout.
      }

      if (attempts >= 10) {
        setPhase("delayed");
        return;
      }

      timeout = setTimeout(check, 1200);
    }

    void check();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [checkout, returnTo, router]);

  if (!checkout) return null;

  const founder = checkout === "founder-success";
  const target = feature ? ` ${feature}` : " your previous FFZ feature";

  return (
    <section className={`${styles.activationBanner} ${phase === "active" ? styles.activationReady : ""}`}>
      <div className={styles.activationPulse} aria-hidden="true" />
      <div>
        <span>{founder ? "FOUNDER CHECKOUT" : "FFZ PRO CHECKOUT"}</span>
        <strong>
          {phase === "active"
            ? `${founder ? "Founder" : "FFZ Pro"} access is active.`
            : phase === "delayed"
              ? "Payment received. Activation is taking a little longer than usual."
              : `Payment received. Activating ${founder ? "your Founder access" : "FFZ Pro"}...`}
        </strong>
        <small>
          {phase === "active"
            ? returnTo
              ? `Returning to${target}...`
              : "Your plan is ready to use."
            : phase === "delayed"
              ? "Your payment is safe. The billing webhook may still be processing; check again in a moment."
              : "This usually takes only a few seconds while FFZ confirms the billing webhook."}
        </small>
      </div>
      {phase === "delayed" && (
        <button type="button" onClick={() => window.location.reload()}>
          CHECK AGAIN
        </button>
      )}
    </section>
  );
}

export function ProPlanSelector({
  available,
  returnTo,
  feature,
}: {
  available: boolean;
  returnTo: string | null;
  feature: string | null;
}) {
  const [interval, setInterval] = useState<BillingInterval>("ANNUAL");
  const annual = interval === "ANNUAL";

  return (
    <div className={styles.proChoice}>
      <div className={styles.billingToggle} aria-label="FFZ Pro billing interval">
        <button
          type="button"
          className={!annual ? styles.billingToggleActive : undefined}
          onClick={() => setInterval("MONTHLY")}
        >
          MONTHLY
        </button>
        <button
          type="button"
          className={annual ? styles.billingToggleActive : undefined}
          onClick={() => setInterval("ANNUAL")}
        >
          YEARLY <span>SAVE 36%</span>
        </button>
      </div>

      <div className={styles.selectedPrice}>
        <div>
          <strong>{annual ? "$99" : "$12.99"}</strong>
          <small>{annual ? "/ year" : "/ month"}</small>
        </div>
        <span>{annual ? "$8.25/month equivalent" : "Flexible monthly billing"}</span>
      </div>

      <SubscribeAction
        available={available}
        interval={interval}
        returnTo={returnTo}
        feature={feature}
      />
    </div>
  );
}

export function SubscribeAction({
  available,
  interval,
  returnTo,
  feature,
}: {
  available: boolean;
  interval: BillingInterval;
  returnTo: string | null;
  feature: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!available) return;

    setLoading(true);
    setError(null);

    try {
      await openFastSpringFromApi("/api/billing/checkout", {
        interval,
        returnTo,
        feature,
      });
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.subscribeArea}>
      <button
        className={interval === "ANNUAL" ? styles.annualButton : undefined}
        type="button"
        onClick={() => void start()}
        disabled={!available || loading}
      >
        {!available
          ? "COMING SOON"
          : loading
            ? "OPENING CHECKOUT..."
            : interval === "MONTHLY"
              ? "START MONTHLY PRO"
              : "START YEARLY PRO"}
      </button>
      {error && <p className={styles.billingError}>{error}</p>}
      <p className={styles.checkoutNote}>
        {available
          ? "Secure checkout, tax and subscription billing are handled by FastSpring."
          : "FFZ Pro subscriptions are being prepared and will be available soon."}
      </p>
    </div>
  );
}

export function FounderAction({
  available,
  soldOut,
  remaining,
  hasSubscription,
  returnTo,
  feature,
}: {
  available: boolean;
  soldOut: boolean;
  remaining: number;
  hasSubscription: boolean;
  returnTo: string | null;
  feature: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!available || soldOut) return;

    setLoading(true);
    setError(null);

    try {
      await openFastSpringFromApi("/api/billing/founder-checkout", {
        returnTo,
        feature,
      });
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Founder checkout.");
      setLoading(false);
    }
  }

  const buttonLabel = soldOut
    ? "SOLD OUT"
    : !available
      ? "COMING SOON"
      : loading
        ? "OPENING CHECKOUT..."
        : "GET FOUNDER ACCESS";

  return (
    <div className={styles.subscribeArea}>
      <button
        className={styles.founderButton}
        type="button"
        onClick={() => void start()}
        disabled={!available || soldOut || loading}
      >
        {buttonLabel}
      </button>
      {error && <p className={styles.billingError}>{error}</p>}
      <p className={styles.checkoutNote}>
        {soldOut
          ? "All 150 Founder Trader spots have been claimed."
          : available
            ? `${remaining} Founder spot${remaining === 1 ? "" : "s"} currently available. Secure one-time checkout is handled by FastSpring.`
            : "Founder checkout will open when the one-time FastSpring product is configured."}
      </p>
      {available && !soldOut && hasSubscription && (
        <p className={styles.checkoutNote}>
          Your existing Pro subscription will be set to cancel at the end of its paid period after Founder activates.
        </p>
      )}
    </div>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manage() {
    setLoading(true);
    setError(null);

    try {
      await redirectFromApi("/api/billing/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.manageArea}>
      <button type="button" onClick={() => void manage()} disabled={loading}>
        {loading ? "OPENING BILLING..." : "MANAGE SUBSCRIPTION"}
      </button>
      {error && <p className={styles.billingError}>{error}</p>}
    </div>
  );
}
