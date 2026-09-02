# FFZ Dashboard v1

This patch replaces the Dashboard placeholder with the first real FFZ command center.

It uses existing APIs only:

```text
/api/challenges
/api/journal/trades
/api/ledger
```

No database change is required.

## Replaces

```text
src/app/dashboard/page.tsx
```

## Adds

```text
src/components/dashboard/Dashboard.tsx
src/components/dashboard/Dashboard.module.css
src/lib/dashboard/summary.ts
src/tests/dashboard-summary.test.ts
```

## Dashboard sections

Primary Challenge:
- challenge name / prop firm
- status / phase
- current balance
- challenge P&L
- target remaining
- target progress

Real Money:
- Real Money Net
- Total Paid
- Total Received
- Real Payouts

Journal:
- Net P&L
- Win Rate
- Average R
- Profit Factor
- Open Trades

Recent Activity:
- Journal trades
- Real Money Ledger events
- sorted together by timestamp

Quick Actions:
- Risk Calculator
- Journal
- Ledger
- Challenge Planner

## Install

First make sure the Ledger UI is committed:

```bash
git status
git add .
git commit -m "Add Real Money Ledger v1 UI"
git push
```

Then copy this patch into the project.

Run:

```bash
npm run test
npm run dev
```

No `db:push` required.

Open:

```text
/dashboard
```

## Important distinction

Dashboard intentionally shows two different money concepts:

```text
JOURNAL NET P&L
```

is trading performance.

```text
REAL MONEY NET
```

is money actually paid/received.

They must never be combined into one number.

## Git checkpoint

After confirmation:

```bash
git add .
git commit -m "Add FFZ Dashboard v1"
git push
```

## Next

After Dashboard v1 is stable, the platform core is complete enough to move to one of these:
- Journal screenshot attachments
- Scoreboard / OBS overlay
- Episode snapshots
- production deploy preparation
