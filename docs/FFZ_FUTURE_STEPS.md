# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-04_

Ovaj fajl služi kao handoff za nastavak rada na FFZ Platform projektu u novom razgovoru.

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

Important Lemon webhook lesson from testing:
- `order_created` was initially not selected in Lemon webhook settings.
- Checkout completed but FFZ remained FREE until `order_created` was enabled and delivered.

Required order events:
- `order_created`
- `order_refunded`

Keep existing subscription lifecycle events enabled too.

## Local Founder database note

Local DB is `ffz_platform`.

During E2E testing, `founder_slots` was manually created from:

```text
drizzle/0005_founder_slots.sql
```

The local DB already has this table. Do not blindly run that SQL again.

There may be one local test slot in `REFUNDED` state because of the Founder E2E test.

## Production Founder deploy — NEXT REQUIRED INFRA STEP

The Founder backend is merged. Production still needs the schema migration deployed.

Because this contains a DB migration, always back up first:

```bash
cd ~/apps/FFZ
git switch main
git pull --ff-only origin main
./scripts/backup-production.sh
./scripts/deploy-production.sh
```

Production migration:

```text
drizzle-production/0004_founder_slots.sql
```

Deploy verification should confirm:
- `founder_slots` exists
- exactly 150 rows exist

**Never run `db:push` in production.**

## Founder Live Mode — REQUIRED BEFORE PUBLIC BILLING LAUNCH

When real billing is ready, create a Lemon **Live Mode** Founder variant:
- Name: `Founder Trader`
- `$199`
- one-time / single payment
- no trial

Set on the production server:

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

## Founder pre-launch UX polish — TODO, NOT A BLOCKER

Checkout already redirects to something like:

```text
/upgrade?checkout=founder-success
```

But the Upgrade UI does not yet have a dedicated “waiting for webhook” experience.

Recommended before public launch:
- show: `Payment received. Activating your Founder access...`
- auto-refresh/poll briefly after returning from Lemon
- when webhook finishes, show `FOUNDER`, `FOUNDER ACTIVE`, and slot number
- show a fallback message if activation is delayed

This is not required for functional correctness and can be done during final pre-launch polish.

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

## Billing live-launch checklist

- [ ] Founder backend deployed to production
- [ ] production DB migration passed
- [ ] `founder_slots` has exactly 150 rows
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

## Next major roadmap item

### Public FFZ Journey

Not built yet.

Goal:
- public page connected to the real trading journey
- challenge/funded progress
- P&L
- real-money costs
- payouts
- milestones
- YouTube link / episode connection

Before implementation define:
- which account/challenge can be public
- which data is public vs hidden
- privacy rules
- whether some data should be delayed

This is separate from authenticated PRO `/prop-journey`.

## Creator Episode Builder

Already completed in PR #19.

Merged commit:

```text
e8ae68e990f1a69fcadead5f8c5429a55cd198d4
```

Creator-only:
- `/creator/episodes`
- Episode Builder
- Scoreboard

Do not make these commercial PRO features.

## Current monetization

- FREE: `$0`
- PRO Monthly: `$12.99/month`
- PRO Yearly: `$99/year`
- Founder: `$199 one-time`, lifetime PRO, first 150
- Creator: internal/owner role, effective PRO, no Founder seat

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

## GitHub workflow rules

Use:
1. feature/fix branch
2. draft PR
3. CI
4. local test
5. user confirms behavior/visuals
6. merge

Once the user explicitly confirms the behavior/visuals and CI is green, merge immediately without asking again.

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

Disk incident was previously resolved.

Never run:

```bash
docker system prune -a --volumes
```

Do not remove named volumes such as:
- `ffz-production_ffz_postgres_data`
- `ffz-production_ffz_uploads`
- AgarViz named volumes

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

## Recommended next order of work

If work continues now:

1. Deploy Founder backend to production with backup + migration.
2. Live Founder variant does not need to be created yet if public billing launch is not imminent.
3. Continue with **Public FFZ Journey**.
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

## How to continue in a new ChatGPT conversation

Tell ChatGPT:

> Nastavljamo FFZ Platform projekat. Otvori `docs/FFZ_FUTURE_STEPS.md` iz GitHub repoa i nastavi od sekcije “Recommended next order of work”.

For Founder-specific continuation:

> Nastavljamo Founder billing. Core backend je završen i testiran. Otvori `docs/FFZ_FUTURE_STEPS.md` i kreni od production deploy / live-launch checklist dela.
