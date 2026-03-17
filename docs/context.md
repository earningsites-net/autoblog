# Project Context

This file stores durable project context shared across tasks.

## Scope
- Monorepo MVP for an AI-autopopulated Home & DIY editorial site.
- Main parts:
  - Next.js frontend: `apps/web`
  - Sanity Studio: `apps/studio`
  - Content engine scaffold: `apps/engine`
  - Shared packages: `packages/*`
  - n8n + Postgres infra/templates: `infra/n8n`

## Working Conventions
- Task progress is tracked in `docs/tasks/<task-id>.md`.
- Active task pointer is `docs/tasks/_active.md`.
- Use `TASK: <task-id>` in the first message of a thread to switch task.

## Local Run Commands
- Install deps: `npm install`
- Start local stack: `./scripts/dev-up.sh`
- Stop local stack: `./scripts/dev-down.sh`
- Import changed n8n workflows: `npm run n8n:import:changed`
- Check + import + smoke changed n8n workflows: `npm run n8n:test:flows`
- Pilot release checks (`lux-living-01`):
  - init env files: `npm run release:pilot:init-env`
  - staging readiness: `npm run release:pilot:check:staging`
  - production readiness: `npm run release:pilot:check:production`
  - factory smoke: `npm run release:pilot:smoke:factory`
  - registry activation: `npm run release:pilot:activate`
- Setup details: `docs/start-local.md`
- Pilot deploy runbook: `docs/deploy/pilot-lux-living-01.md`
- Ops VPS runbook (IONOS): `docs/deploy/ionos-vps-ops.md`
- Fallback VPS runbook (Hetzner): `docs/deploy/hetzner-vps-engine.md`

## Durable Notes
- Tenancy model (authoritative):
  - engine is **one-to-many** and serves multiple `siteSlug`.
  - single-site mode is legacy/compatibility only and should not be used for normal ops.
  - per-site isolation boundary is `sites/<slug>/.env.generated` + registry metadata, not root env.
- Frontend supports pluggable content repository via `CONTENT_REPOSITORY_DRIVER`.
- n8n workflows are template-based and require configured credentials/endpoint ids.
- Portal cliente (engine) attivo con auth locale + SQLite (`apps/engine/data/portal.db`) e billing Stripe.
- Quota piani applicata lato backend:
  - `base=3/mese`
  - `standard=20/mese`
  - `pro=60/mese`
- Scheduler n8n piano-based:
  - workflow: `plan_generation_scheduler_worker`
  - endpoint entitlement: `GET /api/internal/sites/:siteSlug/entitlement`
  - incremento publish idempotente: `POST /api/internal/sites/:siteSlug/publish-count`
- Strict per-site Sanity runtime:
  - n8n non usa più `SANITY_PROJECT_ID/SANITY_READ_TOKEN/SANITY_WRITE_TOKEN` globali nel container.
  - ogni workflow risolve la connessione per run via `GET /api/internal/sites/:siteSlug/sanity-connection` su engine.
  - le credenziali vivono in `sites/<slug>/.env.generated`.
  - i `SANITY_*` nel root `.env` restano solo per preview locale `web/studio`.
- Env conventions for ops production:
  - do not pin `SITE_SLUG` or enable `PORTAL_SINGLE_SITE_MODE` in root engine env for normal multi-site production.
  - `NEXT_PUBLIC_PORTAL_BASE_URL` belongs to web/Vercel env; it is not required by engine runtime.
  - `ENGINE_PORT` is optional; engine defaults to `8787`.
- Scheduler multi-site:
  - endpoint interno engine: `GET /api/internal/sites/automation-targets` (auth `x-internal-token`)
  - `plan_generation_scheduler_worker` risolve i siti target da questo endpoint e non richiede più `SITE_SLUG` fisso in n8n env.
  - i siti vengono processati solo se presenti nel registry con `automationStatus=active`.
- Refill topic automatico:
  - quando i `topicCandidate` `brief_ready` sono vuoti, scheduler chiama `POST /api/factory/site/discover-topics`
  - parametri di default refill: `source=suggest`, `status=brief_ready`, `replace=true`, `apply=true`
