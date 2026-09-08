# FFZ Platform — Future Steps / Handoff

_Last updated: 2026-09-08_

Ovaj dokument je živi handoff/checklist za FFZ Platform. Držati ga usklađenim sa stvarnim stanjem `main` grane i realnim načinom korišćenja aplikacije.

## Current project context

- Repo: `DejanDj79/ffz-platform`
- Branch: `main`
- Local: `~/ffz-platform`
- Production: `/opt/ffz`
- Domain: `ffz.app`
- Brand: **FFZ Platform / Futures From Zero**
- Positioning: **FFZ is a prop futures trader operating system.**
- Stack: Next.js 16.3.3, React 19.2, TypeScript 5.9, Tailwind 4.3, Drizzle/PostgreSQL, Zod, Vitest
- Global app font: **League Spartan**
- Production: Hetzner + Docker Compose + PostgreSQL + shared Nginx/Let's Encrypt network

---

# ACTIVE NEXT ROADMAP ITEM — Real-world workflow validation

Status: **ACTIVE / FULL AUGUST PREFLIGHT → REAL TRADING WEEK**

The product surface is complete enough for real use. Do not add broad new features only to keep development moving.

First run the complete operating loop once with the merged local August demo dataset, then repeat the same loop with real trading data through a complete trading week:

```text
Trading Desk
→ Risk Calculator / Planned Trade when needed
→ completed trade / Journal
→ Trade Review
→ Weekly Review
→ Next Week Focus
→ Build Weekly Episode
→ BRIEF
→ STORY
→ SCRIPT
→ RECORD
→ PUBLISH
```

During preflight and real use, capture only concrete friction such as:
- repeated manual work
- data that is genuinely missing when reviewing or recording
- information shown too late or in the wrong place
- confusing transitions between Journal, Trade Review, Weekly Review and Creator
- creator steps that materially slow down recording
- Public Journey gaps exposed by actual channel/audience use
- places where a full trading week behaves differently from the small test episode

Fix proven friction with small focused changes. Do not invent speculative product surface before real usage identifies a need.

## Core product rules

### Journal
- pre-trade planning belongs to Risk Calculator / Planned Trades
- Journal is the post-trade record and stores completed trades only
- FFZ does not track live/open positions
- planned trades do not affect Journal/challenge statistics until a result is logged

### Weekly episode
- one episode per trading week
- Weekly Review defines the exact review period/account
- every `CLOSED` Journal trade in the selected week is included automatically
- closed trades stay chronological
- there is no manual trade exclusion and no maximum-trade cap
- featured/key trades only receive deeper emphasis; they never remove ordinary trades from the episode

### Psychology / behavior
- behavior signals are deterministic/objective
- never infer **Revenge** unless the trader explicitly selected Revenge
- rapid re-entry, post-loss activity, overtrading, risk escalation, etc. may be surfaced without assigning an unselected motive

### Creator
- Creator tools are internal/owner-only, not commercial PRO features
- facts come from FFZ data; generated copy must not invent motives, chart observations or historical account state
- `TALKING POINT` / producer cues are prompts for the creator and are **not spoken script**

---

# Creator / YouTube workflow — DONE / READY FOR REAL-WORLD VALIDATION

Route:

```text
/creator/episodes
```

Current workflow:

```text
01 BRIEF → 02 STORY → 03 SCRIPT → 04 RECORD → 05 PUBLISH
```

## BRIEF

Current Episode Builder:
- authenticated Creator-only access
- configurable `from`, `to`, challenge/account and source
- Weekly Review handoff locks the intended period/account
- all closed Journal trades included
- Net P&L, trade count, Average R, Real Money Net and challenge/account context
- behavior Story Signals / talking points
- Episode Brief generated from verified FFZ data

## Persistent episode model

Persistent Creator episodes are now implemented.

Table:

```text
creator_episodes
```

Important fields include:
- title / status / source / period
- challengeId
- brief
- storyAngle
- script
- featuredTradeIds
- publishTitle
- thumbnailText
- description
- chapters
- youtubeUrl

Status flow:

```text
DRAFT → SCRIPT_READY → RECORDED → EDITED → PUBLISHED
```

