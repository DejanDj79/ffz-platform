"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to create account.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
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
        <h1>Create account</h1>
        <p className={styles.intro}>
          Your challenges and future journal data will belong to this account.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Name (optional)</span>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
            />
          </label>

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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "CREATING..." : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className={styles.switch}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
