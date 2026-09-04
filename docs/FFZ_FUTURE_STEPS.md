# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-04_

Ovaj dokument je živi handoff/checklist za FFZ Platform. Kada završimo stavku, ažurirati je ovde i označiti kao završenu.

## Current project context

- Repo: `DejanDj79/ffz-platform`
- Local: `~/WaytrXGroundOps/external/ffz-platform`
- Production: `~/apps/FFZ`
- Brand: **FFZ Platform / Futures From Zero**
- Positioning: **FFZ is a prop futures trader operating system.**
- Stack: Next.js 16.3.3, React 19.2, TypeScript 5.9, Tailwind 4.3, Drizzle/PostgreSQL, Zod, Vitest

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
- same commercial entitlement as PRO
- Creator-only tools excluded
- refund does **not** reopen a Founder seat
- “Lifetime” means lifetime of the FFZ product/service

Hard-cap implementation:
- `founder_slots` table with exactly 150 pre-created slots
- states: `AVAILABLE`, `RESERVED`, `PURCHASED`, `REFUNDED`
- PostgreSQL advisory transaction lock prevents oversell
- checkout reservation: 35 min
- Lemon checkout: 30 min + 5 min webhook grace
- expired reservation can be reused
- refunded seat never returns to `AVAILABLE`

Entitlement:
- successful Founder order => effective PRO
- later subscription lifecycle events cannot downgrade active Founder
- existing Monthly/Annual subscription is cancelled for future renewal after Founder purchase
- Creator cannot consume Founder seats

Refund:
- full refund => Founder entitlement removed, slot => `REFUNDED`
- partial refund => Founder remains active

### Founder E2E test — PASSED

Test Mode Founder Variant ID:

```text
2088460
```

**Do not use this Test Mode ID in production.**

Confirmed locally:
- `/upgrade` showed 150 spots
- regular USER completed `$199` one-time checkout
- `order_created` activated Founder
- `FREE -> FOUNDER`
- remaining spots `150 -> 149`
- full refund tested through Lemon API
- `order_refunded` changed `FOUNDER -> FREE`
- refunded slot stayed consumed, so remaining spots stayed `149`

Important webhook lesson:
- `order_created` must be explicitly selected in Lemon webhook configuration
- `order_refunded` must also be selected
- keep subscription lifecycle webhook events enabled

### Production Founder deploy — DONE

Completed 2026-09-04:
- [x] backup before migration
- [x] latest `main` deployed to `~/apps/FFZ`
- [x] `drizzle-production/0004_founder_slots.sql` applied
- [x] production verification confirmed exactly **150 Founder slots**

**Never use `db:push` in production.**

---

## Founder Live Mode — TODO BEFORE PUBLIC BILLING LAUNCH

Intentionally deferred until public billing launch.

Create Lemon Live Mode Founder variant:
- Name: `Founder Trader`
- `$199`
- one-time / single payment
- no trial

Set in production:

```env
LEMONSQUEEZY_FOUNDER_VARIANT_ID=<LIVE_VARIANT_ID>
LEMONSQUEEZY_TEST_MODE=false
```

Live webhook must point to:

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

### Founder pre-launch UX polish — TODO, NOT A BLOCKER

Checkout already redirects to something like:

```text
/upgrade?checkout=founder-success
```

Before public launch, recommended:
- show `Payment received. Activating your Founder access...`
- poll/refresh briefly while waiting for webhook
- after activation show `FOUNDER`, `FOUNDER ACTIVE`, slot number
- fallback message if activation is delayed

### Additional manual tests recommended before live

Existing PRO -> Founder:
- Monthly/Annual USER buys Founder
- Founder becomes effective plan
- Lemon subscription becomes `cancelled: true`
- already-paid period remains valid
- no future double billing

Partial refund:
- Founder remains active
- slot remains `PURCHASED`

### Billing live-launch checklist