Migrations:
- local: `drizzle/0007_creator_episodes.sql`
- production: `drizzle-production/0007_creator_episodes.sql`
- local: `drizzle/0008_creator_publish_fields.sql`
- production: `drizzle-production/0008_creator_publish_fields.sql`

Local note:
- local `drizzle/` still has no normal Drizzle migration journal
- if a fresh local DB does not contain these tables/columns, apply the SQL once through `psql`
- do not start using local `db:migrate` unless that setup is intentionally changed

Production:
- `scripts/deploy-production.sh` applies committed `drizzle-production` migrations
- `scripts/verify-production-schema.sh` verifies required production schema
- never use production `db:push`

## STORY

Deterministic Story Builder:
- ranks actual story candidates from P&L, setups, Journal metadata and behavior signals
- one strongest `PRIMARY STORY`
- at most one genuinely distinct `ALTERNATIVE STORY`
- weaker evidence becomes `OTHER THREAD`
- no generic fallback story when a real primary exists
- selected story can be edited and persisted
- key/featured trade IDs are persisted only for emphasis

Story roles:
- `PRIMARY`
- `ALTERNATIVE`
- `THREAD`

Strength:
- `STRONG`
- `SOLID`
- `SUPPORTING`

## SCRIPT

Deterministic recording draft:
- natural first-person FFZ voice
- all closed trades remain in the chronological recap
- up to three strongest key trades get deeper treatment
- Journal execution, mindset, notes and initial risk are used only when actually stored
- rapid post-loss timing is derived from actual timestamps
- missing chart/motive information becomes `[TALKING POINT: ...]`, not invented narration
- deep-dive prompts are dynamic and kept to roughly 2–3 useful prompts per key trade
- estimated runtime includes expected guided discussion time
- current target is roughly 15–20 minutes, but the estimator is guidance rather than a forced duration

## RECORD

Teleprompter/recording mode:
- uses the **saved script**, not unsaved generated preview
- fullscreen
- auto-scroll
- very slow scroll speeds supported through sub-pixel accumulation
- speed and font controls
- Restart
- section/cue presentation
- producer cues are visually separated and marked not to read
- no reading-guide horizontal line
- `MARK RECORDED` moves the episode to `RECORDED`
- later statuses are preserved if the user revisits RECORD

Keyboard / CV09 mapping currently used:
- `F13` Play / Pause
- `F14` Slower
- `F15` Faster
- `F16` Smaller text
- `F17` Larger text
- `F18` Restart
- `F19` Fullscreen
- Space also toggles Play / Pause

Recording rule:
- ordinary paragraph text is spoken
- section labels, CAMERA/DEEPCHARTS/JOURNAL/SCOREBOARD cues and producer prompts are not spoken
- pause auto-scroll while answering a producer cue naturally

## PUBLISH

Publish Builder generates and persists:
- multiple title ideas
- multiple thumbnail-text ideas
- editable final YouTube title
- editable final thumbnail text
- YouTube description
- chapters calculated from real script sections/timing
- optional YouTube URL
- copy controls

Workflow:
- `SAVE PACKAGE` → `EDITED`
- `MARK PUBLISHED` → `PUBLISHED`

Copy principles:
- title/thumbnail should reflect the actual primary story, not generic “weekly recap”
- description documents the journey and verified episode stats
- no guru language or fake certainty
- include personal-learning / not-financial-advice context

## Current Creator validation target

Use the full August demo dataset to test:
- a week with materially more than nine trades
- whether chronological recap remains concise
- whether Story ranking still picks the right primary
- whether key-trade selection remains useful
- whether 2–3 deep-dive prompts per key trade are enough
- teleprompter pacing while actually speaking
- chapter timestamps after natural pauses
- whether Publish output needs any manual repetitive cleanup

Only change Creator after this real workflow exposes concrete friction.

---

# Scoreboard / recording support — DONE

Creator Scoreboard remains available for OBS/recording.

Current direction:
- professional fintech/trading look, not gaming/esports
- FULL and COMPACT are separate layouts
- COMPACT visibility controls use persisted settings
- compact overlay is centered correctly
- scoreboard should support recording rather than become a second analytics dashboard

