# Password recovery

Status: PR #57 merged (`84325daba8c6d614d60d9a863a296717d9fcde42`); user approved visuals, CI #408 passed. Resend domain `ffz.app` is verified and SMTP configuration is saved on the server per user confirmation. Deployment, migration and real email delivery verification remain pending.

## Behavior

- Login links to `/forgot-password`.
- Requests always return the same account-neutral confirmation, before account lookup or email delivery.
- SMTP sends a one-time link valid for 30 minutes. New requests for an account are limited to one per five minutes in PostgreSQL; IP limits also apply in the application process.
- The token is carried in the URL fragment, not a query string, to keep it out of HTTP access logs. It is removed from the address bar after a successful reset. Do not share reset links.
- PostgreSQL stores only the SHA-256 token digest, with one current token per user. A new token replaces the previous one after cooldown.
- Password update, token consumption and removal of the user's existing sessions share a transaction. Other accounts are unaffected. The user then signs in normally.
- GET requests never consume tokens. New passwords use the existing bcrypt cost and enforce its 72-byte limit.
- SMTP failures are logged with a generic operational message, without recipient, token, password or provider response. A failed token is removed so a later request can retry.
- Delivery runs in Next.js `after` on the existing long-running Node/Docker deployment. This is not a durable mail queue: a process restart can interrupt delivery; the user may retry after the five-minute cooldown.

## Server configuration

Add these to `.env.production` directly on the server. Never commit credentials or paste them into a PR:

```env
FFZ_APP_URL=https://ffz.app
SMTP_HOST=smtp.resend.com
SMTP_PORT=2587
SMTP_USER=resend
SMTP_PASSWORD=your-smtp-password
SMTP_FROM='FFZ <noreply@ffz.app>'
```

`FFZ_APP_URL` is the exact public origin; no path, credentials, query or fragment. Production requires HTTPS. Local development permits HTTP only on localhost/loopback. The host from incoming requests is never used to build reset links.

Port 587 (or Resend port 2587) requires STARTTLS; port 465 uses implicit TLS. Certificate verification is enabled. See [Nodemailer SMTP documentation](https://nodemailer.com/smtp). Use your provider's SMTP credentials and verified sender. Docker Compose passes the new environment variables to the application.

Missing configuration returns a neutral 503 for all recovery requests, while existing login and the rest of the app keep working. No external email was sent during automated tests.

## Migration and rollout

Production migration: `drizzle-production/0006_password_reset_tokens.sql`.
Adds only `password_reset_tokens`; no existing account or trading data changes.

Local review, CI and merge are complete. Next, deploy:

```bash
cd ~/apps/FFZ
./scripts/backup-production.sh
git switch main
git pull --ff-only origin main
./scripts/deploy-production.sh
```

Deploy runs migrations and verifies that the new table exists. Never use `db:push` in production. For a local database, use the existing local schema workflow (`npm run db:push`).

## Manual verification before calling the feature live

1. Open Login -> Forgot password, verify styling and enter your own test account email.
2. Confirm receipt (also check spam), correct FFZ domain and 30-minute expiry wording.
3. Open the link; mismatched password confirmation must stay on the form with an error.
4. Save a new password; verify the old password fails and the new password signs in.
5. Verify a previously open authenticated session loses access on its next server request.
6. Reuse the same link: it must be rejected. Request another link when needed.
7. Verify an unknown email shows the same confirmation and receives no email.

Automated coverage includes token hashing, expiry, replacement, cooldown, concurrent reuse, cross-account isolation, transaction rollback on session deletion failure, delivery failure cleanup, input validation, rate limits and TLS/origin configuration. Database tests use PGlite (embedded PostgreSQL) and the committed SQL migration; no external DB or email account is needed for CI.

## Backup review

The tracked September 2 backup was inspected: application tables contain no rows, only the migration table contains a record, and the upload archive contains an empty directory. Checksums match. `/backups/` is now ignored to prevent new backups from entering Git; already tracked historical files are unchanged.
