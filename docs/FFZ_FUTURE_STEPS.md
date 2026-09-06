# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-06_

Ovaj dokument je živi handoff/checklist za FFZ Platform. Kada završimo stavku, ažurirati je ovde i označiti kao završenu.

## Current project context

- Repo: `DejanDj79/ffz-platform`
- Local: `~/WaytrXGroundOps/external/ffz-platform`
- Production: `~/apps/FFZ`
- Brand: **FFZ Platform / Futures From Zero**
- Positioning: **FFZ is a prop futures trader operating system.**
- Stack: Next.js 16.3.3, React 19.2, TypeScript 5.9, Tailwind 4.3, Drizzle/PostgreSQL, Zod, Vitest
- Global app font: **League Spartan**

---

# ACTIVE NEXT ROADMAP ITEM — Real-world workflow validation

Status: **ACTIVE / USE THE PRODUCT THROUGH A COMPLETE TRADING WEEK**

The feature roadmap and authenticated page-by-page polish pass are complete enough for real use. Do not add broad new product surface just to keep development moving.

Validate the actual operating loop:

```text
Trading Desk
→ trade execution / Journal
→ Trade Review
→ Weekly Review
→ Next Week Focus
→ Build Weekly Episode
→ Trade Review Presentation while recording
→ Episode Brief / YouTube production
```

During real use, capture only concrete friction such as:
- repeated manual work
- missing data genuinely needed for review or recording
- information shown too late or in the wrong place
- confusing transitions between Journal, Trade Review, Weekly Review and Episode Builder
- creator workflow steps that materially slow down recording
- Public Journey gaps that become obvious from actual audience/channel use

Fix proven friction with small focused PRs. Do not invent speculative features before real usage identifies a need.

---

## Application UI polish — DONE / MERGED

### Dashboard polish — DONE / MERGED

PR #40: **Dashboard polish — align Market Risk and remove duplicate header block**

Merged commit:

```text
565eb7ce01bda8d3c6ba36237c96a12eba318594
```

Implemented:
- removed redundant in-page Dashboard title/description and duplicated action buttons
- Dashboard KPIs now begin page content immediately
- `MARKET RISK` aligns with Active Challenge/Funded card height
- no data or behavior changes

Validation:
- CI tests/build — PASSED
- local visual verification — PASSED by user

### Dashboard Recent Trades quick-review — DONE / MERGED

PR #46: **Dashboard recent trades quick-review modal**

Merged commit:

```text
72f6791883c35f8bb3535424df3ee903df9c9332
```

Implemented:
- replaced mixed `RECENT ACTIVITY` with focused `RECENT TRADES`
- Dashboard list shows only the latest 5 closed trades with `DATE / SYMBOL / NET P&L`
- clicking a row opens a read-only quick-review modal
- modal uses FFZ layout with trade data on the left and real same-day cumulative P&L chart on the right
- chart highlights the selected trade and does not fabricate intratrade/tick data
- modal includes execution, mindset, setup, account, P&L, R and order details without note editing
- `OPEN IN TRADE REVIEW` deep-links to the selected trade via `?trade=<id>`
- Real Money remains a separate Dashboard panel

Validation:
- FFZ CI #344 — PASSED
- local visual/behavior verification — PASSED by user
- no DB migration required

### Authenticated workspace polish — DONE / MERGED

PR #42: **Workspace polish — Trading Desk, Journal, Analytics, Weekly Review, Ledger, Prop Journey, Episode Builder and Scoreboard**

Merged commit:

```text
7a42d1f7a7945f701487b69039a024d1d815096f
```

Final CI before merge:
- FFZ CI #330 — PASSED
- tests — PASSED
- production build — PASSED

User reviewed and approved the polished authenticated pages/flows page-by-page.

Completed in PR #42:
- Trading Desk hierarchy and shared authenticated page spacing
- Economic Calendar typography
- authenticated Risk Calculator polish and persistent shell navigation
- Trading Guardrails typography
- Challenge/Funded account workflow and integrated Rules Library/custom preset management
- Journal history-first workflow with New/Edit modal
- Trade Review navigation/details/performance hierarchy
- CSV Import Setup → Upload → Verify → Import flow
- Journal Analytics hierarchy and constrained comparison scrolling
- Weekly Review retrospective → behavior → commitment → creator flow
- Real Money Ledger history-first workflow and entry modal
- Prop Journey cash-economics hierarchy
- Episode Builder creator recording flow
- Creator Scoreboard settings/preview flow
- Scoreboard FULL/COMPACT immediate switching
- COMPACT Scoreboard visibility controls fixed to use persisted settings
- FULL Scoreboard spacing refinements
- app-wide dark single-select chevron positioning/size normalization
- Rules Library standalone route removed from sidebar and legacy route redirected to `/challenges`