Trade Review Presentation mode also remains available for chart/trade explanation during recording.

---

# Password recovery — DONE / DEPLOYED

Completed:
- Forgot password → Resend SMTP email → one-time 30-minute reset link
- token hashes only
- transactional password change/token consumption/session revocation
- neutral responses to prevent account discovery
- IP rate limit and persistent per-account cooldown
- Resend domain `ffz.app` verified
- sender `FFZ <noreply@ffz.app>`
- real production reset flow verified

Migration:
- `drizzle-production/0006_password_reset_tokens.sql`

Historical merged PR:
- PR #57
- commit `84325daba8c6d614d60d9a863a296717d9fcde42`

---

# Local full-month August workflow dataset — DONE

Purpose:
- deterministic end-to-end development fixture
- August 2026 Creator/PRO scenario
- 53 closed MNQ/MES trades
- failed evaluation → passed evaluation → funded progression
- includes discipline/mindset patterns, Ledger fees/payout, Weekly Focus, Guardrails, Scoreboard settings and a carry-forward Planned Trade
- intentionally includes rapid re-entry, loss streaks, overtrading, daily-loss breaches and risk escalation
- never auto-labels Revenge

Demo account:

```text
Email: month-demo@ffz.local
Password: FFZdemo2026!
```

Seed:

```bash
npm run db:seed:month-demo -- --confirm-local
```

Safety:
- local-only confirmation required
- refuses production mode
- requires localhost PostgreSQL
- requires database name `ffz_platform`
- touches only the dedicated demo user/data

Historical:
- PR #44
- commit `26df5e64e5f8935e103cad9547b5ad5dc9d3a09e`

This dataset is the immediate preflight fixture before a real trading week.

---

# Trading workflow foundations — DONE

## Trade Review

Route:

```text
/journal/review
```

Implemented:
- screenshot-first review
- previous/next navigation
- attachments
- details / execution / mindset / planned-origin metadata
- Day/Week/Month performance
- Net P&L / Profit Factor / Win Rate / trade count
- cumulative P&L charts
- deterministic FFZ Score `0–100`
- fullscreen/presentation mode
- keyboard navigation
- Dashboard deep-links to specific trades

Historical:
- PR #30 `9f38fa0eb9233f2f2001bd6f59b30ac8eebfcd8a`
- PR #31 `f36bc92bf9555a13a95f96652e51a1cbf95b73d7`
- PR #35 `63a9e066ff300f0246792d2c9247d86dbc7ce42e`
- PR #45 `b8f62411f8e3cccba7d6789b8aaa6f136f8db961`
- PR #46 `72f6791883c35f8bb3535424df3ee903df9c9332`

## Weekly Review / behavior feedback loop

Route:

```text
/weekly-review
```

Implemented:
- weekly scorecard
- daily P&L
- highlights
- execution/mindset/origin breakdowns
- post-loss metrics
- deterministic findings

Objective behavior signals:
- Rapid Re-entry
- Post-loss Activity
- Loss Streak
- Overtrading
- Daily Loss Count
- Plan Breakdown
- Mindset Shift
- Risk Escalation

Next Week Focus feedback loop:

```text
trade → behavior detected → weekly insight → next-week focus → Trading Desk reminder
```

Persistence:
- table `weekly_focuses`
- one per user/week
- production migration `drizzle-production/0005_weekly_focuses.sql`

Historical:
- PR #32 `a70242171eb42dc8cad5ce605561cec9b9ddbab4`
- PR #33 `bdeebea649a5513d1112fc13b22cbb69c4128951`
- PR #34 `d996311717321390ff8e82969839a721a6c2290d`

---

# Application polish / commercial foundations — DONE

Major completed work:
- Dashboard hierarchy and Recent Trades quick review
- authenticated workspace page-by-page polish
- Journal completed-trades-only workflow
- Planned Trade → Log Result workflow
- typography consistency cleanup
- authenticated sticky header toolbar
- global `LOG TRADE`
- account/user menu
- dark form-control consistency
- signed positive/negative P&L chart fills
- contextual paywalls and upgrade return flow
- server-gated DeepCharts CSV import
- Founder hard-cap backend and Test Mode E2E
- Public FFZ Journey MVP
- password recovery
- Creator workflow through Publish

