# FFZ Economic Calendar v1.1 — Forex Factory provider

This patch replaces Signal8 with the public Forex Factory weekly JSON calendar
export.

Why:

```text
Signal8 Free API key
        ↓
Economic Calendar endpoint
        ↓
HTTP 403 / TIER_INSUFFICIENT
```

No Signal8 subscription is needed.

New source:

```text
Forex Factory public weekly JSON export
```

The existing FFZ Calendar UI, PostgreSQL cache, filters, countdown and global
HIGH-impact alert remain.

## Data available

The feed supplies:

```text
date/time
currency
impact: High / Medium / Low
title
forecast
previous
actual (when available after release)
```

Forex Factory also emits non-economic rows such as `Holiday`; FFZ v1.1 ignores
those because the current UI is specifically an economic-impact calendar.

## API key

You can remove this from `.env.local`:

```bash
SIGNAL8_API_KEY=...
```

It is no longer used.

## Cache

The existing `economic_calendar_cache` table stays unchanged.

The provider cache key changes from:

```text
signal8-economic:...
```

to:

```text
forexfactory-economic:...
```

so old Signal8 cache rows cannot contaminate the new feed.

No DB migration is required for this provider swap.

## Install

Copy the patch over the current FFZ project, then:

```bash
npm run test
npm run dev
```

No `db:push` is required for v1.1 if Economic Calendar v1 already created the
`economic_calendar_cache` table.

Open:

```text
/economic-calendar
```

Expected source indicator:

```text
FOREX FACTORY
```

and calendar rows should load immediately.

## Files changed

```text
src/lib/economic-calendar/types.ts
src/lib/economic-calendar/calendar-utils.ts
src/lib/economic-calendar/service.ts
src/app/api/economic-calendar/route.ts
src/components/economic-calendar/EconomicCalendar.tsx
src/tests/economic-calendar.test.ts
```

New:

```text
src/lib/economic-calendar/forex-factory-provider.ts
```

The old file:

```text
src/lib/economic-calendar/signal8-provider.ts
```

can be deleted after copying this patch.

## Important

The public feed is rate limited, so FFZ retains the PostgreSQL cache and only
refreshes the external source every 15 minutes during the US-market portion of
the day and every 30 minutes otherwise.

For a future public commercial launch, re-check Forex Factory/Fair Economy
Media's then-current terms for redistribution. The provider is isolated behind
one adapter so it can be replaced without changing the Calendar UI.
