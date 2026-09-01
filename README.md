# FFZ Backend v1.4 — Authentication

This sprint adds real local user accounts and changes the Challenge API from the temporary `dev@ffz.local` identity to the authenticated session user.

## What this patch adds

- email + password registration
- login
- logout
- 30-day HTTP-only session cookie
- hashed passwords (`bcryptjs`)
- random session tokens; only SHA-256 token hashes are stored in PostgreSQL
- `sessions` table
- `users.password_hash`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- Challenge API ownership based on the logged-in user
- App Shell authentication gate
- signed-in user shown in sidebar
- PostgreSQL indicator in App Shell
- standalone `/login` and `/register` screens

## Existing challenge data is preserved

Until now your challenge belongs to the temporary database user:

```text
dev@ffz.local
```

In DEVELOPMENT only, the first real account you register automatically claims:
- challenges
- trading accounts

from `dev@ffz.local`.

Production never performs this automatic claim.

---

## 1. Copy patch files

Copy all files from this ZIP into the matching project paths.

This intentionally replaces:

```text
src/db/schema.ts
src/db/seed.ts
src/app/api/challenges/route.ts
src/app/api/challenges/[id]/route.ts
src/components/shell/AppShell.tsx
src/components/shell/AppShell.module.css
```

It adds the auth routes, helpers, login/register pages and tests.

It does NOT replace:
- ChallengePlanner.tsx
- RiskCalculator.tsx
- their CSS
- challenge calculation/rules files

---

## 2. Install auth package

```bash
npm install bcryptjs
```

---

## 3. Update the development database

This project is still in the pre-production `db:push` phase because the first schema was bootstrapped without a Drizzle snapshot baseline.

Run:

```bash
npm run db:push
```

The changes are additive:
- `users.password_hash`
- new `sessions` table

Do NOT delete or reset the database.

---

## 4. Run tests

```bash
npm run test
```

There is a new:

```text
auth-validation.test.ts
```

---

## 5. Start the app

```bash
npm run dev
```

Open:

```text
/dashboard
```

Because you do not yet have a session, the App Shell should redirect you to:

```text
/login
```

Choose:

```text
Create one
```

and register your first real local account.

Use an email/password you can remember for this development environment.
The password must contain at least 8 characters.

### Important

This is only your LOCAL development account.
It is not yet a public production account and there is no email verification/password reset yet.

---

## 6. Verify the old challenge moved to your account

Immediately after registration you should land on:

```text
/dashboard
```

Open:

```text
/challenges
```

Your existing `Standard 25K #1` should still be there.

Then open:

```text
/tools/risk-calculator
```

`Use Challenge` should still show the same challenge.

That proves the old dev-owned PostgreSQL row was reassigned to your newly registered user.

---

## 7. Verify auth API

While logged in open:

```text
/api/auth/me
```

Expected:

```json
{
  "data": {
    "id": "...",
    "email": "your-email@example.com",
    "displayName": "..."
  }
}
```

Open:

```text
/api/challenges
```

The challenge should still be returned.

---

## 8. Test logout/login

Click `Sign out` at the bottom of the sidebar.

Expected:
- redirected to `/login`
- `/dashboard` cannot be opened without authentication
- `/api/challenges` returns HTTP 401 while logged out

Log in again with the account you created.

Expected:
- Dashboard opens
- challenge is still present
- Planner and Calculator still use the same PostgreSQL data

---

# Two-laptop workflow

Each laptop has its own LOCAL PostgreSQL database.

Therefore you also have separate local user accounts on each machine.

On your second laptop:

```bash
git pull
npm install
docker compose up -d db
npm run db:push
npm run dev
```

Then register a local account there too.

For now, local development data is intentionally separate.

When the application is deployed to Hetzner:
- there will be one production PostgreSQL database
- one real account works from both laptops/browsers
- the production account/data is centralized

Do not copy Docker PostgreSQL volume files between Ubuntu and Windows.

---

# Security included in v1

- passwords are never stored in plaintext
- bcrypt cost 12
- session token generated from 32 random bytes
- raw session token is only in an HTTP-only cookie
- PostgreSQL stores only SHA-256 session token hashes
- SameSite=Lax
- Secure cookie automatically enabled in production
- challenge queries remain scoped by `user_id`

# Deliberately deferred before public production

- email verification
- forgot/reset password
- login rate limiting
- session/device management
- OAuth/Google login
- CSRF hardening review for any future cross-site integrations
- clean Drizzle production migration baseline
- production secrets/domain/HTTPS deployment

These should be completed before opening registration publicly.

---

# After this passes

Authentication v1 is complete.

The next application module should be the **Trade Journal**, because challenges, calculations and user ownership are now all on the persistent backend.
