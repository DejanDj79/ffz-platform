# FFZ on the existing AgarViz Nginx

Detected server:
- Nginx container: `agarviz-nginx-1`
- Shared Docker network: `agarviz_default`
- AgarViz config directory: `~/apps/AgarViz/deploy/nginx/conf.d`
- Certbot volumes: `agarviz_certbot_webroot`, `agarviz_letsencrypt`

Topology:

```text
Internet
   |
agarviz-nginx-1 :80/:443
   |---------------- AgarViz
   |
   +---------------- ffz-app:3000
                          |
                    FFZ PostgreSQL
                    (private network)
```

## First deploy

Recommended server directory:

```text
~/apps/FFZ
```

Create production env:

```bash
./scripts/create-production-env.sh ffz.app your-email@example.com
```

Deploy FFZ DB + app:

```bash
./scripts/deploy-production.sh
```

Confirm the shared Nginx can resolve FFZ:

```bash
docker exec agarviz-nginx-1 getent hosts ffz-app
```

Install temporary HTTP ACME config:

```bash
./scripts/install-shared-nginx-bootstrap.sh
```

Issue the certificate through the existing shared Certbot volumes:

```bash
./scripts/issue-shared-certificate.sh your-email@example.com
```

Enable full HTTPS config:

```bash
./scripts/install-shared-nginx-https.sh
```

Verify:

```bash
curl -I https://ffz.app
curl -s https://ffz.app/api/health/live
```

Cloudflare should remain DNS-only during this first deployment.

The only AgarViz-side file intentionally added is:

```text
~/apps/AgarViz/deploy/nginx/conf.d/ffz.conf
```

The FFZ deployment script never stops the existing AgarViz containers.
