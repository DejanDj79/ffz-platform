# Dodo Payments Integration — Handoff

_Last updated: 2026-09-29_

This document tracks the current Dodo Payments integration status for FFZ Platform so work can continue safely from a new conversation.

## Current status

- Dodo Payments merchant verification: **APPROVED**
- Dodo dashboard indicates FFZ can receive payments.
- Paid products exist in **Live Mode** and **Test Mode**.
- FFZ production billing is now switched to **Dodo Live Mode**.
- Dodo checkout, portal, subscription webhook and Founder webhook code is merged in `main`.
- Dodo Test Mode and Live Mode webhook endpoints/signing secrets are configured and real webhook processing is confirmed.
- Monthly and Annual PRO checkout/activation are confirmed in Test Mode.
- Dodo Customer Portal opens correctly for a subscribed user, and scheduled cancellation keeps PRO access through the paid period.
- Live Mode checkout has been confirmed with a real card using a 100% discount code.
- Live Customer Portal and Live subscription cancellation have been confirmed.
- Existing Monthly PRO → Founder purchase is confirmed in Test Mode.
- Full Founder refund is confirmed: Founder entitlement is revoked and the account correctly falls back to the still-linked PRO subscription.
- Do not commit API keys, webhook secrets, or other credentials.

## FFZ commercial products

- **FFZ PRO Monthly** — $12.99/month
- **FFZ PRO Annual** — $99/year
- **FFZ Founder Trader** — $199 one-time, lifetime PRO, limited to the first 150 traders
- FREE remains an FFZ application plan and does not need a Dodo product.

## Integration design

Keep the existing provider-neutral FFZ billing database model and add Dodo as the active billing provider.

Target flow:

1. FFZ creates a Dodo hosted checkout session.
2. Checkout carries the authenticated FFZ user identity in provider metadata/custom data.
3. Dodo webhooks are the source of truth for paid entitlement state.
4. Monthly and Annual subscriptions activate/maintain PRO while valid.
5. Cancellation keeps access through the paid period, then returns the user to FREE unless Founder entitlement exists.
6. Dodo Customer Portal is used for subscription management.
7. Founder checkout keeps the existing FFZ 150-slot reservation/cap logic.
8. Successful Founder purchase activates lifetime PRO.
9. Full Founder refund revokes Founder entitlement according to existing FFZ rules.
10. If an existing PRO subscriber buys Founder, the recurring subscription should be scheduled for cancellation after Founder activation.

## Environment variables

The integration should use provider-specific environment variables rather than hard-coded IDs:

```text
DODO_PAYMENTS_API_KEY
DODO_PAYMENTS_WEBHOOK_KEY
DODO_PAYMENTS_ENVIRONMENT
DODO_PRO_MONTHLY_PRODUCT_ID
DODO_PRO_ANNUAL_PRODUCT_ID
DODO_FOUNDER_PRODUCT_ID
```

`DODO_PAYMENTS_WEBHOOK_KEY` is the Dodo webhook signing secret (`whsec_...`) used by the current implementation.

Values must remain outside Git.

## Existing FFZ billing foundations to reuse

- `src/db/user-plans-schema.ts` already stores provider-neutral billing IDs/status.
- `src/db/founder-slots-schema.ts` already stores provider-neutral Founder order/customer/product data.
- `src/lib/billing/repository.ts` is the central billing-state persistence layer.
- `src/lib/billing/founder-repository.ts` contains the Founder reservation/cap/entitlement logic.
- `src/lib/billing/dodo.ts` contains Dodo configuration, checkout, portal, cancellation, webhook parsing/signature verification and Founder payment/refund helpers.
- `src/app/api/billing/checkout/route.ts` is the authenticated Dodo PRO checkout entry point.
- `src/app/api/billing/founder-checkout/route.ts` is the authenticated Dodo Founder checkout entry point.
- `src/app/api/billing/webhook/route.ts` is the Dodo webhook endpoint.
- `src/app/api/billing/portal/route.ts` creates Dodo Customer Portal sessions.
- `src/app/upgrade/page.tsx` and `src/app/upgrade/BillingActions.tsx` use Dodo as the active billing provider.

Legacy Lemon Squeezy, Paddle, and FastSpring code may remain temporarily for reference/rollback, but Dodo is now the active production billing provider.

## Test-mode checklist

- [x] Dodo merchant verification approved
- [x] Monthly / Annual / Founder products created in Live Mode
- [x] Monthly / Annual / Founder products created in Test Mode
- [x] Test-mode FFZ environment configuration added
- [x] Dodo checkout integration implemented
- [x] Dodo webhook endpoint implemented
- [x] Test webhook endpoint created in Dodo dashboard
- [x] Test webhook secret configured
- [x] Webhook signature verification confirmed with real signed Dodo Test Mode deliveries
- [x] Monthly PRO test purchase activates PRO
- [x] Annual PRO test purchase activates PRO
- [x] Dodo Customer Portal opens for a subscribed user
- [x] Subscription cancellation preserves access until paid-period end
- [x] Expired/cancelled subscription eventually returns to FREE
- [x] Existing PRO → Founder purchase works
- [x] Founder purchase consumes exactly one FFZ Founder slot
- [x] Full Founder refund revokes Founder entitlement and restores existing PRO access when applicable
- [x] Partial refund behavior verified
- [x] Founder sold-out behavior verified
- [x] Automated tests and FFZ CI pass

## Confirmed Test Mode lifecycle

The following end-to-end path has been exercised successfully against Dodo Test Mode:

1. Purchase Monthly PRO.
2. Dodo webhook activates PRO in FFZ.
3. Purchase Founder while PRO is active.
4. Founder entitlement activates successfully.
5. Submit a full Founder refund in Dodo.
6. Dodo sends the successful refund webhook.
7. FFZ revokes Founder entitlement.
8. Because the account still has a linked Dodo PRO subscription, FFZ restores the account to PRO instead of FREE.
9. The Founder refund state/message is visible in FFZ.

An initial `insufficient funds in wallet` refund response cleared after waiting for Dodo Test Mode settlement/balance availability; no FFZ code change was required.

## Test Mode validation status

The Test Mode billing checklist is complete, including subscription lifecycle, Founder lifecycle/refunds, sold-out behavior, and CI coverage.

Do not put API keys or webhook signing secrets in this document or commit them anywhere in Git.

## Live-mode cutover

**COMPLETE — FFZ production billing is live on Dodo Payments.**

Production is configured with Live Mode values for:

- Dodo API key
- Dodo webhook signing key
- Monthly Product ID
- Annual Product ID
- Founder Product ID
- `DODO_PAYMENTS_ENVIRONMENT=live_mode`

Live smoke tests completed:

- Live checkout opens successfully from FFZ.
- 100% discount-code checkout completed successfully with a real card.
- Live billing webhook/customer linkage is functional.
- Dodo Customer Portal opens for the live subscriber.
- Subscription cancellation from the Customer Portal completes successfully.

A previous Live checkout `422` was traced to incorrect Live product IDs, not to the discount-code feature. Correcting the Live product IDs resolved checkout creation.

## Current next step

Billing is production-ready. The next billing-related work should be operational monitoring of early live transactions and, later, cleanup/removal of unused legacy provider code when rollback reference is no longer needed.
