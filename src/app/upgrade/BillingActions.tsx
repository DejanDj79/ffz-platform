"use client";

import { useState } from "react";
import styles from "./Upgrade.module.css";

type BillingInterval = "MONTHLY" | "ANNUAL";

type ApiResponse = {
  data?: { url?: string };
  error?: string;
};

async function redirectFromApi(path: string, body?: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json() as ApiResponse;
  if (!response.ok || !json.data?.url) {
    throw new Error(json.error || "Billing request failed.");
  }

  window.location.assign(json.data.url);
}

export function SubscribeAction({
  available,
  interval,
}: {
  available: boolean;
  interval: BillingInterval;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!available) return;

    setLoading(true);
    setError(null);

    try {
      await redirectFromApi("/api/billing/checkout", { interval });
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
              ? "CHOOSE MONTHLY"
              : "CHOOSE YEARLY"}
      </button>
      {error && <p className={styles.billingError}>{error}</p>}
      <p className={styles.checkoutNote}>
        {available
          ? "Secure checkout and subscription billing are handled by Lemon Squeezy."
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
}: {
  available: boolean;
  soldOut: boolean;
  remaining: number;
  hasSubscription: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!available || soldOut) return;

    setLoading(true);
    setError(null);

    try {
      await redirectFromApi("/api/billing/founder-checkout");
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
            ? `${remaining} Founder spot${remaining === 1 ? "" : "s"} currently available. Secure one-time checkout is handled by Lemon Squeezy.`
            : "Founder checkout will open when the one-time Lemon Squeezy product is configured."}
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
