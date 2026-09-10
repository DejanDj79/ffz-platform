import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../legal/LegalPage.module.css";

export const metadata: Metadata = {
  title: "Refund Policy | FFZ Platform",
  description: "Refund rules for FFZ Platform Pro subscriptions and Founder purchases.",
};

export default function RefundPage() {
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
          <Link href="/privacy">PRIVACY</Link>
          <Link href="/login">LOG IN</Link>
        </div>
      </nav>

      <header className={styles.header}>
        <span className={styles.eyebrow}>LEGAL</span>
        <h1>Refund Policy</h1>
        <p>Effective date: September 11, 2026</p>
      </header>

      <article className={styles.content}>
        <section className={styles.section}>
          <h2>1. Overview</h2>
          <p>
            This Refund Policy applies to purchases of FFZ Platform paid access. We want customers to have a fair
            opportunity to evaluate the product while keeping recurring billing rules clear and predictable.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. First Pro purchase</h2>
          <p>
            Your first purchase of an FFZ Pro subscription is eligible for a refund if you request it within 14 days of
            the initial purchase date.
          </p>
          <p>
            This 14-day period applies to the first paid Pro purchase on the account, whether you selected monthly or
            yearly billing.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Founder purchase</h2>
          <p>
            A first Founder purchase is eligible for a refund if you request it within 14 days of the original purchase
            date. Founder is a one-time purchase rather than a recurring subscription.
          </p>
          <p>
            If a Founder purchase is refunded, the Founder access associated with that purchase will be removed. A
            refunded Founder place is not guaranteed to become available for purchase again.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Subscription renewals</h2>
          <p>
            Monthly and yearly Pro subscriptions renew automatically unless cancelled before the renewal date. Renewal
            charges are generally non-refundable.
          </p>
          <p>
            You are responsible for cancelling before the next billing date if you do not want the subscription to renew.
            Cancelling a subscription normally keeps your paid access active until the end of the current billing period.
          </p>
          <p>
            Nothing in this policy limits refund or cancellation rights that cannot be excluded under applicable consumer
            law.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. How to request a refund</h2>
          <p>
            Send your request to <a href="mailto:support@ffz.app">support@ffz.app</a> from the email address associated
            with your FFZ account. Please include enough information for us to identify the purchase, but do not send
            card numbers or other sensitive payment credentials.
          </p>
          <p>
            Approved refunds are processed through the payment provider and returned to the original payment method where
            supported. The time it takes for funds to appear can depend on the payment method and financial institution.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Fraud, abuse and chargebacks</h2>
          <p>
            We may refuse a refund request where there is evidence of fraud, payment abuse, repeated refund abuse or a
            material violation of the FFZ Terms of Service, except where applicable law requires otherwise.
          </p>
          <p>
            If you believe a charge is incorrect, please contact us first so we can investigate it before initiating a
            chargeback with your bank or card provider.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Plan downgrades and cancellation</h2>
          <p>
            Cancelling or downgrading does not delete your historical FFZ Journal, challenge or custom data. Features that
            require paid access may become unavailable or read-only after the paid access period ends, while retained data
            remains subject to our Terms of Service and Privacy Policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Contact</h2>
          <p>
            Operator: Dejan Djordjevic<br />
            Refund requests: <a href="mailto:support@ffz.app">support@ffz.app</a><br />
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
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
