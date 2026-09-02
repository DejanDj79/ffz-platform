# FFZ Trade Journal v1 UI

This patch adds the first usable Trade Journal screen on top of the already-working Journal API.

## Replaces

```text
src/app/journal/page.tsx
```

The old placeholder is removed.

## Adds

```text
src/components/journal/TradeJournal.tsx
src/components/journal/TradeJournal.module.css
src/lib/journal/api-client.ts
src/lib/journal/stats.ts
src/tests/journal-stats.test.ts
```

No App Shell, Calculator, Challenge Planner or backend route is replaced.

## Features

New/Edit Trade:
- challenge
- instrument
- long/short
- opened/closed time
- entry
- stop
- target
- exit
- contracts
- commission & fees
- setup
- tags
- notes

History:
- edit
- delete
- refresh
- instrument filter
- outcome filter
- challenge filter

Statistics:
- Net P&L
- Win Rate
- Average R
- Profit Factor
- Total/Open trades

All P&L, R and Outcome values still come from the backend.
The UI does not calculate or submit authoritative trade performance values.

## Install

Copy the patch into the existing project.

Then:

```bash
npm run test
npm run dev
```

No `db:push` is required for this UI-only sprint.

Open:

```text
/journal
```

## Test flow

1. Create a closed MNQ trade:
   - Entry 20000
   - Stop 19990
   - Exit 20020
   - 1 contract
   - Fees 1.22
   - Opened At + Closed At both filled

2. Save.

Expected in history:
- Net P&L $38.78
- about +1.939R
- WIN

3. Click Edit and change the Exit.
4. Save and verify P&L/R update.
5. Create one open trade by leaving both Exit and Closed At blank.
6. Test filters.
7. Delete test trades if desired.

## Git checkpoint

After confirmation:

```bash
git add .
git commit -m "Add Trade Journal v1 UI"
git push
```

## Next

After the Journal UI is stable, the next sensible step is:
- Journal detail/screenshot attachment support, or
- Real Money Ledger v1

We can choose after using this screen.