- Variabili runtime rilevanti scheduler:
  - `PLAN_SCHEDULER_TEST_MODE`
  - `PLAN_TEST_INTERVAL_MINUTES_BASE|STANDARD|PRO`
  - `PLAN_TOPIC_REFILL_INTERVAL_MINUTES`
  - `PLAN_TOPIC_REFILL_COUNT`
- Protezione chiamate costo-sensibili:
  - Factory API richiede `x-factory-secret` (`FACTORY_API_SECRET`) oppure `x-internal-token` (`INTERNAL_API_TOKEN`).
  - Pagina `/ops/factory` protetta con HTTP Basic Auth (`FACTORY_UI_USERNAME`, `FACTORY_UI_PASSWORD`; fallback password a `FACTORY_API_SECRET`).
  - Webhook n8n `plan-automation` e `factory-prepopulate` validano `INTERNAL_API_TOKEN` prima di procedere.
- Batch workers controllati da env n8n:
  - `ARTICLE_BATCH_SIZE`
  - `IMAGE_BATCH_SIZE`
  - `QA_BATCH_SIZE`
- Current multi-site gap to remember:
  - web revalidate in n8n is still global-first via `WEB_APP_URL` + `WEB_REVALIDATE_SECRET`.
  - `publish_scheduler_worker` respects `PUBLISH_REVALIDATE_ENABLED=false`, but `qa_scoring_and_publish_worker` still has a hardcoded local revalidate URL and needs cleanup before relying on revalidate in production.
- Slug articoli n8n:
  - `article_generation_worker` usa slug con suffisso univoco (`timestamp+random`) per evitare collisioni Sanity (`slug is already in use`).
- Password reset portale:
  - token monouso con scadenza persistiti su tabella `password_reset_tokens`
  - endpoint: `POST /api/portal/auth/forgot-password` e `POST /api/portal/auth/reset-password`
  - delivery email configurabile con `PORTAL_PASSWORD_RESET_DELIVERY_MODE`:
    - `auto` (default): prova `Resend` (`RESEND_API_KEY` + `PORTAL_PASSWORD_RESET_FROM`) e fallback webhook
    - `resend`: usa solo Resend
    - `webhook`: usa solo webhook (`PORTAL_PASSWORD_RESET_WEBHOOK_URL`, secret opzionale `PORTAL_PASSWORD_RESET_WEBHOOK_SECRET`)
- Automazione import workflow n8n:
  - comando standard: `npm run n8n:import:changed`
  - script: `skills/n8n-flow-guard/scripts/check_n8n_flows.mjs`
  - report ultimo run: `docs/ops/n8n-flow-checks/latest-report.json`
  - su un VPS pulito/nuovo bootstrap, `changed-only` può restituire `Checked workflows: 0`; in quel caso usare `npm run n8n:test:flows:all` con env sourced da `/etc/autoblog/n8n.env`
  - per import/smoke via API n8n, configurare `N8N_API_KEY` (e opzionalmente `N8N_API_BASE_URL`) in `infra/n8n/.env*` o `/etc/autoblog/n8n.env`; la sola Basic Auth UI non basta in modo affidabile
- Runtime ops templates for VPS deploy:
  - systemd engine service: `infra/ops/systemd/autoblog-engine.service.example`
  - systemd n8n stack service: `infra/ops/systemd/autoblog-n8n.service.example`
  - nginx reverse proxy + private factory example: `infra/ops/nginx/engine-and-factory.conf.example`
- Provider VPS baseline per il pilot ops: `IONOS VPS`; runbook step-by-step su `docs/deploy/ionos-vps-ops.md`.
- `Hetzner Cloud` resta documentato come fallback tecnico.
- Hostname ops production correnti:
  - engine / portal / factory: `https://aiblogs.earningsites.net`
  - n8n editor / webhook: `https://n8n.earningsites.net`
- Pilot release checks read env files:
  - root: `.env.staging` / `.env.production`
  - n8n: `infra/n8n/.env.staging` / `infra/n8n/.env.production`
