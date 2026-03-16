# Production Release Runbook (Pilot: lux-living-01)

This runbook implements the pilot release plan for `lux-living-01` with:
- web on Vercel
- Sanity as CMS
- n8n + Postgres + engine/portal/factory on one VPS
- separate staging and production environments
- private Factory UI
- Stripe live in production

Ops VPS baseline:
- `IONOS VPS` for production ops bootstrap: `docs/deploy/ionos-vps-ops.md`
- `Hetzner` fallback runbook: `docs/deploy/hetzner-vps-engine.md`

## 1) Environment Layout

Create dedicated env files:

```bash
npm run release:pilot:init-env
```

Set the site in both stages:
- `SITE_SLUG=lux-living-01`
- `NEXT_PUBLIC_SITE_SLUG=lux-living-01`
- `SANITY_STUDIO_SITE_SLUG=lux-living-01`

Hard requirements:
- `INTERNAL_API_TOKEN` must match between root env and n8n env.
- `REVALIDATE_SECRET` must match `WEB_REVALIDATE_SECRET`.
- `PREPOPULATE_TRIGGER_URL` must point to the `factory-prepopulate` webhook.
- production must include:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_BASE`
  - `STRIPE_PRICE_ID_STANDARD`
  - `STRIPE_PRICE_ID_PRO`

## 2) Readiness Gates

Run readiness checks:

```bash
npm run release:pilot:check:staging
npm run release:pilot:check:production
```

Blocking technical gates:

```bash
npm run typecheck
npm run n8n:test:flows
```

## 3) Staging Deployment

Use staging runtime env files on the staging host:
- engine reads `.env.staging`
- n8n reads `infra/n8n/.env.staging`

Deploy web preview on Vercel:

```bash
vercel deploy apps/web -y
```

Deploy Studio (staging Sanity project/dataset):

```bash
npm --workspace @autoblog/studio run deploy
```

Smoke check factory APIs (staging):

```bash
node scripts/release/factory-launch-smoke.mjs \
  --site lux-living-01 \
  --base-url https://staging-engine.example.com \
  --root-env .env.staging
```

Execute one-click launch smoke when ready:

```bash
node scripts/release/factory-launch-smoke.mjs \
  --site lux-living-01 \
  --base-url https://staging-engine.example.com \
  --root-env .env.staging \
  --execute \
  --apply-sanity \
  --run-prepopulate
```

## 4) Production Cutover

Deploy production web on Vercel:

```bash
vercel deploy apps/web --prod -y
```

Bootstrap the ops VPS following `docs/deploy/ionos-vps-ops.md`.
Deploy/verify engine on VPS (`infra/ops/systemd/autoblog-engine.service.example`).
Deploy/verify n8n stack on VPS (`infra/ops/systemd/autoblog-n8n.service.example`, Docker Compose behind HTTPS).

Run production smoke checks:

```bash
node scripts/release/factory-launch-smoke.mjs \
  --site lux-living-01 \
  --base-url https://engine.example.com \
  --root-env .env.production
```

Run production one-click launch validation:

```bash
node scripts/release/factory-launch-smoke.mjs \
  --site lux-living-01 \
  --base-url https://engine.example.com \
  --root-env .env.production \
  --execute \
  --apply-sanity \
  --run-prepopulate
```

Promote site status in registry after go-live:

```bash
node scripts/release/update-site-status.mjs \
  --site lux-living-01 \
  --domain-status active \
  --automation-status active
```

## 5) Security Controls

- Keep `/ops/factory` private (IP allowlist or private network) and keep Basic Auth enabled.
- Keep `/api/factory/*` and `/v1/factory/*` protected with `x-factory-secret`.
- Keep internal routes protected by `x-internal-token`.
- Rotate and store secrets in a vault, not in repo.

## 6) Rollback Readiness

- Web: rollback to previous Vercel deployment.
- n8n: pause scheduler workflows (`plan_generation_scheduler_worker`, `prepopulate_bulk_runner`) if incidents occur.
- Engine: restart previous known-good release on VPS.
- Registry: if rollback is prolonged, mark status back to safe state:

```bash
node scripts/release/update-site-status.mjs \
  --site lux-living-01 \
  --domain-status pending \
  --automation-status paused
```
