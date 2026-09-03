"use client";

import { useState } from "react";
import styles from "./Upgrade.module.css";

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

export function SubscribeActions() {
  const [loading, setLoading] = useState<"MONTHLY" | "ANNUAL" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(interval: "MONTHLY" | "ANNUAL") {
    setLoading(interval);
    setError(null);

    try {
      await redirectFromApi("/api/billing/checkout", { interval });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setLoading(null);
    }
  }

  return (
    <div className={styles.subscribeArea}>
      <div className={styles.priceOptions}>
        <button type="button" onClick={() => void start("MONTHLY")} disabled={loading !== null}>
          <span>MONTHLY</span>
          <strong>$12.99</strong>
          <small>/ month</small>
          <i>{loading === "MONTHLY" ? "OPENING CHECKOUT..." : "CHOOSE MONTHLY"}</i>
        </button>

        <button className={styles.bestValue} type="button" onClick={() => void start("ANNUAL")} disabled={loading !== null}>
          <b>SAVE 36%</b>
          <span>ANNUAL</span>
          <strong>$99</strong>
          <small>/ year · $8.25/mo</small>
          <i>{loading === "ANNUAL" ? "OPENING CHECKOUT..." : "CHOOSE ANNUAL"}</i>
        </button>
      </div>
      {error && <p className={styles.billingError}>{error}</p>}
      <p className={styles.checkoutNote}>Secure checkout and subscription billing are handled by Lemon Squeezy.</p>
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
