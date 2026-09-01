"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Auth.module.css";

function safeNextPath() {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to sign in.");
      }

      router.replace(safeNextPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Image
          src="/ffz-logo.png"
          alt="Futures From Zero"
          width={420}
          height={130}
          className={styles.logo}
          priority
        />
        <span className={styles.eyebrow}>FFZ PLATFORM</span>
        <h1>Sign in</h1>
        <p className={styles.intro}>Continue to your trading workspace.</p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>

        <p className={styles.switch}>
          No account yet? <Link href="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}
