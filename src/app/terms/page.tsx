import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../legal/LegalPage.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | FFZ Platform",
  description: "Terms governing use of FFZ Platform and paid FFZ access plans.",
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/pricing" aria-label="FFZ Platform">
          <Image src="/ffz-logo.png" alt="FFZ" width={54} height={54} priority />
          <strong>FUTURES FROM ZERO</strong>
        </Link>
        <div className={styles.navActions}>
          <Link href="/pricing">PRICING</Link>
          <Link href="/privacy">PRIVACY</Link>
          <Link href="/refund">REFUNDS</Link>
          <Link href="/login">LOG IN</Link>
        </div>
      </nav>

      <header className={styles.header}>
        <span className={styles.eyebrow}>LEGAL</span>
        <h1>Terms of Service</h1>
        <p>Effective date: September 11, 2026</p>
      </header>

      <article className={styles.content}>
        <section className={styles.section}>
          <h2>1. About FFZ Platform</h2>
          <p>
            These Terms of Service govern your access to and use of FFZ Platform, operated by Dejan Djordjevic
            ("FFZ", "we", "us" or "our"). FFZ Platform is a web-based software product for futures trading
            journaling, risk calculation, prop-firm challenge tracking, analytics and related workflow tools.
          </p>
          <p>
            By creating an account, purchasing a paid plan or otherwise using FFZ Platform, you agree to these Terms.
            If you do not agree, do not use the service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Eligibility and account responsibility</h2>
          <p>You must be at least 18 years old and legally able to enter into a binding agreement to use FFZ Platform.</p>
          <p>
            You are responsible for providing accurate account information, keeping your login credentials secure and
            all activity performed through your account. Please contact us promptly if you believe your account has
            been accessed without authorization.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Software only — no financial services or advice</h2>
          <p>
            FFZ Platform is a productivity, journaling, analytics and risk-management software tool. It is not a broker,
            investment adviser, commodity trading adviser, prop firm, trading signal provider or money manager.
          </p>
          <p>
            We do not execute trades, hold or manage customer funds, provide personalized financial advice, guarantee
            trading results, provide copy trading or make trading decisions for you. Any trading decision remains solely
            your responsibility.
          </p>
          <div className={styles.callout}>
            Futures trading involves substantial risk and may result in losses. Historical or simulated results do not
            guarantee future performance.
          </div>
        </section>

        <section className={styles.section}>
          <h2>4. Plans, billing and renewals</h2>
          <p>
            FFZ may offer free access, recurring Pro subscriptions and limited one-time Founder access. Current pricing
            and plan details are shown on the <Link href="/pricing">Pricing page</Link>.
          </p>
          <p>
            Recurring subscriptions renew automatically at the applicable billing interval unless cancelled before the
            next renewal date. You may cancel a recurring subscription through the available billing-management flow.
            Cancellation stops future renewals and does not normally end access before the already-paid period expires.
          </p>
          <p>
            Payments may be processed by Lemon Squeezy or another authorized payment provider acting as merchant of
            record or payment processor. Applicable taxes may be added or handled by the payment provider.
          </p>
          <p>
            Founder access is a one-time purchase that provides lifetime FFZ Pro access while FFZ Platform continues to
            operate and offer the relevant Pro service. It is limited in availability and does not create ownership,
            equity or decision-making rights in FFZ Platform.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Refunds</h2>
          <p>
            Refund eligibility is governed by our <Link href="/refund">Refund Policy</Link>. In summary, eligible first
            Pro or Founder purchases may be refunded when requested within 14 days of the initial purchase, subject to
            the policy and any mandatory consumer rights that apply.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Your content and trading data</h2>
          <p>
            You retain ownership of data and content you submit to FFZ Platform, including trade records, notes and
            uploaded trade-related attachments. You grant us a limited right to host, process, back up and display that
            content only as needed to provide, secure, maintain and improve the service.
          </p>
          <p>
            You are responsible for ensuring that content you upload is lawful and that you have the right to use it.
            Do not upload credentials, secrets or material that infringes the rights of others.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Acceptable use</h2>
          <p>You may not misuse FFZ Platform. In particular, you must not:</p>
          <ul>
            <li>attempt to gain unauthorized access to accounts, systems or data;</li>
            <li>interfere with the security, availability or normal operation of the service;</li>
            <li>use automated means to abuse, overload, scrape or probe the service without permission;</li>
            <li>reverse engineer the service except where such restriction is prohibited by law;</li>
            <li>use FFZ Platform for unlawful, fraudulent or infringing activity; or</li>
            <li>resell, sublicense or commercially redistribute access unless we have agreed to it in writing.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>8. Availability and changes</h2>
          <p>
            We aim to keep FFZ Platform available and reliable, but uninterrupted or error-free operation is not
            guaranteed. We may maintain, update, change or discontinue features when reasonably necessary for security,
            legal, technical or product reasons.
          </p>
          <p>
            We may change plan features or pricing prospectively. Changes to recurring pricing will apply only in
            accordance with applicable law and any notice required by the billing provider.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Suspension and termination</h2>
          <p>
            You may stop using FFZ Platform at any time. We may suspend or terminate access where necessary to address
            serious or repeated violations of these Terms, fraud, abuse, security risk, legal requirements or unpaid
            amounts. Where reasonable, we will try to provide notice before termination.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Intellectual property</h2>
          <p>
            FFZ Platform, its software, design, branding and original service content are owned by or licensed to FFZ and
            are protected by applicable intellectual-property laws. These Terms give you a limited, non-exclusive,
            non-transferable right to use the service for its intended purpose; they do not transfer ownership of FFZ
            intellectual property to you.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Disclaimers and limitation of liability</h2>
          <p>
            FFZ Platform is provided on an "as available" basis to the extent permitted by law. We do not warrant that
            analytics, calculations, imported data, prop-firm rules or other information will always be complete,
            current or error-free. You should independently verify information that may affect a trading or financial
            decision.
          </p>
          <p>
            To the maximum extent permitted by applicable law, FFZ will not be liable for indirect, incidental, special,
            consequential or trading losses arising from use of, inability to use or reliance on the service. Nothing in
            these Terms excludes liability that cannot legally be excluded or limited.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Privacy</h2>
          <p>
            Our handling of personal data is described in the <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>13. Governing law</h2>
          <p>
            These Terms are governed by the laws of the Republic of Serbia, without prejudice to any mandatory consumer
            protections that apply in your country of residence. Any dispute that cannot be resolved informally will be
            handled by the competent courts in Serbia unless applicable law requires otherwise.
          </p>
        </section>

        <section className={styles.section}>
          <h2>14. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be posted on this page with an updated
            effective date and, where appropriate, communicated through the service or by email.
          </p>
        </section>

        <section className={styles.section}>
          <h2>15. Contact</h2>
          <p>
            Operator: Dejan Djordjevic<br />
            Email: <a href="mailto:support@ffz.app">support@ffz.app</a><br />
            Website: <a href="https://ffz.app">ffz.app</a>
          </p>
        </section>
      </article>

      <footer className={styles.footer}>
        <div>
          <strong>FUTURES FROM ZERO</strong>
          <p>FFZ Platform · Software for managing your own trading process.</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refunds</Link>
        </div>
      </footer>
    </main>
  );
}
