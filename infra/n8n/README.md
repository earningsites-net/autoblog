# n8n Infrastructure (MVP)

This folder contains a low-cost self-hosted n8n + PostgreSQL setup and workflow templates for the AI autopublishing pipeline.

## Components
- `docker-compose.yml`: n8n + Postgres stack
- `.env.example`: deployment environment variables
- `workflows/*.json`: importable workflow templates (adapt credentials and node config)
- `workflows/plan_generation_scheduler_worker.json`: piano-based scheduling (3/20/60) + topic auto-refill trigger

## Deployment Notes
- Host on a low-cost VPS (Hetzner/Contabo class) with Docker + Compose.
- Put n8n behind HTTPS reverse proxy before production.
- Restrict the editor URL and use strong `N8N_ENCRYPTION_KEY`.
- Set API credentials for LLM/image providers and Sanity tokens in `.env`.

## Plan Scheduler Notes
- `plan_generation_scheduler_worker` legge quota/piano da `apps/engine` (`/api/internal/sites/:siteSlug/entitlement`).
- In test mode usa intervalli rapidi per piano (`PLAN_TEST_INTERVAL_MINUTES_*`).
- In run mode standard usa quota mensile + cap giornalieri.
- Se non ci sono `topicCandidate` `brief_ready`, attiva refill automatico via `POST /api/factory/site/discover-topics` con:
  - `source=suggest`
  - `status=brief_ready`
  - `replace=true`
  - `apply=true`

## Important Env
- Scheduler:
  - `PLAN_SCHEDULER_TICK_MINUTES`
  - `PLAN_SCHEDULER_MAX_RUNS_PER_TICK`
  - `PLAN_SCHEDULER_DAILY_CAP_BASE|STANDARD|PRO`
  - `PLAN_SCHEDULER_TEST_MODE`
  - `PLAN_TEST_INTERVAL_MINUTES_BASE|STANDARD|PRO`
  - `PLAN_TOPIC_REFILL_INTERVAL_MINUTES`
  - `PLAN_TOPIC_REFILL_COUNT`
- Worker batch size:
  - `ARTICLE_BATCH_SIZE`
  - `IMAGE_BATCH_SIZE`
  - `QA_BATCH_SIZE`
