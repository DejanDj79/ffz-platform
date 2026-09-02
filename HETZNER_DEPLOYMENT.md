# FFZ — First Hetzner Production Deployment

This guide assumes the repository has already passed the local production
preflight.

Recommended server layout:

```text
/opt/ffz
```

Only these host ports need to be public:

```text
22/tcp   SSH
80/tcp   HTTP / Let's Encrypt bootstrap
443/tcp  HTTPS
```

Never expose:

```text
3000
5432
```

The Docker Compose file does not publish either of them.

---

## 1. Before touching the server

Locally:

```bash
npm run test
./scripts/create-production-baseline.sh
```

Inspect the generated migration under:

```text
drizzle-production/
```

Then run:

```bash
FFZ_HTTP_PORT=8088 \
FFZ_HTTPS_PORT=8443 \
./scripts/production-preflight.sh
```

Expected:

```text
Production container + migration preflight PASSED.
```

Commit:

```bash
git add .
git commit -m "Prepare FFZ production deployment"
git push
```

`drizzle-production/` MUST be committed.

---

## 2. Create the server

A single Hetzner VPS with the previously planned class is sufficient for the
initial FFZ deployment.

Use a current Ubuntu LTS installation.

Create an SSH key rather than relying on password login.

---

## 3. DNS

Create the DNS record for the actual application domain:

```text
A    app.yourdomain.com    <SERVER_IPV4>
```

If you intentionally configure IPv6, add the corresponding AAAA record too.

Do not request the TLS certificate until DNS resolves to the server.

---

## 4. Firewall

At minimum allow:

```text
OpenSSH
80/tcp
443/tcp
```

No PostgreSQL firewall rule is needed.

---

## 5. Install Docker

Install Docker Engine and Docker Compose v2 using Docker's supported Ubuntu
installation method.

Verify:

```bash
docker --version
docker compose version
```

---

## 6. Put FFZ on the server

Example:

```bash
sudo mkdir -p /opt/ffz
sudo chown "$USER":"$USER" /opt/ffz

git clone <YOUR_FFZ_REPOSITORY> /opt/ffz
cd /opt/ffz
```

---

## 7. Production secrets

Create:

```bash
./scripts/create-production-env.sh \
  app.yourdomain.com \
  your-email@example.com
```

This creates:

```text
.env.production
```

with random PostgreSQL password and auth-rate-limit salt.

Never commit it.

Permissions should be:

```text
600
```

Check:

```bash
ls -l .env.production
```

---

## 8. First database migration + application start

Run:

```bash
./scripts/deploy-production.sh
```

The script:

```text
builds the images
starts private PostgreSQL
applies drizzle-production migrations
verifies all expected FFZ tables
starts Next.js
starts Nginx
waits for /api/health/ready
```

Before a certificate exists, Nginx runs in HTTP bootstrap mode.

---

## 9. Verify HTTP

From your computer:

```text
http://app.yourdomain.com
```

You should reach FFZ.

Also verify:

```text
http://app.yourdomain.com/api/health/live
```

Do not use the app for real user data until HTTPS is enabled.

---

## 10. Issue HTTPS certificate

After DNS is definitely pointing to the server:

```bash
./scripts/issue-certificate.sh
```

Nginx restarts and automatically changes to:

```text
HTTPS
HTTP -> HTTPS redirect
HSTS
```

Verify:

```text
https://app.yourdomain.com
```

and:

```text
https://app.yourdomain.com/api/health/ready
```

---

## 11. Create the first FFZ account

Register normally through the HTTPS UI.

Registration always creates:

```text
USER
```

That is intentional.

Then on the server promote only your own account:

```bash
./scripts/promote-creator.sh your-email@example.com
```

Log out and back in.

The Creator Scoreboard should now be available.

---

## 12. First backup

Immediately create a backup:

```bash
./scripts/backup-production.sh
```

It creates:

```text
backups/<UTC timestamp>/
  database.dump
  uploads.tar.gz
  manifest.txt
  SHA256SUMS
```

Test that the checksums pass:

```bash
cd backups/<timestamp>
sha256sum -c SHA256SUMS
```

A backup that has never been tested is not a complete backup strategy.

Do not test restore against the live database just to prove the script works;
use a disposable local/test deployment for restore testing.

---

## 13. Enable automatic backup + certificate renewal

Copy systemd units:

```bash
sudo cp deploy/systemd/ffz-backup.* /etc/systemd/system/
sudo cp deploy/systemd/ffz-cert-renew.* /etc/systemd/system/

sudo systemctl daemon-reload

sudo systemctl enable --now ffz-backup.timer
sudo systemctl enable --now ffz-cert-renew.timer
```

Inspect:

```bash
systemctl list-timers | grep ffz
```

Backups run daily.

Certificate renewal is checked twice daily; Certbot renews only when required.

---

## 14. Off-site backup

The included backup protects against:
- accidental application data loss
- broken deployment
- local database corruption while the server remains accessible

It does NOT protect against losing the entire VPS.

After the initial deployment, copy backups to a second system such as:
- Hetzner Storage Box
- S3-compatible object storage
- another trusted machine

Do not leave the only backup on the same VPS as production.

---

# Normal future deployment

After code changes:

```bash
cd /opt/ffz
git pull
./scripts/deploy-production.sh
```

If `src/db/schema.ts` changed, generate the migration on a development machine
FIRST:

```bash
./scripts/generate-production-migration.sh descriptive_name
```

Inspect it, test it, commit it, then deploy.

Do NOT run `drizzle-kit generate` for the first time on the production server.

Do NOT use:

```bash
db:push
```

on production.

---

# Before a risky schema deployment

Create a backup first:

```bash
./scripts/backup-production.sh
```

Then deploy.

---

# Restore — emergency only

Restore is intentionally difficult to trigger.

Example:

```bash
RESTORE_FFZ_PRODUCTION=YES \
./scripts/restore-production.sh \
  backups/20260902T120000Z
```

It:
- verifies checksums
- stops application traffic
- restores PostgreSQL
- replaces Journal screenshots
- verifies schema
- restarts FFZ

Use only with a known-good backup.

---

# Useful production commands

Status:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  ps
```

App logs:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  logs -f --tail=100 app
```

Nginx logs:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  logs -f --tail=100 nginx
```

PostgreSQL logs:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  logs --tail=100 postgres
```

Verify schema:

```bash
./scripts/verify-production-schema.sh
```

Manual migration run:

```bash
./scripts/production-migrate.sh
```

Manual backup:

```bash
./scripts/backup-production.sh
```
