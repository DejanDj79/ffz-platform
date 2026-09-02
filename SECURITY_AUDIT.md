# FFZ user-data isolation audit — Production Readiness 1/3

This audit covers the FFZ source modules built in the completed sprints.

## Challenges

Repository operations receive `userId`.

Read/update/delete queries constrain both:

```text
resource id
user id
```

Result: another authenticated user cannot read or mutate a challenge merely by
guessing its UUID.

## Journal trades

Trade list/get/update/delete are scoped to `userId`.

When a trade references:

```text
challengeId
tradingAccountId
```

the repository validates that the referenced object also belongs to the same
user.

## Journal screenshots

Attachment routes check:

```text
current authenticated user
trade ownership
attachment ownership
```

Image bytes are served through an authenticated API route rather than `/public`.

Storage keys are generated server-side and path traversal is rejected.

## Real Money Ledger

Ledger CRUD is user-scoped.

Linked challenge/account relations are also ownership-checked.

## Creator Scoreboard

Authenticated settings APIs require:

```text
role === CREATOR
```

Settings are scoped by creator `userId`.

The OBS endpoint is intentionally public/read-only and protected by a random
overlay key. The owner must still have CREATOR role.

## Economic Calendar

Economic Calendar data is intentionally shared public-market data cached once
for all authenticated users.

It contains no user-owned data.

## Result

The current data repositories consistently scope private data by authenticated
user ID.

Production Readiness still keeps authorization checks inside route/repository
code. `src/proxy.ts` is only an early page gate and is NOT treated as the
authorization boundary.
