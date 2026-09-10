import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../legal/LegalPage.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | FFZ Platform",
  description: "How FFZ Platform collects, uses and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/pricing" aria-label="FFZ Platform">
          <Image src="/ffz-logo.png" alt="FFZ" width={54} height={54} priority />
          <strong>FUTURES FROM ZERO</strong>
        </Link>
        <div className={styles.navActions}>
          <Link href="/pricing">PRICING</Link>
          <Link href="/terms">TERMS</Link>
          <Link href="/refund">REFUNDS</Link>
          <Link href="/login">LOG IN</Link>
        </div>
      </nav>

      <header className={styles.header}>
        <span className={styles.eyebrow}>LEGAL</span>
        <h1>Privacy Policy</h1>
        <p>Effective date: September 11, 2026</p>
      </header>

      <article className={styles.content}>
        <section className={styles.section}>
          <h2>1. Who we are</h2>
          <p>
            FFZ Platform is operated by Dejan Djordjevic ("FFZ", "we", "us" or "our"). This Privacy Policy explains
            how we collect, use, store and share personal information when you use ffz.app and FFZ Platform.
          </p>
          <p>
            For privacy questions or requests, contact <a href="mailto:support@ffz.app">support@ffz.app</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Information we collect</h2>
          <h3>Account information</h3>
          <p>
            When you create an account, we collect information such as your email address, optional display name,
            account identifiers, plan/access status and authentication-related records. Passwords are stored as secure
            hashes; we do not store your plain-text password.
          </p>

          <h3>Trading and workflow data</h3>
          <p>
            FFZ stores the information you choose to enter or import in order to use the product, which may include
            trading-account labels, prop-firm and challenge details, trade records, prices, position size, profit and
            loss, risk values, setups, tags, journal notes, planned trades, reviews, guardrails, ledger entries, payouts,
            costs and related workflow settings.
          </p>

          <h3>Files and attachments</h3>
          <p>
            If you upload screenshots or other trade-related attachments, we store the file and associated metadata such
            as filename, file type and file size so that the attachment can be displayed in your account.
          </p>

          <h3>Billing information</h3>
          <p>
            For paid plans, our billing provider may provide us with transaction, subscription, customer, product and
            plan identifiers, payment status, renewal/cancellation status and related billing metadata. We do not receive
            or store your full payment-card number.
          </p>

          <h3>Technical and security information</h3>
          <p>
            We may process limited technical information necessary to operate and secure the service, such as session
            identifiers, request metadata, timestamps, error information and security-related logs.
          </p>

          <h3>Support communications</h3>
          <p>
            If you contact us, we may keep the messages and contact details you provide in order to respond and maintain
            a record of the support interaction.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. How we use information</h2>
          <p>We use personal information to:</p>
          <ul>
            <li>create, authenticate and maintain your account;</li>
            <li>provide journaling, analytics, challenge tracking, risk calculation and other FFZ features;</li>
            <li>store and display the data and files you choose to add;</li>
            <li>process paid-plan status, renewals, cancellations and refunds;</li>
            <li>send transactional messages such as password-reset and account-related emails;</li>
            <li>protect the service against abuse, fraud and unauthorized access;</li>
            <li>diagnose technical problems and improve reliability and usability;</li>
            <li>respond to support requests; and</li>
            <li>comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>4. Legal bases where applicable</h2>
          <p>
            Where data-protection law requires a legal basis, we generally process information because it is necessary
            to provide the service you requested and perform our contract with you, because we have a legitimate interest
            in operating and securing FFZ Platform, because we must comply with a legal obligation, or because you have
            given consent where consent is required.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Cookies and sessions</h2>
          <p>
            FFZ uses an essential authentication cookie to keep you signed in and protect access to your account. The
            authentication session may remain valid for up to 30 days unless you sign out or the session is revoked.
            This cookie is necessary for the service to function and is not used for advertising.
          </p>
          <p>
            If we later introduce non-essential analytics, marketing or advertising cookies, this policy and any required
            consent controls will be updated before those cookies are used where consent is required.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Service providers and sharing</h2>
          <p>
            We do not sell your personal information. We share information only as reasonably necessary to operate the
            service, process payments, provide email and infrastructure services, comply with law or protect FFZ and its
            users.
          </p>
          <p>Categories of providers may include:</p>
          <ul>
            <li>hosting, database, networking and infrastructure providers;</li>
            <li>Lemon Squeezy or another authorized billing provider for purchases and subscription management;</li>
            <li>transactional email and email-routing providers; and</li>
            <li>professional advisers or authorities where disclosure is legally required.</li>
          </ul>
          <p>
            These providers may process information in countries other than your own. Where required, we use appropriate
            safeguards for international transfers.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Public Journey and public-facing data</h2>
          <p>
            FFZ includes a public Journey feature designed to show selected aggregate journey information. Private raw
            account data is not intended to be published through that feature. Public output is limited to sanitized
            aggregate information selected for the public journey, while account numbers, credentials, private notes,
            raw trade details and other private fields remain private.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Data retention</h2>
          <p>
            We retain account and user-provided data for as long as your account remains active or as reasonably needed
            to provide the service. Some records may be retained longer where required for security, fraud prevention,
            billing, tax, dispute resolution or other legal obligations.
          </p>
          <p>
            When data is no longer needed, we take reasonable steps to delete or anonymize it, subject to backup cycles
            and legally required retention periods.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Security</h2>
          <p>
            We use reasonable technical and organizational measures intended to protect personal information, including
            hashed passwords, protected authentication sessions and access controls. No online service can guarantee
            absolute security, so you should also protect your credentials and use a strong unique password.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Your privacy rights</h2>
          <p>
            Depending on where you live, you may have rights to request access to, correction of, deletion of,
            restriction of, objection to or portability of your personal information, as well as the right to withdraw
            consent where processing is based on consent.
          </p>
          <p>
            To exercise a privacy right, email <a href="mailto:support@ffz.app">support@ffz.app</a>. We may need to
            verify your identity before completing a request. You may also have the right to complain to the relevant
            data-protection authority.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Children</h2>
          <p>
            FFZ Platform is intended for adults. We do not knowingly offer the service to or collect personal information
            from children under 18.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy as the service or legal requirements change. The current version will be
            posted on this page with its effective date. Material changes may also be communicated through the service or
            by email where appropriate.
          </p>
        </section>

        <section className={styles.section}>
          <h2>13. Contact</h2>
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
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refunds</Link>
        </div>
      </footer>
    </main>
  );
}
