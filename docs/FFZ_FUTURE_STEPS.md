# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-05_

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

## Psychology / Discipline foundation — DONE

Completed through PR #28 and PR #29.

Merged commits:

```text
PR #28  2e7740354fcb4845869df13c7b4ce86ccc17e72d
PR #29  a4a2c2b5112943a956e5156c23af1964fb0c4c21
```

Implemented:
- deterministic execution metadata: On Plan / Deviated / Unplanned
- deterministic mindset metadata: Calm / Focused / FOMO / Revenge / Fear / Frustrated / Tired
- durable `FFZ:planned` provenance when a Planned Trade is started
- discipline analytics and reserved-tag handling
- reserved metadata is kept separate from user-facing tags
- psychology/discipline data is available for later behavior analysis

Important rule:
- never infer **Revenge** unless the trader explicitly selected Revenge
- objective behavior signals may indicate rapid re-entry, loss chasing or overtrading, but should not label those as revenge trading automatically

---

## Trade Review — DONE

PR #30 merged commit:

```text
9f38fa0eb9233f2f2001bd6f59b30ac8eebfcd8a
```

Route:

```text
/journal/review
```

Implemented:
- screenshot-first closed-trade review viewer
- instrument filtering and previous/next trade navigation
- screenshot attachment selection
- Details / Review / Attachments / Notes tabs
- execution, mindset and planned-origin review metadata
- TradeZella-inspired details layout without cloning TradeZella
- responsive review layout

The screenshot + review panel remain the primary above-the-fold experience.

---

## Trade Review Performance + FFZ Score — DONE

PR #31 merged commit:

```text
f36bc92bf9555a13a95f96652e51a1cbf95b73d7
```

Implemented below the primary Trade Review block:
- Day / Week / Month performance periods
- Net P&L
- Profit Factor
- Win Rate
- trade count
- cumulative P&L charts
- daily/trade P&L charts
- deterministic FFZ Score `0–100`
- FFZ Score breakdown: Performance / Risk / Consistency / Discipline
- small-sample confidence damping toward neutral 50 before 10 closed trades
- four-axis FFZ radar/spider visualization

FFZ Score formula is original and transparent; do not copy proprietary Zella Score logic.

---

## Weekly Review + collapsible navigation — DONE

PR #32 merged commit:

```text
a70242171eb42dc8cad5ce605561cec9b9ddbab4
```

Route:

```text
/weekly-review
```

Implemented:
- Weekly Review as a visible top-level TRACKING item, not hidden under Journal
- Monday–Sunday week navigation
- weekly scorecard: Net P&L, FFZ Score, Profit Factor, Win Rate, Trades, Avg R, Max Drawdown
- daily net P&L
- best/worst day, best setup and planned-origin highlights
- Execution / Mindset / Trade Origin breakdowns
- objective post-loss behavior metrics
- rapid re-entry metric within 15 minutes
- deterministic Weekly Findings
- no AI-generated behavioral conclusions in v1
- no persisted Next Week Focus goals yet

Navigation changes:
- Risk Calculator, Challenge/Funded and Journal groups are collapsible
- parent labels remain navigable
- active group auto-opens on route changes
- Weekly Review remains a separate top-level item

Global UI typography finalized during this PR:
- League Spartan is the application-wide font
- existing application font sizes were increased by approximately 2 px for readability

No DB migration was required.

---

# ACTIVE NEXT ROADMAP ITEM — PR #33 Objective Behavior Signals v1

Status: **TODO / NEXT**

Goal: move FFZ from passive statistics toward objective, explainable trader-behavior detection without making psychological claims the data cannot support.

Planned signals:
- **Rapid Re-entry** — trade entered within a defined short interval after a losing trade; initial reference threshold is 15 minutes
- **Loss Chase** — repeated additional entries after a loss / first daily loss
- **Overtrading** — trade count exceeds the trader's configured Trading Guardrail
- **Daily Loss Limit Pressure** — trader approaches or exceeds their own configured daily loss boundary
- **Loss Streak** — objective consecutive losing-trade sequence
- **Plan Breakdown** — Deviated / Unplanned frequency worsens after losses
- **Emotional deterioration** — compare selected mindset metadata before/after losses without inventing an emotion that was not selected
- **Risk Escalation** — when reliable initial-risk data exists, detect increased risk after a loss

Presentation principles:
- show observable facts and numbers, not accusatory labels
- never automatically call behavior “revenge trading”
- every signal should be explainable and traceable to the trades that triggered it
- prefer examples like:

```text
RAPID RE-ENTRY
3 trades were entered within 15 min after a losing trade.
Average result: -$24.30.
```

```text
LOSS-CHASE PATTERN
After the first daily loss, you averaged 2.4 additional trades.
Those trades produced -$86 this week.
```

Primary UI location:
- add **Behavior Signals** to Weekly Review
- allow drill-down to the concrete trades behind each signal

Useful secondary location:
- surface relevant guardrail/state warnings in Trading Desk where they can help before another trade is taken
- FFZ should inform and warn; it does not control or block DeepCharts execution

Prefer no schema migration for v1 if all signals can be derived deterministically from existing Journal + Guardrail data.

---

## Planned follow-up roadmap

### PR #34 — Weekly Review: Next Week Focus

Close the weekly feedback loop by letting the trader define a small number of concrete rules/focus items for the next week.

Examples:
- max 2 losing trades per day
- no immediate re-entry after a loss
- only A-quality setups

Desired future workflow:

```text
trade -> behavior detected -> weekly insight -> next-week focus -> Trading Desk reminder
```

Persisting these goals will probably require a small schema change; define the model before implementation and use a production migration, never `db:push`.

### PR #35 — Trade Review fullscreen / presentation mode

Purpose:
- distraction-free full-trade review
- stronger screenshot viewing
- useful for explaining trades during YouTube recording
- maintain screenshot-first philosophy; do not introduce replay/OHLC/chart-library scope unless separately justified

### PR #36 — Creator / YouTube workflow improvements

Iterate based on actual channel usage:
- Episode Builder improvements
- tighter handoff from reviewed trades / Weekly Review into episode planning
- creator-facing summaries or explainer assets where they genuinely save work
- improve Public Journey only from real audience/use feedback

Creator-only tooling remains Creator-only and should not consume Founder seats.

### After PR #36 — Billing pre-launch polish

Return to the existing Founder Live Mode / billing launch checklist:
- Founder activation UX
- Live Lemon variant/configuration
- production webhook verification
- complete billing smoke-test matrix
- final upgrade copy and SOLD OUT behavior

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

1. **PR #33 — Objective Behavior Signals v1**
2. **PR #34 — Weekly Review: Next Week Focus**
3. **PR #35 — Trade Review fullscreen / presentation mode**
4. **PR #36 — Creator / YouTube workflow improvements**
5. **Billing pre-launch polish + Live Lemon configuration and smoke tests**

Keep development driven by real trading usage. Do not add broad surface area just to make the product look larger.

---

## How to continue in a new ChatGPT conversation

Tell ChatGPT:

> Nastavljamo FFZ Platform projekat. Otvori `docs/FFZ_FUTURE_STEPS.md` iz GitHub repoa, proveri ACTIVE NEXT ROADMAP ITEM i nastavi odatle.

For Founder-specific continuation:

> Nastavljamo Founder billing. Otvori `docs/FFZ_FUTURE_STEPS.md` i pogledaj Founder Live Mode / Billing live-launch checklist.
