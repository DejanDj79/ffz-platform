# FFZ Real Money Ledger v1 UI

This patch adds the first usable Real Money Ledger screen on top of the already-working Ledger API.

## Replaces

```text
src/app/ledger/page.tsx
```

The old placeholder is removed.

## Adds

```text
src/components/ledger/RealMoneyLedger.tsx
src/components/ledger/RealMoneyLedger.module.css
src/lib/ledger/api-client.ts
src/lib/ledger/presentation.ts
src/tests/ledger-presentation.test.ts
```

It does NOT replace:
- App Shell
- Challenge Planner
- Risk Calculator
- Journal
- Ledger backend routes
- Ledger database schema

## Features

New/Edit entry:
- challenge link
- Expense / Income
- category
- date/time
- amount
- currency
- provider/company
- description
- reference
- notes

History:
- edit
- delete
- refresh
- type filter
- category filter
- challenge filter

Summary:
- Real Money Net
- Total Paid
- Total Received
- Challenge Costs
- Real Payouts

## Install

Copy the patch into the existing project.

No database change is needed for this UI sprint.

Run:

```bash
npm run test
npm run dev
```

Open:

```text
/ledger
```

## Recommended first test

You already created API test entries in the previous sprint.

They should immediately appear in the Ledger UI.

If they are still present, expected summary from the example:

```text
Expense: -$65
Income:  +$500
Net:     +$435
```

Try:

1. Edit the $65 Challenge Fee.
2. Link it to `Standard 25K #1`.
3. Save and verify it stays linked after refresh.
4. Add a Reset Fee expense.
5. Add a Payout income.
6. Test all filters.
7. Delete any temporary test entries you no longer want.

## Important product rule

This screen is the public-accountability ledger.

It should answer:

```text
How much real money have I paid?
How much real money have I actually received?
Am I net positive or negative in real cash?
```

It should NOT answer:

```text
What is my simulated/funded account P&L?
```

That belongs to Challenges and Journal.

## Git checkpoint

After confirmation:

```bash
git add .
git commit -m "Add Real Money Ledger v1 UI"
git push
```

## Next sensible step

Once Journal and Ledger are both working, the next high-value module is the main Dashboard, because it can finally aggregate real backend data from:
- Challenges
- Journal
- Real Money Ledger

Then the Dashboard can become the real FFZ command center rather than a placeholder.
