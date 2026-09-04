# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-04_

Ovaj dokument je živi handoff/checklist za FFZ Platform. Kada završimo stavku, ažurirati je ovde i označiti kao završenu.

## Current project context

- Repo: `DejanDj79/ffz-platform`
- Local: `~/WaytrXGroundOps/external/ffz-platform`
- Production: `~/apps/FFZ`
- Brand: **FFZ Platform / Futures From Zero**
- Positioning: **FFZ is a prop futures trader operating system.**

Stack:
- Next.js 16.3.3
- React 19.2
- TypeScript 5.9
- Tailwind 4.3
- Drizzle + PostgreSQL
- Zod
- Vitest

---

## Founder billing — DONE

PR #20: **Add Founder lifetime billing**

Merged commit:

```text
d0323177410ca656fd969c98a8ff7a04506738e7
```

Founder model:
- `$199` one-time
- lifetime PRO
- hard cap: **150 traders**
- same commercial feature entitlement as PRO
- Creator-only tools excluded
- refund does **not** reopen Founder seat
- “Lifetime” means lifetime of the FFZ product/service

Hard-cap implementation:
- `founder_slots` table
- exactly 150 pre-created slots
- states: `AVAILABLE`, `RESERVED`, `PURCHASED`, `REFUNDED`
- PostgreSQL advisory transaction lock prevents oversell
- checkout reservation: 35 minutes
- Lemon checkout: 30 minutes + 5 minute webhook grace
- expired reservations can be reused
- refunded slots never return to `AVAILABLE`

Entitlement behavior:
- successful Founder order => effective PRO
- Founder entitlement cannot be downgraded by later subscription lifecycle events
- existing Monthly/Annual PRO subscription is marked cancelled after Founder purchase so it ends at the end of the already-paid period
- CREATOR users cannot consume Founder seats

Refund behavior:
- full refund => Founder entitlement removed
- slot => `REFUNDED`
- remaining Founder count does **not** increase
- partial refund => Founder remains active

---

## Founder end-to-end test — PASSED

Test Mode Founder Variant ID:

```text
2088460
```

**Important:** this is a TEST MODE ID. Do not use it in production.

Confirmed locally:
1. `/upgrade` shows 150 Founder spots.
2. Regular USER can start Founder checkout.
3. Lemon checkout is `$199` one-time Founder.
4. `order_created` webhook activates Founder.
5. Upgrade plan changes `FREE -> FOUNDER`.
6. Remaining spots change `150 -> 149`.
7. Full refund was tested via Lemon API.
8. `order_refunded` webhook changes `FOUNDER -> FREE`.
9. Slot #1 becomes `REFUNDED`.
10. Remaining spots stay at `149`.

Important Lemon webhook lesson:
- `order_created` was initially not selected in Lemon webhook settings.
- Checkout completed but FFZ remained FREE until `order_created` was enabled and delivered.

Required order events:
- `order_created`
- `order_refunded`

Keep existing subscription lifecycle events enabled too.

---

## Local Founder database note

Local DB is `ffz_platform`.

During E2E testing, `founder_slots` was manually created from:

```text
drizzle/0005_founder_slots.sql
```

The local DB already has this table. Do not blindly run that SQL again.

There may be one local test slot in `REFUNDED` state because of the Founder E2E test.

---

## Production Founder deploy — DONE

Production deploy completed successfully on 2026-09-04.

Completed:
- [x] backup taken before schema migration
- [x] latest `main` deployed to `~/apps/FFZ`
- [x] `drizzle-production/0004_founder_slots.sql` applied
- [x] `founder_slots` exists in production
- [x] production verification confirmed exactly **150 Founder slots**

**Never run `db:push` in production.**

For future schema deployments:

```bash
cd ~/apps/FFZ
git switch main
git pull --ff-only origin main
./scripts/backup-production.sh
./scripts/deploy-production.sh
```

---

## Founder Live Mode — REQUIRED BEFORE PUBLIC BILLING LAUNCH

This is intentionally deferred until public billing launch.

When real billing is ready, create a Lemon **Live Mode** Founder variant:
- Name: `Founder Trader`
- `$199`
- one-time / single payment
- no trial

Set on production server:

```env
LEMONSQUEEZY_FOUNDER_VARIANT_ID=<LIVE_VARIANT_ID>
LEMONSQUEEZY_TEST_MODE=false
```

Do not use Test Variant ID `2088460` in production.

Live webhook URL must point to:

```text
https://<ffz-domain>/api/billing/webhook
```