Important historical PRs:
- PR #40 `565eb7ce01bda8d3c6ba36237c96a12eba318594`
- PR #42 `7a42d1f7a7945f701487b69039a024d1d815096f`
- PR #49 `d7e91d507c6768682131a7809f4efee6fbab4766`
- PR #52 `b23e3324de1628efc3a09aec4d664ebc285a440f`
- PR #53 `43ec426c28dbef7b22e3bacf85758083fd353637`
- PR #55 `2af419e06b1d70267662d8c94144b0dcf2243650`
- PR #57 `84325daba8c6d614d60d9a863a296717d9fcde42`

Polish principles:
- no redundant “second dashboard” layouts
- task-focused hierarchy first
- same-row cards align in outer height when appropriate
- avoid tall empty cards
- long tables/lists use constrained internal scrolling only when useful
- dark dropdown/date controls stay consistent
- Creator optimizes recording workflow rather than looking like generic analytics
- make small visual changes only when they improve real use

---

# Public FFZ Journey MVP — DONE

Public route:

```text
/journey
```

Purpose:
- public-facing FFZ trading journey for YouTube viewers/followers
- separate from authenticated PRO `/prop-journey`
- powered by real Creator challenge + Real Money Ledger data

Privacy:
- no account numbers
- no private challenge/account IDs or labels
- no Journal/Ledger notes
- no order references
- no raw trade details
- no Creator personal display name
- public UI receives only sanitized aggregates

Historical:
- PR #23
- commit `5ec6565db2b8e375647277e8cafca6398c0fec3f`

Future changes only from actual audience/use feedback.

---

# Billing / monetization

## Current commercial model

- FREE: `$0`
- PRO Monthly: `$12.99/month`
- PRO Yearly: `$99/year`
- Founder: `$199 one-time`, lifetime PRO, first 150 traders
- Creator: internal/owner role, effective PRO, no Founder seat

## Product gating

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
- BRIEF / STORY / SCRIPT / RECORD / PUBLISH
- Scoreboard
- Weekly Review → automatic Weekly Episode handoff
- future creator tooling only when justified by real workflow

## Founder billing backend — DONE

Founder rules:
- `$199` one-time
- lifetime PRO
- hard cap: 150
- refunded Founder seat does not reopen
- Creator cannot consume Founder seats
- active Founder cannot be downgraded by later subscription lifecycle events

`founder_slots` states:
- `AVAILABLE`
- `RESERVED`
- `PURCHASED`
- `REFUNDED`

Production Founder backend/migration is already deployed and verified with exactly 150 slots.

Historical:
- PR #20
- commit `d0323177410ca656fd969c98a8ff7a04506738e7`

## Founder Live Mode — BLOCKED / WAITING FOR LEMON STORE ACTIVATION

Do not change the working billing implementation while waiting.

When Lemon activates the store:
- create Live Founder variant: `Founder Trader`, `$199`, one-time
- configure `LEMONSQUEEZY_FOUNDER_VARIANT_ID`
- set `LEMONSQUEEZY_TEST_MODE=false`
- verify live webhook at FFZ production domain

Required webhook events:
- `order_created`
- `order_refunded`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_expired`

Live-launch smoke tests still required:
- [ ] Live Founder variant created
- [ ] Live Founder Variant ID added
- [ ] Test Mode disabled
- [ ] Live webhook URL verified
- [ ] required webhook events selected
- [ ] Founder purchase
- [ ] Monthly PRO purchase
- [ ] Annual PRO purchase
- [ ] existing PRO → Founder
- [ ] full refund
- [ ] partial refund
- [ ] SOLD OUT behavior

Resume this immediately after Lemon store activation.

---

# Deployment / schema rules

## Local

```bash
cd ~/ffz-platform
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

For a fresh local DB, Creator migrations may need one-time manual application because local `drizzle/` has no normal migration journal:

