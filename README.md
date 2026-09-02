# FFZ Production Readiness v1.3 — Migrations, Backups & Deployment

Production Readiness step 3 of 3.

This patch completes the initial production foundation.

It adds:

```text
clean production Drizzle migration history
migration runner
schema verification
production deploy script
PostgreSQL backup
Journal screenshot backup
checksum verification
destructive restore guard
Creator promotion helper
systemd backup timer
systemd TLS renewal timer
final Hetzner deployment guide
```

No application feature UI is changed.

No local development database is reset.

---

# Why a separate production migration directory?

FFZ was developed rapidly with `db:push`.

Rather than pretending that old experimental migration history is a clean
production history, this sprint creates:

```text
drizzle-production/
```

from the CURRENT authoritative:

```text
src/db/schema.ts
```

A fresh production database receives that baseline.

Your existing Ubuntu/Windows development databases remain untouched.

Going forward:

```text
src/db/schema.ts changes
       ↓
generate next drizzle-production migration
       ↓
inspect/test
       ↓
commit
       ↓
production migrate
```

Production must never use `db:push`.

---

# STEP 1 — Copy this patch

Copy all files over the current project.

This patch replaces:

```text
docker-compose.production.yml
scripts/production-preflight.sh
```

and adds the remaining files.

---

# STEP 2 — Generate the ONE-TIME production baseline

Run locally:

```bash
npm run test
```

Then:

```bash
./scripts/create-production-baseline.sh
```

Drizzle should create files under:

```text
drizzle-production/
```

The helper verifies that the baseline creates the main FFZ tables.

IMPORTANT:

Do not delete or regenerate this folder after it has been committed and used by
production.

It becomes the migration history.

---

# STEP 3 — Inspect it

See what Drizzle generated:

```bash
find drizzle-production -type f -maxdepth 3 -print
```

Open the generated SQL.

It should be schema creation, NOT:

```text
DROP DATABASE
DROP TABLE existing production data
```

This is an initial fresh-database baseline.

---

# STEP 4 — Run the local production preflight again

The preflight is now stronger.

It performs:

```text
Docker config
Docker build
PostgreSQL start
Drizzle migrate
schema verification
Next.js start
readiness verification
```

Run:

```bash
FFZ_HTTP_PORT=8088 \
FFZ_HTTPS_PORT=8443 \
./scripts/production-preflight.sh
```

Expected:

```text
Production container + migration preflight PASSED.
```

Because your previous v1.2 preflight volume contains only a blank PostgreSQL
database, the baseline should apply cleanly.

Do not delete your normal development PostgreSQL database.

---

# STEP 5 — Test backup

While the local production containers are running:

```bash
./scripts/backup-production.sh
```

Expected:

```text
backups/<timestamp>/
```

with:

```text
database.dump
uploads.tar.gz
manifest.txt
SHA256SUMS
```

Verify:

```bash
cd backups/<timestamp>
sha256sum -c SHA256SUMS
cd ../..
```

Do not commit `backups/`.

---

# STEP 6 — Git checkpoint

Make sure `.gitignore` includes:

```gitignore
.env.production
backups/
```

But DO NOT ignore:

```text
drizzle-production/
```

Then:

```bash
git add .
git commit -m "Complete FFZ production readiness"
git push
```

---

# STEP 7 — Hetzner

Only after the baseline preflight and backup test both succeed, follow:

```text
HETZNER_DEPLOYMENT.md
```

That is the first real deployment procedure.

---

# Future schema changes

Do NOT make another baseline.

Edit:

```text
src/db/schema.ts
```

then:

```bash
./scripts/generate-production-migration.sh add_some_feature
```

Drizzle compares the current schema snapshot to the previous migration snapshot
and generates the next migration.

Inspect it before committing.

---

# Production migration command

Normally deployment runs it automatically.

Manual:

```bash
./scripts/production-migrate.sh
```

The migration runner uses a private Docker network and the real production
`DATABASE_URL` only at runtime.

---

# Production backup

Manual:

```bash
./scripts/backup-production.sh
```

Default local retention:

```text
14 days
```

Override if needed:

```bash
FFZ_BACKUP_RETENTION_DAYS=30 \
./scripts/backup-production.sh
```

This backs up BOTH:

```text
PostgreSQL
Journal screenshots
```

---

# Restore

Restore requires explicit destructive confirmation:

```bash
RESTORE_FFZ_PRODUCTION=YES \
./scripts/restore-production.sh \
  backups/<timestamp>
```

Without that exact environment variable the script refuses to run.

---

# Important remaining production items

After the first successful public deploy, production readiness is not
"finished forever".

Later hardening can include:

```text
email verification
password reset email flow
Redis/distributed rate limiting if multiple app instances are added
off-site backup automation
external uptime monitoring
error tracking
object storage for screenshots if storage needs grow
```

None of those block the initial single-server FFZ launch.

---

# Files

Added:

```text
drizzle.production.config.ts

scripts/create-production-baseline.sh
scripts/generate-production-migration.sh
scripts/production-migrate.sh
scripts/verify-production-schema.sh
scripts/backup-production.sh
scripts/restore-production.sh
scripts/promote-creator.sh
scripts/deploy-production.sh

deploy/systemd/ffz-backup.service
deploy/systemd/ffz-backup.timer
deploy/systemd/ffz-cert-renew.service
deploy/systemd/ffz-cert-renew.timer

HETZNER_DEPLOYMENT.md
GITIGNORE_ADDITIONS.txt
```

Replaced:

```text
docker-compose.production.yml
scripts/production-preflight.sh
```
