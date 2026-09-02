# FFZ Backend v1.6 — Real Money Ledger API

This sprint adds the backend for the Real Money Ledger.

It tracks REAL cash movement only.

It does NOT duplicate challenge account P&L or Journal trade P&L.

Examples:
- challenge purchase
- reset
- activation/reactivation
- platform/data fees
- real payout received
- refund
- other real expense/income

## Database

New table:

```text
ledger_entries
```

New enum:

```text
ledger_entry_type
  EXPENSE
  INCOME
```

Amounts are always positive integer cents.
`entryType` determines whether money went out or came in.

Categories remain a varchar in PostgreSQL so we can add new categories later without changing a DB enum.

Current categories:

```text
CHALLENGE_FEE
RESET_FEE
ACTIVATION_FEE
REACTIVATION_FEE
PLATFORM_FEE
DATA_FEE
PAYOUT
REFUND
OTHER_EXPENSE
OTHER_INCOME
```

An entry can optionally link to:
- a Challenge
- a Trading Account

The backend verifies that linked records belong to the authenticated user.

## API

```text
GET    /api/ledger
POST   /api/ledger

GET    /api/ledger/:id
PATCH  /api/ledger/:id
DELETE /api/ledger/:id
```

## Install

First commit the working Journal UI if needed:

```bash
git status
git add .
git commit -m "Add Trade Journal v1 UI"
git push
```

Then copy this patch into the existing project.

The only existing source file intentionally replaced is:

```text
src/db/schema.ts
```

Everything under:

```text
src/lib/ledger/
src/app/api/ledger/
```

is new.

Update PostgreSQL:

```bash
npm run db:push
```

Do NOT reset the database.

Then:

```bash
npm run test
npm run dev
```

## Verify empty ledger

While logged in open:

```text
/api/ledger
```

Expected initially:

```json
{"data":[]}
```

## Create a test expense

Browser DevTools:

```js
fetch("/api/ledger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    challengeId: null,
    tradingAccountId: null,

    entryType: "EXPENSE",
    category: "CHALLENGE_FEE",

    occurredAt: new Date().toISOString(),
    amount: 65,
    currency: "USD",

    provider: "Blue Guardian Futures",
    description: "Standard 25K challenge",
    reference: null,
    notes: "Real Money Ledger API test."
  })
}).then(r => r.json()).then(console.log)
```

Refresh:

```text
/api/ledger
```

The $65 expense should be returned from PostgreSQL.

## Create a test payout

```js
fetch("/api/ledger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    challengeId: null,
    tradingAccountId: null,

    entryType: "INCOME",
    category: "PAYOUT",

    occurredAt: new Date().toISOString(),
    amount: 500,
    currency: "USD",

    provider: "Example Prop Firm",
    description: "First payout test",
    reference: null,
    notes: null
  })
}).then(r => r.json()).then(console.log)
```

## Design rule

A Real Money Ledger payout is the amount you actually received.

Example:

```text
Funded account trading P&L:  +$800
Payout approved:             $500
Money actually received:     $500
```

Journal/Challenge may know about the $800 trading result.

Real Money Ledger records only:

```text
+$500 PAYOUT
```

Likewise, defining a challenge fee in a Prop Firm preset does NOT automatically create a Ledger expense.

A Ledger expense is created only when real money was actually paid.

This distinction keeps the channel's future "Real Money Ledger" honest and auditable.

## After confirmation

Commit:

```bash
git add .
git commit -m "Add Real Money Ledger backend API"
git push
```

Next sprint:

```text
Real Money Ledger v1 UI
```
