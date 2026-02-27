# Site Factory (API-first, n8n optional)

This repo now includes a factory-ready scaffolding layer to create repeatable AI-content sites from per-site blueprints.

## Goals
- Reuse the same `apps/web` frontend template across niches/brands.
- Keep CMS and automation pluggable.
- Bootstrap a new site by changing blueprint/config instead of editing source code.
- Preserve clean per-site handoff artifacts.

## Core Building Blocks
- `sites/<site-slug>/site.blueprint.json`: source-of-truth config for brand, niche, categories, budget policy, provider refs.
- `apps/web`: reads site settings from blueprint + env overrides.
- `apps/engine`: Content Generation API scaffold (contract-first, runner/publisher pluggable).
- `packages/factory-sdk`: shared types/contracts/client.
- `packages/blueprints`: template blueprints (TS package scaffolding).
- `packages/publishers`: CMS publisher adapter stubs (`sanity`, `wordpress`, `directus`).
- `scripts/autoblog.mjs`: CLI for site bootstrap and repeatable setup tasks.

## Quick CLI Examples
```bash
node scripts/autoblog.mjs list-blueprints
node scripts/autoblog.mjs new my-garden-notes --blueprint home-diy-magazine --brand-name "Garden Notes"
node scripts/autoblog.mjs provision-env my-garden-notes
node scripts/autoblog.mjs init-content my-garden-notes
node scripts/autoblog.mjs seed-cms my-garden-notes
node scripts/autoblog.mjs doctor my-garden-notes
node scripts/autoblog.mjs handoff-pack my-garden-notes
```

## Engine API (scaffold)
- `POST /v1/generation/topics`
- `POST /v1/generation/brief`
- `POST /v1/generation/articles`
- `POST /v1/generation/images`
- `POST /v1/generation/qa`
- `POST /v1/publish`
- `POST /v1/pipelines/run`
- `GET /v1/jobs/:jobId`
- `GET /v1/sites/:siteSlug/health`
- `GET /v1/content/categories?siteSlug=...` (read-side stub)
- `GET /v1/content/articles?siteSlug=...` (read-side stub)

## Current State / What is stubbed
- `apps/engine` returns contract-valid stub outputs via `DirectEngineRunner`.
- `N8nWorkflowRunner` and publisher adapters are scaffolds ready to be implemented.
- Factory API provisioning endpoints exist as `501` placeholders; CLI is the active path for now.

## Recommended Evolution Path
1. Keep `Sanity + n8n` for the first POC/site.
2. Move QA/prompt/budget logic into `apps/engine`.
3. Use n8n as adapter/orchestrator only where useful.
4. Add real `SanityPublisher` implementation and `BullMQWorkflowRunner`.
5. Introduce provider API provisioning (Vercel/Cloudflare/etc.) behind CLI or `/v1/factory/*`.