```bash
docker exec -i ffz-postgres psql -U ffz -d ffz_platform < drizzle/0007_creator_episodes.sql
docker exec -i ffz-postgres psql -U ffz -d ffz_platform < drizzle/0008_creator_publish_fields.sql
```

Do not repeat these if the columns/table already exist.

## Production

Before risky/schema deploy:

```bash
cd /opt/ffz
./scripts/backup-production.sh
```

Deploy:

```bash
cd /opt/ffz
git switch main
git pull --ff-only origin main
./scripts/deploy-production.sh
```

Production rules:
- committed `drizzle-production/` migrations only
- deploy script runs migrations before app readiness
- `scripts/verify-production-schema.sh` must pass
- never use `db:push`
- never delete PostgreSQL/upload named volumes
- never run `docker system prune -a --volumes`

Infrastructure:
- Hetzner
- Docker Compose
- PostgreSQL on same server
- shared proxy network `agarviz_default`
- Nginx/Let's Encrypt shared with AgarViz
- FFZ app upstream on port 3000 inside Docker

---

# GitHub workflow rules

Normal development discipline:
1. focused feature/fix/polish
2. CI
3. local behavior/visual test
4. user confirms
5. merge/update `main`
6. update this handoff before considering the work complete

For direct small `main` fixes used in the current workflow:
- keep commits focused
- always verify latest FFZ CI after the final commit
- never report completion while the latest build is still failing
- if sequentially editing the same GitHub file, refetch/use the latest blob SHA

After relevant completed work, update:
- completed feature status
- migration/deploy status if known
- `ACTIVE NEXT ROADMAP ITEM`
- `Recommended next order of work`

---

# User trading / YouTube context

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
- English scripts
- target episodes roughly 15–20 minutes
- transparent beginner/process voice
- no guru/fake-certainty framing
- one episode per trading week
- all closed trades from the week included
- key trades get deeper discussion
- Trade Review Presentation + Creator teleprompter support recording
- one external monitor + laptop + one phone
- CV09 mapped to F13–F21; Creator RECORD currently uses F13–F19

---

# Later product work

Only after real usage identifies a need:
- fix proven friction in the complete weekly operating loop
- iterate Story/Script/key-trade ranking from actual recording friction
- improve Public Journey from real audience feedback
- add creator-facing summaries/assets only when they demonstrably save repeated work
- consider AI/API integration only if it saves enough work to justify separate API cost; ChatGPT subscription and API billing remain separate
- keep development driven by real trading usage rather than adding surface area for its own sake

---

# Recommended next order of work

1. **Run the full August demo workflow end-to-end: Trading Desk → Journal → Trade Review → Weekly Review → Next Week Focus → BRIEF → STORY → SCRIPT → RECORD → PUBLISH.**
2. **Log only concrete friction found during that pass.**
3. **Fix the smallest high-value friction items, if any.**
4. **Repeat the same operating loop through one complete real trading week.**
5. **Use that real week to validate Story ranking, key-trade selection, teleprompter pacing, Publish output and Public Journey usefulness.**
6. **Resume Founder/PRO Live Mode immediately after Lemon activates the store.**

Do not start a new broad feature roadmap until steps 1–5 provide evidence that one is needed.

## Recently completed before this roadmap position

- [x] Weekly Review: Next Week Focus
- [x] Trade Review fullscreen/presentation mode
- [x] Weekly Episode automatic all-closed-trades handoff
- [x] Dashboard / authenticated workspace polish
- [x] August full-month local workflow seed
- [x] Trade Review navigation/chart fixes
- [x] Dashboard Recent Trades quick review
- [x] paywall/upgrade activation UX and server-gated CSV import
- [x] Journal completed-trades-only + Planned Trade result logging
- [x] typography polish
- [x] authenticated sticky header + global LOG TRADE
- [x] password recovery via Resend on `ffz.app`
- [x] persistent Creator episode model
- [x] Story Builder ranking/primary/threads
- [x] deterministic recording Script Builder
- [x] RECORD teleprompter with CV09 keyboard controls
- [x] PUBLISH title/thumbnail/description/chapters package
- [x] Creator publish persistence/status flow
- [x] current favicon replaced and browser-cache issue fixed