Infrastructure complete:
- [x] Founder backend deployed
- [x] production migration passed
- [x] `founder_slots` = exactly 150 rows

Deferred until live launch:
- [ ] Live Founder variant created
- [ ] Live Founder Variant ID added to server
- [ ] `LEMONSQUEEZY_TEST_MODE=false`
- [ ] Live webhook URL verified
- [ ] `order_created` selected
- [ ] `order_refunded` selected
- [ ] subscription events selected
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

## Public FFZ Journey MVP — DONE

PR #23: **Add public FFZ Journey**

Merged commit:

```text
5ec6565db2b8e375647277e8cafca6398c0fec3f
```

Public route:

```text
/journey
```

Purpose:
- public-facing FFZ trading journey for YouTube viewers and followers
- separate from authenticated PRO `/prop-journey`
- powered by real Creator challenge + Real Money Ledger data

MVP shows:
- current mission / prop account phase
- prop firm
- account size
- aggregate challenge P&L / progress toward target
- real prop costs
- payouts
- net journey result
- evaluation -> funded -> payout funnel
- recent 6-month cash flow
- milestones
- aggregate prop-firm economics

Privacy rules implemented:
- no account numbers
- no challenge/account IDs
- no private account labels
- no journal/ledger notes
- no order references
- no raw trade details
- no Creator personal display name
- public UI receives a sanitized aggregate model only

Data behavior:
- reuses existing Prop Journey analytics so private/public financial math stays consistent
- primary Creator is used as FFZ owner journey source
- public read does not journal-sync or mutate challenge data
- USD is preferred when multiple currencies exist

Tests cover:
- aggregate output
- private IDs/notes/references never serialized into public model
- current mission selection
- currency selection

Local visual/function test: **PASSED**.

### Public Journey production deploy — DONE

Completed 2026-09-04:
- [x] latest `main` deployed to production
- [x] `/journey` smoke-tested logged out
- [x] no authentication redirect
- [x] public layout verified after split-panel width fix
- [x] no private identifiers or notes exposed

No DB migration was required.

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

Do not turn these into commercial PRO features.

---

# ACTIVE NEXT ROADMAP ITEM — Real-usage improvements / Psychology Analytics

Status: **IN PROGRESS**

The platform now has the core operating system, monetization foundation, private Prop Journey and public journey. The next development should be driven by actual trading usage rather than adding broad surface area.

Recommended first direction:
- psychology / discipline analytics from Journal data
- identify repeated rule violations and emotional patterns
- performance before/after loss streaks
- revenge-trading / overtrading signals
- quality of planned vs unplanned trades
- adherence to daily risk limits
- actionable weekly review insights rather than generic stats

First data-foundation step:
- preserve durable `FFZ:planned` provenance when a Planned Trade is started, so planned-vs-other performance can accumulate from real usage

Also useful after real data starts accumulating:
- deeper Journal insights
- Public Journey enhancements
- Creator Episode Builder improvements based on actual YouTube workflow
- YouTube explainer/content integration

Do not overbuild this before real trading data exists.

---

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

1. Start real trading usage and let real data accumulate.
2. Preserve and extend reliable discipline metadata as actual usage exposes what is useful.
3. Build psychology/discipline analytics from actual Journal behavior.
4. Iterate Public Journey and Creator Episode workflow based on real use.
5. Before public billing launch return to Founder success UX + Live Lemon configuration + billing smoke tests.

---

## How to continue in a new ChatGPT conversation

Tell ChatGPT:

> Nastavljamo FFZ Platform projekat. Otvori `docs/FFZ_FUTURE_STEPS.md` iz GitHub repoa, proveri ACTIVE NEXT ROADMAP ITEM i nastavi odatle.

For Founder-specific continuation:

> Nastavljamo Founder billing. Otvori `docs/FFZ_FUTURE_STEPS.md` i pogledaj Founder Live Mode / Billing live-launch checklist.
