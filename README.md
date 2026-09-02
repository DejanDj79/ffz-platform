# FFZ Production Readiness v1.3.1 — Shared AgarViz Nginx

Adapts FFZ to the real Hetzner server where AgarViz already owns ports 80/443.

FFZ no longer starts its own Nginx or Certbot. Its Next.js app joins the
existing `agarviz_default` Docker network as `ffz-app`, while FFZ PostgreSQL
remains isolated.

Replace:
- `docker-compose.production.yml`
- `scripts/deploy-production.sh`

Add:
- `deploy/nginx-shared/ffz-bootstrap.conf`
- `deploy/nginx-shared/ffz.conf`
- `scripts/install-shared-nginx-bootstrap.sh`
- `scripts/issue-shared-certificate.sh`
- `scripts/install-shared-nginx-https.sh`
- `SHARED_NGINX_DEPLOYMENT.md`

Keep all v1.3 migration and backup files.
