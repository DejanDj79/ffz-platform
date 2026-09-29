# Dodo Payments Integration — Handoff

_Last updated: 2026-09-29_

This document tracks the current Dodo Payments integration status for FFZ Platform so work can continue safely from a new conversation.

## Current status

- Dodo Payments merchant verification: **APPROVED**
- Dodo dashboard indicates FFZ can receive payments.
- Paid products exist in **Live Mode** and **Test Mode**.
- Test-mode environment configuration has been added to FFZ.
- Dodo checkout, portal, subscription webhook and Founder webhook code is merged in `main`.
- The next step is Test Mode webhook configuration in the Dodo dashboard, followed by end-to-end validation.
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

Legacy Lemon Squeezy, Paddle, and FastSpring code may remain temporarily for reference/rollback until Dodo test-mode validation is complete, but new checkout behavior should target Dodo.

## Test-mode checklist

- [x] Dodo merchant verification approved
- [x] Monthly / Annual / Founder products created in Live Mode
- [x] Monthly / Annual / Founder products created in Test Mode
- [x] Test-mode FFZ environment configuration added
- [x] Dodo checkout integration implemented
- [x] Dodo webhook endpoint implemented
- [ ] Test webhook endpoint created in Dodo dashboard
- [ ] Test webhook secret configured
- [ ] Webhook signature verification confirmed with a real signed Dodo Test Mode delivery
- [ ] Monthly PRO test purchase activates PRO
- [ ] Annual PRO test purchase activates PRO
- [ ] Dodo Customer Portal opens for a subscribed user
- [ ] Subscription cancellation preserves access until paid-period end
- [ ] Expired/cancelled subscription eventually returns to FREE
- [ ] Existing PRO → Founder purchase works
- [ ] Founder purchase consumes exactly one FFZ Founder slot
- [ ] Full Founder refund revokes Founder entitlement
- [ ] Partial refund behavior verified
- [ ] Founder sold-out behavior verified
- [ ] Automated tests and FFZ CI pass

## Next manual Test Mode step

Create a webhook endpoint in the **Dodo Test Mode** dashboard.

Endpoint URL:

```text
https://ffz.app/api/billing/webhook
```

Subscribe to the billing events FFZ currently handles or uses for lifecycle synchronization:

- `subscription.active`
- `subscription.updated`
- `subscription.on_hold`
- `subscription.paused`
- `subscription.renewed`
- `subscription.plan_changed`
- `subscription.cancelled`
- `subscription.failed`
- `subscription.expired`
- `payment.succeeded`
- `refund.succeeded`

After creating the endpoint:

1. Copy the Dodo signing secret (`whsec_...`).
2. Configure it as `DODO_PAYMENTS_WEBHOOK_KEY` in the FFZ Test Mode deployment environment.
3. Restart/redeploy FFZ if the environment requires it.
4. Send a signed Test Mode webhook from Dodo.
5. Confirm the endpoint returns a successful response and then mark signature verification complete.

Do not put the signing secret in this document or commit it anywhere in Git.

## Live-mode cutover

Do not switch production billing to Dodo Live Mode until the test-mode checklist passes.

At cutover, switch the following together:

- Dodo API key
- Dodo webhook signing key
- Monthly Product ID
- Annual Product ID
- Founder Product ID
- Dodo environment mode

Then repeat critical smoke tests for purchase, entitlement activation, cancellation/portal, Founder purchase, and refund handling.

## Current next step

Create the Test Mode webhook endpoint in the Dodo dashboard at `https://ffz.app/api/billing/webhook`, copy its signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`, then verify one real signed Test Mode delivery before starting the purchase smoke tests.
