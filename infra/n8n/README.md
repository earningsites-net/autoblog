# n8n Infrastructure (MVP)

This folder contains a low-cost self-hosted n8n + PostgreSQL setup and workflow templates for the AI autopublishing pipeline.

## Components
- `docker-compose.yml`: n8n + Postgres stack
- `.env.example`: deployment environment variables
- `workflows/*.json`: importable workflow templates (adapt credentials and node config)
- `workflows/plan_generation_scheduler_worker.json`: piano-based scheduling (3/20/60) + topic auto-refill trigger

## Workflow Import Automation
- Esegui da root repo:
  - `npm run n8n:import:changed` per validare/importare solo i workflow cambiati.
  - `npm run n8n:test:flows` per aggiungere anche smoke test sui workflow cambiati.
- Lo script usato dai comandi è `skills/n8n-flow-guard/scripts/check_n8n_flows.mjs`.
- Report ultimo run: `docs/ops/n8n-flow-checks/latest-report.json` (storico in `docs/ops/n8n-flow-checks/history/`).

## Article Slug Uniqueness
- Il workflow `article_generation_worker` normalizza lo slug articolo con suffisso univoco (`timestamp+random`) per evitare collisioni su Sanity (`slug is already in use`).

## Deployment Notes
- Host on a single VPS with Docker + Compose.
- Current production baseline: `IONOS VPS` (`4 vCore`, `8 GB RAM`, `>=120 GB NVMe`).
- `Hetzner` remains a valid fallback option if pricing or contract terms change.
- Put n8n behind HTTPS reverse proxy before production.
- Keep `5678` loopback-only and expose n8n only through `nginx`.
- Restrict the editor URL and use strong `N8N_ENCRYPTION_KEY`.
- Set API credentials for LLM/image providers in `.env`.
- Set Sanity credentials per-site in `sites/<slug>/.env.generated` (resolved at runtime via engine API).

## Plan Scheduler Notes
- `plan_generation_scheduler_worker` legge quota/piano da `apps/engine` (`/api/internal/sites/:siteSlug/entitlement`).
- In test mode usa intervalli rapidi per piano (`PLAN_TEST_INTERVAL_MINUTES_*`).
- In run mode standard usa quota mensile + cap giornalieri.
- Se non ci sono `topicCandidate` `brief_ready`, attiva refill automatico via `POST /api/factory/site/discover-topics` con:
  - `source=suggest`
  - `status=brief_ready`
  - `replace=true`
  - `apply=true`

## Strict Per-Site Sanity Mode
- `n8n` non usa più `SANITY_PROJECT_ID/READ/WRITE` globali.
- Ogni workflow risolve la connessione Sanity per-run via:
  - `GET /api/internal/sites/:siteSlug/sanity-connection` (engine interno)
- Requisiti:
  - `CONTENT_ENGINE_URL` configurato
  - `INTERNAL_API_TOKEN` uguale tra engine e n8n
  - `sites/<slug>/.env.generated` con `SANITY_PROJECT_ID`, `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`

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