Required events:
- `order_created`
- `order_refunded`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_expired`

---

## Founder pre-launch UX polish — TODO, NOT A BLOCKER

Checkout already redirects to something like:

```text
/upgrade?checkout=founder-success
```

Before public billing launch, recommended:
- show `Payment received. Activating your Founder access...`
- auto-refresh/poll briefly after returning from Lemon
- when webhook finishes, show `FOUNDER`, `FOUNDER ACTIVE`, and slot number
- show a fallback message if activation is delayed

This is not required for functional correctness and can stay for final launch polish.

---

## Additional Founder manual tests — RECOMMENDED BEFORE LIVE

### Existing PRO -> Founder

Test with a real Lemon Test Mode subscription:
1. USER has Monthly or Annual PRO.
2. USER buys Founder.
3. Effective plan becomes Founder/PRO.
4. Existing Lemon subscription becomes `cancelled: true`.
5. Already-paid access remains until the period end.
6. There is no future double billing.

### Partial refund

1. Founder is `PURCHASED`.
2. Issue a partial refund.
3. `order_refunded` arrives.
4. Founder entitlement stays active.
5. Slot stays `PURCHASED`.

---

## Billing live-launch checklist

Infrastructure already complete:
- [x] Founder backend deployed to production
- [x] production DB migration passed
- [x] `founder_slots` has exactly 150 rows

Deferred until public billing launch:
- [ ] Live Founder variant created
- [ ] Live Founder Variant ID added to server
- [ ] `LEMONSQUEEZY_TEST_MODE=false`
- [ ] Live webhook URL verified
- [ ] `order_created` selected
- [ ] `order_refunded` selected
- [ ] subscription webhook events selected
- [ ] Founder purchase smoke test
- [ ] Monthly PRO smoke test
- [ ] Annual PRO smoke test
- [ ] Existing PRO -> Founder test
- [ ] Full refund test
- [ ] Partial refund test
- [ ] Upgrade copy final review
- [ ] Founder success/activation UX polish
- [ ] SOLD OUT behavior verified

---

# ACTIVE NEXT ROADMAP ITEM — Public FFZ Journey

Status: **NEXT TO BUILD**

This is separate from authenticated PRO `/prop-journey`.

## Goal

Create a public-facing page connected to the real FFZ trading journey, suitable for viewers coming from YouTube and for documenting progress transparently.

Possible public data:
- current challenge/funded status
- prop firm
- account size
- starting balance / current balance
- P&L
- progress toward target
- challenge/reset/activation costs
- payouts
- real-money net result
- milestones
- related/latest YouTube episode
- basic journey statistics

## Decision required before implementation

Define what may be public and what remains private:
- which account/challenge can be public
- whether exact balances are public
- whether daily/trade-level P&L is public
- whether account numbers or provider IDs are always hidden
- whether real-time data is shown or delayed
- whether trade entries are public or only aggregate stats
- whether historical failed challenges remain visible

Recommended privacy default:
- never expose credentials, internal IDs, account numbers, emails, provider customer/order IDs, or private notes
- public page should use aggregated trading data rather than raw private records unless explicitly enabled

---

## Creator Episode Builder — DONE

PR #19 merged commit:

```text
e8ae68e990f1a69fcadead5f8c5429a55cd198d4
```

Creator-only:
- `/creator/episodes`
- Episode Builder
- Scoreboard

Do not make these commercial PRO features.

---

## Current monetization

- FREE: `$0`
- PRO Monthly: `$12.99/month`
- PRO Yearly: `$99/year`
- Founder: `$199 one-time`, lifetime PRO, first 150
- Creator: internal/owner role, effective PRO, no Founder seat

---

## Product gating summary

FREE:
- Risk Calculator
- one active challenge/funded account
- basic Journal
- basic Analytics
- Economic Calendar
- built-in prop rules

PRO:
- multiple active challenges
- CSV import
- automatic challenge sync
- setup analytics
- time-of-day analytics
- Trading Guardrails
- News Lockout
- custom prop rules
- Prop Journey

Creator-only:
- Episode Builder
- Scoreboard
- future internal creator tooling

---

## GitHub workflow rules

Use:
1. feature/fix branch
2. draft PR
3. CI
4. local test
5. user confirms behavior/visuals
6. merge

Once the user explicitly confirms behavior/visuals and CI is green, merge immediately without asking again.

After every merge provide:

```text
MERGED: <commit>

LOCAL:
cd ~/WaytrXGroundOps/external/ffz-platform
git switch main
git pull --ff-only origin main
git log -1 --oneline

SERVER:
cd ~/apps/FFZ
git switch main
git pull --ff-only origin main
./scripts/deploy-production.sh

DB:
migration required / no migration
```

If schema changes exist:

```bash
./scripts/backup-production.sh
./scripts/deploy-production.sh
```

Never use production `db:push`.

---

## Production notes

Hetzner:
- Ubuntu 22.04.5
- Docker 29
- Compose 5

FFZ:
- `~/apps/FFZ`
- origin: `git@github-ffz:DejanDj79/ffz-platform.git`
- branch: `main`
- network: `agarviz_default`
- proxy: `agarviz-nginx-1`
- upstream: `ffz-app:3000`
- separate PostgreSQL

Never run:

```bash
docker system prune -a --volumes
```

Do not remove named volumes such as:
- `ffz-production_ffz_postgres_data`
- `ffz-production_ffz_uploads`
- AgarViz named volumes

---

## User trading / YouTube context

Trading plan:
- MNQ / MES
- max 1 contract
- scalping mostly above 1-minute chart
- max about `$100` risk per trade
- max 2–3 losing trades/day
- RR usually 1:1 to 1:3
- DeepCharts
- prop challenge/funded journey

YouTube:
- document the journey from the beginning
- first video planned around 15–20 minutes
- script in English
- FFZ/FZ logo: futuristic, minimalist

---

## Recommended next order of work

1. **Public FFZ Journey — active next task.**
2. Define public/private data policy and MVP layout.
3. Implement Public FFZ Journey through normal branch -> draft PR -> CI -> local test workflow.
4. Before public billing launch, return to:
   - Founder success/activation UX
   - Live Lemon Founder variant
   - Live webhook setup
   - final billing smoke tests
   - final Upgrade/pricing copy polish
5. After real usage begins, consider:
   - psychology analytics
   - deeper Journal insights
   - creator episode workflow improvements
   - public journey enhancements

---

## How to continue in a new ChatGPT conversation

Tell ChatGPT:

> Nastavljamo FFZ Platform projekat. Otvori `docs/FFZ_FUTURE_STEPS.md` iz GitHub repoa, proveri ACTIVE NEXT ROADMAP ITEM i nastavi odatle.

For Founder-specific continuation:

> Nastavljamo Founder billing. Otvori `docs/FFZ_FUTURE_STEPS.md` i pogledaj Founder Live Mode / Billing live-launch checklist.
