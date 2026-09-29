# Dodo Payments Integration — Handoff

_Last updated: 2026-09-29_

This document tracks the current Dodo Payments integration status for FFZ Platform so work can continue safely from a new conversation.

## Current status

- Dodo Payments merchant verification: **APPROVED**
- Dodo dashboard indicates FFZ can receive payments.
- Paid products exist in **Live Mode** and **Test Mode**.
- Test-mode environment configuration has been added to FFZ.
- Integration code is the current active billing task.
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
DODO_PAYMENTS_WEBHOOK_SECRET
DODO_PAYMENTS_ENVIRONMENT
DODO_PRO_MONTHLY_PRODUCT_ID
DODO_PRO_ANNUAL_PRODUCT_ID
DODO_FOUNDER_PRODUCT_ID
```

Values must remain outside Git.

## Existing FFZ billing foundations to reuse

- `src/db/user-plans-schema.ts` already stores provider-neutral billing IDs/status.
- `src/db/founder-slots-schema.ts` already stores provider-neutral Founder order/customer/product data.
- `src/lib/billing/repository.ts` is the central billing-state persistence layer.
- `src/lib/billing/founder-repository.ts` contains the Founder reservation/cap/entitlement logic.
- `src/app/api/billing/checkout/route.ts` is the authenticated PRO checkout entry point.
- `src/app/api/billing/founder-checkout/route.ts` is the authenticated Founder checkout entry point.
- `src/app/api/billing/webhook/route.ts` currently contains legacy Paddle handling and must be migrated/replaced for Dodo.
- `src/app/api/billing/portal/route.ts` currently uses Paddle and must be switched to Dodo Customer Portal.
- `src/app/upgrade/page.tsx` and `src/app/upgrade/BillingActions.tsx` currently contain FastSpring/Paddle-specific assumptions that must be changed to Dodo.

Legacy Lemon Squeezy, Paddle, and FastSpring code may remain temporarily for reference/rollback until Dodo test-mode validation is complete, but new checkout behavior should target Dodo.

## Test-mode checklist

- [x] Dodo merchant verification approved
- [x] Monthly / Annual / Founder products created in Live Mode
- [x] Monthly / Annual / Founder products created in Test Mode
- [x] Test-mode FFZ environment configuration added
- [ ] Dodo checkout integration implemented
- [ ] Dodo webhook endpoint implemented
- [ ] Test webhook endpoint created in Dodo dashboard
- [ ] Test webhook secret configured
- [ ] Webhook signature verification confirmed
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

## Live-mode cutover

Do not switch production billing to Dodo Live Mode until the test-mode checklist passes.

At cutover, switch the following together:

- Dodo API key
- Dodo webhook secret
- Monthly Product ID
- Annual Product ID
- Founder Product ID
- Dodo environment mode

Then repeat critical smoke tests for purchase, entitlement activation, cancellation/portal, Founder purchase, and refund handling.

## Current next step

Implement the Dodo integration in code, starting with provider configuration and checkout session creation, then webhooks, portal management, Founder lifecycle, tests, and finally Test Mode end-to-end validation.
