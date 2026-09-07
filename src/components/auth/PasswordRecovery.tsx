"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "@/app/login/Auth.module.css";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(!reset);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reset) return;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(value);
    setReady(true);
  }, [reset]);

  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (reset && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    if (reset && new TextEncoder().encode(password).length > 72) {
      setError("Password is too long. Use at most 72 bytes.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${reset ? "reset-password" : "forgot-password"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { token, password } : { email }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Unable to complete your request. Try again.");
      setDone(true);
      setPassword("");
      setConfirmation("");
      if (reset) {
        setToken("");
        window.history.replaceState(window.history.state, "", "/reset-password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete your request. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Image src="/ffz-logo.png" alt="Futures From Zero" width={420} height={130} className={styles.logo} priority />
        <span className={styles.eyebrow}>FFZ PLATFORM</span>
        <h1>{done ? (reset ? "Password updated" : "Check your email") : (reset ? "Reset password" : "Forgot password?")}</h1>
        <p className={styles.intro} role={done ? "status" : undefined}>
          {done ? (reset
            ? "Your password has been changed and existing sessions have been signed out. Sign in with your new password."
            : "If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder. The link expires in 30 minutes.")
            : (reset ? "Choose a new password for your FFZ account." : "Enter your account email and we will send you a reset link.")}
        </p>
        {!done && ready && (!reset || validToken) && (
          <form className={styles.form} onSubmit={submit}>
            {!reset ? (
              <label className={styles.field}><span>Email</span>
                <input type="email" autoComplete="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
              </label>
            ) : (<>
              <label className={styles.field}><span>New password</span>
                <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} aria-describedby="password-hint" />
              </label>
              <small id="password-hint">Use at least 8 characters.</small>
              <label className={styles.field}><span>Confirm new password</span>
                <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required disabled={busy} />
              </label>
            </>)}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "PLEASE WAIT..." : reset ? "SAVE NEW PASSWORD" : "SEND RESET LINK"}
            </button>
          </form>
        )}
        {reset && ready && !validToken && !done && <p className={styles.error} role="alert">This reset link is missing or invalid. Request a new link below.</p>}
        {reset && !done && <p className={styles.switch}><Link href="/forgot-password">Request a new reset link</Link></p>}
        <p className={styles.switch}><Link href="/login">Back to sign in</Link></p>
      </section>
    </main>
  );
}
