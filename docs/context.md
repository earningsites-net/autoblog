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
- Setup details: `docs/start-local.md`

## Durable Notes
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
- Refill topic automatico:
  - quando i `topicCandidate` `brief_ready` sono vuoti, scheduler chiama `POST /api/factory/site/discover-topics`
  - parametri di default refill: `source=suggest`, `status=brief_ready`, `replace=true`, `apply=true`
- Variabili runtime rilevanti scheduler:
  - `PLAN_SCHEDULER_TEST_MODE`
  - `PLAN_TEST_INTERVAL_MINUTES_BASE|STANDARD|PRO`
  - `PLAN_TOPIC_REFILL_INTERVAL_MINUTES`
  - `PLAN_TOPIC_REFILL_COUNT`
- Batch workers controllati da env n8n:
  - `ARTICLE_BATCH_SIZE`
  - `IMAGE_BATCH_SIZE`
  - `QA_BATCH_SIZE`