Important polish principles now established:
- do not create redundant “second dashboard” layouts
- task-focused hierarchy first
- same-row cards align in outer height where appropriate
- avoid unnecessarily tall cards and empty vertical space
- long tables/lists use constrained internal scrolling only when useful
- internal scrollbars stay visually quiet until hover and chain back to page scrolling at boundaries
- dark dropdown/date controls stay consistent
- authenticated AppShell page separation: 24px desktop / 18px narrow mobile
- creator tools should optimize the recording workflow, not look like generic analytics dashboards

No DB migration was required for PR #42.

---

## Founder billing — DONE

PR #20 merged commit:

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
- refunded seat never returns to `AVAILABLE`

Entitlement:
- successful Founder order => effective PRO
- later subscription lifecycle events cannot downgrade active Founder
- existing Monthly/Annual subscription is cancelled for future renewal after Founder purchase
- Creator cannot consume Founder seats

### Founder E2E test — PASSED

Test Mode Founder Variant ID:

```text
2088460
```

**Do not use this Test Mode ID in production.**

Confirmed locally:
- `/upgrade` showed 150 spots
- USER completed `$199` one-time checkout
- `order_created` activated Founder
- `FREE -> FOUNDER`
- remaining spots `150 -> 149`
- full refund tested through Lemon API
- `order_refunded` changed `FOUNDER -> FREE`
- refunded slot stayed consumed

Important webhook rule:
- `order_created` must be selected
- `order_refunded` must be selected
- keep subscription lifecycle webhook events enabled

### Production Founder deploy — DONE

Completed 2026-09-04:
- [x] backup before migration
- [x] latest `main` deployed to `~/apps/FFZ`
- [x] `drizzle-production/0004_founder_slots.sql` applied
- [x] production verification confirmed exactly **150 Founder slots**

**Never use `db:push` in production.**

---

## Founder Live Mode — BLOCKED / WAITING FOR LEMON STORE ACTIVATION

Current blocker: Lemon Squeezy store is not active yet, so Live Mode configuration and end-to-end live billing verification cannot be completed now.

Keep the existing billing implementation intact and resume immediately when Lemon activates the store.

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

Live webhook:

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

Checkout redirects to something like:

```text
/upgrade?checkout=founder-success
```

Before public launch:
- show `Payment received. Activating your Founder access...`
- poll/refresh briefly while waiting for webhook
- after activation show `FOUNDER`, `FOUNDER ACTIVE`, slot number
- show fallback if activation is delayed

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

PR #23 merged commit:

```text
5ec6565db2b8e375647277e8cafca6398c0fec3f
```

Public route:

```text
/journey
```

Purpose:
- public-facing FFZ trading journey for YouTube viewers/followers
- separate from authenticated PRO `/prop-journey`
- powered by real Creator challenge + Real Money Ledger data

Privacy rules:
- no account numbers
- no challenge/account IDs
- no private account labels
- no journal/ledger notes
- no order references
- no raw trade details
- no Creator personal display name
- public UI receives a sanitized aggregate model only

Production deploy completed 2026-09-04 and logged-out smoke test passed.

---

## Creator / YouTube workflow — DONE / MERGED

### Creator Episode Builder foundation

PR #19 merged commit:

```text
e8ae68e990f1a69fcadead5f8c5429a55cd198d4
```

Creator-only:
- `/creator/episodes`
- Episode Builder
- Scoreboard

Do not turn these into commercial PRO features.

### Build Episode from Weekly Review

PR #36 merged commit:

```text
ba49701e87815d532f8c8f2551e684cbfbdc4695
```

The original manual-selection handoff was intentionally superseded by PR #38 after the real channel workflow was defined.

### Weekly Episode auto-build

PR #38 merged commit:

```text
4551e623daad0e6edba0335553240270b0669a18
```

Current product rule:
- one episode per trading week
- exact Monday–Sunday period from Weekly Review
- every `CLOSED` Journal trade in that week included automatically
- chronological order
- no manual selection/exclusion
- no maximum-trade cap
- Episode Brief includes every closed trade
- no saved-episode DB model in V1
- Creator-only gating remains authoritative

---

## Psychology / Discipline foundation — DONE

Merged commits:

```text
PR #28  2e7740354fcb4845869df13c7b4ce86ccc17e72d
PR #29  a4a2c2b5112943a956e5156c23af1964fb0c4c21
```

Implemented:
- execution metadata: On Plan / Deviated / Unplanned
- mindset metadata: Calm / Focused / FOMO / Revenge / Fear / Frustrated / Tired
- durable `FFZ:planned` provenance
- discipline analytics and reserved-tag handling

Important rule:
- never infer **Revenge** unless the trader explicitly selected Revenge
- objective behavior signals may indicate rapid re-entry, loss chasing or overtrading, but must not automatically label them as revenge trading

---

## Trade Review — DONE

PR #30:

```text
9f38fa0eb9233f2f2001bd6f59b30ac8eebfcd8a
```

Route: `/journal/review`

Implemented screenshot-first review, navigation, attachments, details, execution/mindset/planned-origin metadata and responsive review layout.

### Trade Review Performance + FFZ Score — DONE

PR #31:

```text
f36bc92bf9555a13a95f96652e51a1cbf95b73d7
```

Implemented Day/Week/Month performance, Net P&L, Profit Factor, Win Rate, trade count, P&L charts and deterministic FFZ Score `0–100` with Performance / Risk / Consistency / Discipline breakdown.

FFZ Score formula is original and transparent; do not copy proprietary Zella Score logic.

### Trade Review Presentation mode — DONE

PR #35:

```text
63a9e066ff300f0246792d2c9247d86dbc7ce42e
```

Presentation mode supports focused review/YouTube recording, previous/next, keyboard navigation, `Esc`, tabs and browser Fullscreen API progressive enhancement.

---

## Weekly Review / behavior feedback loop — DONE

### Weekly Review

PR #32:

```text
a70242171eb42dc8cad5ce605561cec9b9ddbab4
```

Route: `/weekly-review`

Implemented weekly scorecard, daily P&L, highlights, execution/mindset/origin breakdowns, post-loss metrics and deterministic findings.

### Objective Behavior Signals v1

PR #33:

```text
bdeebea649a5513d1112fc13b22cbb69c4128951
```

Signals:
- Rapid Re-entry
- Post-loss Activity
- Loss Streak
- Overtrading
- Daily Loss Count
- Plan Breakdown
- Mindset Shift
- Risk Escalation

All are deterministic/objective. No AI behavioral conclusions and no automatic Revenge label.

Development-only demo mode:

```text
/weekly-review?behaviorDemo=1
```

### Next Week Focus

PR #34:

```text
d996311717321390ff8e82969839a721a6c2290d
```

Feedback loop:

```text
trade -> behavior detected -> weekly insight -> next-week focus -> Trading Desk reminder
```

Persistence:
- table: `weekly_focuses`
- one per user/week
- production migration: `drizzle-production/0005_weekly_focuses.sql`
- production deployment confirmed complete

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
- Weekly Review -> automatic Weekly Episode handoff
- future internal creator tooling only when justified by real workflow

---

## Later product work

Only after real usage identifies a need:
- fix proven friction in the automatic weekly episode workflow
- improve Public Journey from real audience/use feedback
- iterate Episode Builder from actual channel workflow friction
- add creator-facing summaries/assets only when they demonstrably save work
- keep development driven by real trading usage rather than adding surface area for its own sake

---

## GitHub workflow rules

Use:
1. feature/fix/polish branch
2. draft PR
3. CI
4. local test
5. user confirms behavior/visuals
6. merge
7. **immediately update `docs/FFZ_FUTURE_STEPS.md` before considering the task fully complete**

Once the user explicitly confirms behavior/visuals and CI is green, merge immediately without asking again.

After every merge:
- mark the completed PR / feature as DONE in this document
- record the merge commit SHA
- update production/migration status if known
- move `ACTIVE NEXT ROADMAP ITEM` to the real next task
- update `Recommended next order of work`
- do not leave this file pointing at an already-completed PR

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
- Trade Review Presentation should be suitable for screen-recorded trade explanations
- one episode per trading week
- every CLOSED Journal trade from that week appears automatically in the episode; no manual selection/exclusion

---

## Recommended next order of work

1. **Use FFZ through a complete real trading week and log only proven workflow friction**
2. **Fix concrete friction with small focused PRs, prioritizing the Trading Desk → Journal → Review → Weekly Review → Episode flow**
3. **Resume Billing pre-launch / Founder Live Mode immediately after Lemon store activation**

Completed immediately before this roadmap position:
- [x] PR #34 — Weekly Review: Next Week Focus
- [x] PR #35 — Trade Review fullscreen / presentation mode
- [x] PR #36 — Build Episode from Weekly Review
- [x] PR #38 — Weekly Episode auto-build
- [x] PR #40 — Dashboard visual polish
- [x] PR #42 — authenticated workspace page-by-page polish
- [x] PR #46 — Dashboard Recent Trades quick-review modal

Keep development driven by real usage and direct visual review. Do not add broad surface area just to make the product look larger.

---

## How to continue in a new ChatGPT conversation

Tell ChatGPT:

> Nastavljamo FFZ Platform projekat. Otvori `docs/FFZ_FUTURE_STEPS.md` iz GitHub repoa, proveri ACTIVE NEXT ROADMAP ITEM i nastavi odatle.

For Founder-specific continuation:

> Nastavljamo Founder billing. Otvori `docs/FFZ_FUTURE_STEPS.md` i pogledaj Founder Live Mode / Billing live-launch checklist.