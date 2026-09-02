# FFZ Backend v1.5 — Trade Journal schema + API

This sprint adds the Journal backend only. No Journal UI yet.

## Added

Database:
- `trades`
- `trade_direction`
- `trade_status`
- `trade_outcome`

API:
- `GET /api/journal/trades`
- `POST /api/journal/trades`
- `GET /api/journal/trades/:id`
- `PATCH /api/journal/trades/:id`
- `DELETE /api/journal/trades/:id`

Calculated server-side:
- Open/Closed
- Gross P&L
- Net P&L
- Initial Risk
- R multiple
- Win/Loss/Breakeven

The calculation reuses the existing specs in `src/lib/trading/instruments.ts`.

## Install

Before copying, make a Git checkpoint if needed:

```bash
git status
git add .
git commit -m "Complete authentication backend"
```

Copy the ZIP contents into the FFZ project root.

The only existing source file intentionally replaced is:

```text
src/db/schema.ts
```

Then:

```bash
npm run db:push
npm run test
npm run dev
```

Do NOT reset the database.

## Verify

While logged in, open:

```text
/api/journal/trades
```

Initially expect:

```json
{"data":[]}
```

Create a test trade in browser DevTools:

```js
fetch("/api/journal/trades", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    challengeId: null,
    tradingAccountId: null,
    instrument: "MNQ",
    direction: "LONG",
    openedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    closedAt: new Date().toISOString(),
    entryPrice: 20000,
    stopPrice: 19990,
    targetPrice: 20020,
    exitPrice: 20020,
    contracts: 1,
    commissionFees: 1.22,
    setup: "API Test",
    tags: ["scalp", "test"],
    notes: "Trade Journal backend test."
  })
}).then(r => r.json()).then(console.log)
```

Expected:
- Gross P&L = 40.00
- Net P&L = 38.78
- Initial Risk = 20.00
- R Multiple = 1.939
- Outcome = WIN
- Status = CLOSED

Then refresh `/api/journal/trades`.

## After confirmation

Commit:

```bash
git add .
git commit -m "Add Trade Journal backend API"
```

Next sprint: Trade Journal v1 UI.
