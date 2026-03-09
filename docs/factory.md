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
node scripts/autoblog.mjs theme-generate my-garden-notes --tone auto
node scripts/autoblog.mjs provision-env my-garden-notes
node scripts/autoblog.mjs init-content my-garden-notes
node scripts/autoblog.mjs seed-cms my-garden-notes
node scripts/autoblog.mjs discover-topics my-garden-notes --count 60 --source suggest --replace
node scripts/autoblog.mjs launch-site my-garden-notes --blueprint home-diy-magazine --theme-tone auto --topic-count 60 --source suggest --apply-sanity
node scripts/autoblog.mjs doctor my-garden-notes
node scripts/autoblog.mjs handoff-pack my-garden-notes
```

## Theme Engine
- Every site can get a one-time generated visual identity (`themeProfile`) from niche/category/seed signals.
- `theme-generate` writes palette, typography, recipe, and style profile directly into `sites/<slug>/site.blueprint.json`.
- Supported tones: `editorial`, `luxury`, `wellness`, `playful`, `technical` (+ `auto` detection).
- Supported recipes: `bold_magazine`, `editorial_luxury`, `warm_wellness`, `playful_kids`, `technical_minimal`.

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
- `POST /api/factory/site/create`
- `POST /api/factory/site/launch` (one-click orchestration)
- `POST /api/factory/site/seed-cms`
- `POST /api/factory/site/discover-topics`
- `POST /api/factory/site/prepopulate`
- `POST /api/factory/site/handoff-pack`
- `GET /api/factory/site/:siteSlug/status`
- `GET /ops/factory` (internal lightweight form UI)

## One-Click Factory Flow (internal)
1. Open `GET /ops/factory`.
2. Fill `siteSlug`, `brandName`, business mode, niche preset, theme options, and topic settings.
3. Optional toggles:
   - `Apply Sanity mutations`
   - `Run prepopulate`
   - `Replace topic candidates`
   - `Force overwrite existing site`
4. Click `Launch Site (One Click)` to run: create -> niche/theme -> provision -> seed -> discover -> optional prepopulate -> handoff.

## Current State / What is stubbed
- Factory API provisioning endpoints are wired to CLI-backed operations (`create/seed/discover/handoff`).
- One-click flow supports passing per-site Sanity credentials and persisting to site env/registry.
- Plan-based n8n scheduler is integrated with engine entitlements and supports topic auto-refill when queue is empty.
- Prepopulate remains webhook-driven (`PREPOPULATE_TRIGGER_URL`) and can be kept as bootstrap mode.

## Recommended Evolution Path
1. Keep `Sanity + n8n` for the first POC/site.
2. Move QA/prompt/budget logic into `apps/engine`.
3. Use n8n as adapter/orchestrator only where useful.
4. Add real `SanityPublisher` implementation and `BullMQWorkflowRunner`.
5. Introduce provider API provisioning (Vercel/Cloudflare/etc.) behind CLI or `/v1/factory/*`.
