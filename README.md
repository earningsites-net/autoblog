# Auto Blog Project

Monorepo MVP for an AI-autopopulated Home & DIY editorial site with:
- Next.js frontend (`apps/web`)
- Sanity Studio + schemas (`apps/studio`)
- Content Engine API scaffold (`apps/engine`)
- Factory shared packages (`packages/factory-sdk`, `packages/blueprints`, `packages/publishers`)
- n8n + Postgres infra and workflow templates (`infra/n8n`)
- Site factory CLI + per-site blueprints (`scripts/autoblog.mjs`, `sites/*`)
- Handoff and operational docs (`docs`)

## Quick Start (local)
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies (network required): `npm install`
3. Start all local services with one command: `./scripts/dev-up.sh`
4. Stop all local services: `./scripts/dev-down.sh`
5. Full step-by-step command reference: `docs/start-local.md`

## Notes
- The frontend includes a mock content fallback when Sanity credentials are not set.
- The frontend now supports a pluggable content repository (`mock`, `sanity`, `api`) via `CONTENT_REPOSITORY_DRIVER`.
- n8n workflows are provided as importable templates and reference docs; provider credentials and endpoint IDs must be configured.
- `scripts/autoblog.mjs` provides a factory CLI to bootstrap additional sites from blueprint templates.
- See `docs/factory.md` for the API-first “site factory” architecture.
- Production pilot runbook for `lux-living-01`: `docs/deploy/pilot-lux-living-01.md`.
- Bootstrap pilot env files: `npm run release:pilot:init-env`.
