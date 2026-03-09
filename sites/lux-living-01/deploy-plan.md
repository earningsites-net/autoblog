# Deploy Plan for Luxury Living Style (lux-living-01)

## 1. Environment preparation
- Create dedicated env files for staging and production:
  - `npm run release:pilot:init-env`
  - then fill `.env.staging`, `.env.production`, `infra/n8n/.env.staging`, `infra/n8n/.env.production`
- Ensure these values are aligned in each environment:
  - `SITE_SLUG=lux-living-01`
  - `INTERNAL_API_TOKEN` (root + n8n)
  - `REVALIDATE_SECRET` (root) == `WEB_REVALIDATE_SECRET` (n8n)
  - `PREPOPULATE_TRIGGER_URL` points to `factory-prepopulate`.

## 2. Readiness gates
- Run:
  - `npm run release:pilot:check:staging`
  - `npm run release:pilot:check:production`
  - `npm run typecheck`
  - `npm run n8n:test:flows`

## 3. Staging deployment
- Deploy web preview:
  - `vercel deploy apps/web -y`
- Deploy Studio:
  - `npm --workspace @autoblog/studio run deploy`
- Validate factory APIs:
  - `node scripts/release/factory-launch-smoke.mjs --site lux-living-01 --base-url https://staging-engine.example.com --root-env .env.staging`

## 4. Production deployment
- Deploy web production:
  - `vercel deploy apps/web --prod -y`
- Deploy engine on VPS (systemd) and n8n on VPS (docker compose), both behind HTTPS.
- Validate one-click factory flow in production:
  - `node scripts/release/factory-launch-smoke.mjs --site lux-living-01 --base-url https://engine.example.com --root-env .env.production --execute --apply-sanity --run-prepopulate`

## 5. Post go-live
- Promote registry status:
  - `node scripts/release/update-site-status.mjs --site lux-living-01 --domain-status active --automation-status active`
- Verify billing webhook:
  - `POST /api/billing/webhooks/stripe`
- Verify end-to-end publish:
  - topic -> brief -> article -> image -> qa/publish -> revalidate -> page live.

## 6. Rollback
- Rollback Vercel to previous deployment.
- Pause scheduler workflows in n8n.
- Restart previous engine release.
- If needed, mark registry as safe state:
  - `node scripts/release/update-site-status.mjs --site lux-living-01 --domain-status pending --automation-status paused`
