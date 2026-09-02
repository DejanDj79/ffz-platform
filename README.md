# FFZ Production Readiness v1.1 — Security & Health

This is Production Readiness step 1 of 3.

It intentionally does NOT change trading features, layouts, Journal data,
Ledger data, Challenges, Economic Calendar data or Scoreboard calculations.

## What this patch adds

### 1. Hardened session cookie

Development:

```text
ffz_session
```

Production:

```text
__Host-ffz_session
```

Production cookie remains:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

and now also has:

```text
Priority=High
Max-Age=30 days
```

Logout clears both the development and production cookie names.

### 2. Auth rate limiting

Login:

```text
30 requests / 15 min per IP
8 failed-ish account attempts / 15 min per IP + email
```

A successful login clears the account-specific bucket.

Registration:

```text
5 requests / hour per IP
```

429 responses include:

```text
Retry-After
```

This v1 limiter is deliberately in-process because the planned first production
deployment is one Next.js instance on one Hetzner server.

If FFZ later runs multiple app replicas, replace this store with Redis or a
shared database-backed limiter.

### 3. Next.js 16 Proxy page gate

Adds:

```text
src/proxy.ts
```

Protected page families include:

```text
/
Dashboard
Risk Calculator
Challenges
Journal
Ledger
Economic Calendar
Scoreboard
```

If there is no session cookie, the request is redirected server-side to:

```text
/login?next=...
```

Important:

The Proxy only improves early page gating.

Actual authentication and authorization remain inside the API/routes and
repositories. Never treat cookie presence in Proxy as the security boundary.

Public OBS routes remain public.

### 4. Security response headers

The Proxy adds:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
X-Frame-Options: SAMEORIGIN
```

Production additionally adds:

```text
Strict-Transport-Security: max-age=31536000
```

`SAMEORIGIN` is intentional: `/scoreboard` can still preview the OBS overlay in
a same-origin iframe, while third-party pages cannot frame FFZ.

A full Content-Security-Policy is deliberately deferred until the production
Nginx/domain stage because it needs to be tested against the complete Next.js
runtime and any future analytics/email integrations.

### 5. Production environment validation

Production requires:

```text
DATABASE_URL
FFZ_UPLOAD_DIR
AUTH_RATE_LIMIT_SALT
```

The validator also rejects:

```text
ffz_dev_password
```

inside the production database URL.

`FFZ_UPLOAD_DIR` must be absolute.

### 6. Health endpoints

Liveness:

```text
GET /api/health/live
```

Expected:

```json
{
  "status": "ok",
  "service": "ffz-platform"
}
```

Readiness:

```text
GET /api/health/ready
```

Checks:

```text
production environment
PostgreSQL connection
Journal screenshot storage read/write access
```

A failed readiness check returns:

```text
HTTP 503
```

This is what Docker will use later.

### 7. Journal screenshot storage readiness

`image-storage.ts` now exports:

```text
ensureImageStorageReady()
```

Production will later mount:

```text
/app/data/uploads
```

as a persistent Docker volume.

### 8. User-data isolation audit

See:

```text
SECURITY_AUDIT.md
```

The current private repositories are user-scoped.

---

# Install

Checkpoint Economic Calendar first:

```bash
git status
git add .
git commit -m "Add FFZ Economic Calendar"
git push
```

Copy this patch over:

```text
~/WaytrXGroundOps/external/ffz-platform
```

No database schema change is included in this sprint.

Run:

```bash
npm run test
npm run dev
```

No `db:push` is required.

---

# Development tests

While `npm run dev` is running:

```bash
curl -i http://localhost:3001/api/health/live
```

Use port 3000 instead if Next is running there.

Expected:

```text
HTTP 200
```

Then:

```bash
curl -i http://localhost:3001/api/health/ready
```

In development, the environment validator does not require production-only
variables.

Expected if PostgreSQL and uploads are working:

```text
HTTP 200
"status":"ready"
```

Open a private page in an Incognito window:

```text
/dashboard
```

Expected:

```text
redirect to /login?next=/dashboard
```

Then log in normally and verify:

```text
Dashboard
Challenges
Journal
Journal screenshots
Ledger
Economic Calendar
Scoreboard (creator only)
```

still behave exactly as before.

---

# Rate-limit smoke test

Do NOT intentionally lock yourself out with your real login.

The automated Vitest suite covers the limiter behavior.

A 429 looks like:

```text
Too many sign-in attempts. Try again later.
```

The limiter resets automatically after its time window.

Restarting the Next.js process also clears v1 rate-limit buckets.

---

# Production-only env values

A template is included:

```text
.env.production.example
```

Later on Hetzner we will create a real secret file, not commit it.

Generate the salt with:

```bash
openssl rand -hex 32
```

Example future values:

```text
DATABASE_URL=postgresql://ffz:<strong-password>@postgres:5432/ffz_platform
FFZ_UPLOAD_DIR=/app/data/uploads
AUTH_RATE_LIMIT_SALT=<64-random-hex-characters>
```

---

# Why no Docker/Nginx yet?

This sprint gives Docker something meaningful to check:

```text
/api/health/ready
```

and makes screenshot persistence explicit.

Production Readiness 2/3 will add:

```text
Dockerfile
docker-compose production stack
PostgreSQL private network
persistent DB volume
persistent screenshot volume
Nginx reverse proxy
HTTPS layout
production secrets layout
```

Then Production Readiness 3/3 will finalize:

```text
Drizzle migration baseline
backup/restore scripts
deployment procedure
rollback/checklist
```

---

# Git checkpoint

After testing:

```bash
git add .
git commit -m "Harden FFZ for production"
git push
```
