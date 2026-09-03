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
