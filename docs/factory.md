# Site Factory (API-first, n8n optional)

This repo now includes a factory-ready scaffolding layer to create repeatable AI-content sites from per-site site blueprints.

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
- `packages/blueprints`: internal default blueprint scaffolding.
- `packages/publishers`: CMS publisher adapter stubs (`sanity`, `wordpress`, `directus`).
- `scripts/autoblog.mjs`: CLI for site bootstrap and repeatable setup tasks.

## Quick CLI Examples
```bash
node scripts/autoblog.mjs list-blueprints
node scripts/autoblog.mjs new my-garden-notes --brand-name "Garden Notes"
node scripts/autoblog.mjs theme-generate my-garden-notes --tone auto
node scripts/autoblog.mjs provision-env my-garden-notes
node scripts/autoblog.mjs init-content my-garden-notes
node scripts/autoblog.mjs seed-cms my-garden-notes
node scripts/autoblog.mjs discover-topics my-garden-notes --count 60 --source suggest --replace
node scripts/autoblog.mjs launch-site my-garden-notes --theme-tone auto --topic-count 60 --source suggest --apply-sanity
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
2. Fill `siteSlug`, `brandName`, business mode, primary niche, niche prompt, categories, seed topics, theme options, and topic settings.
3. Optional toggles:
   - `Apply Sanity mutations`
   - `Run prepopulate`
   - `Replace topic candidates`
   - `Force overwrite existing site`
4. Click `Launch Site (One Click)` to run: create -> niche/theme -> provision -> seed -> discover -> optional prepopulate -> handoff.

## Source-Safe Git Sync After Production Creation
Factory creation on the ops VPS is intentionally `prod-first`: it creates or updates `sites/<slug>/` on the server, including runtime-only files that must not be treated as Git source.

After creating a site in production, the safe workflow is:

1. Create the site from `/ops/factory`.
2. Sync only source-safe files into your local repo:

```bash
npm run site:sync:source -- /path/to/exported-or-copied/site-dir
```

Or use the pull helper to fetch both the source-safe site folder and the runtime env needed for local Studio inspection:

```bash
npm run site:pull -- <site-slug>
```

3. Review and commit only:
   - `sites/<slug>/site.blueprint.json`
   - optional `sites/<slug>/README.md`
4. Push `main`.
5. Deploy `apps/web` on Vercel for that site.

The sync command intentionally ignores runtime artifacts:

- `.env.generated`
- `seed-content/`
- `handoff/`

If `AUTOBLOG_RUNTIME_ROOT` is configured on the VPS, those runtime artifacts live outside the repo by default.

Example:

```bash
npm run site:sync:source -- sites/ai-blog-1
```

If the source directory comes directly from the VPS, copy it locally first with `scp` and then run the sync command on the copied directory.

`site:pull` is a convenience wrapper around that flow:

- copies `sites/<slug>/` from the VPS into a local temp dir
- runs `site:sync:source`
- copies `sites/<slug>/.env.generated` from the VPS runtime root
- optionally runs `site:use` to point local `.env` and `apps/studio/.env` at the pulled site

It does **not** commit or push anything. The intended flow remains:

1. pull the site locally
2. review the blueprint
3. commit only `site.blueprint.json` / `README.md`
4. keep `.env.generated` local-only

## Topic Discovery Diversity
`discover-topics` now supports a hybrid selector model:

- build a raw candidate pool from `seedTopics` + Google Suggest
- optionally ask an LLM to choose only from that candidate pool (`TOPIC_DISCOVERY_SELECTOR=auto|hybrid|llm`)
- fall back to local heuristics when no API key is available or the LLM selection fails
- canonicalize trivial query variants before dedupe
- reject near-duplicates inside the same batch
- reject near-duplicates against existing site topics/articles when Sanity is reachable
- fall back to the last local generated topic preview if Sanity is not reachable
- keep category quotas balanced when enough distinct stems exist

Selector modes:

- `auto`: use LLM only if `OPENAI_API_KEY` is available, otherwise use heuristics
- `heuristic`: never call the LLM
- `hybrid` / `llm`: force the LLM selection pass and fall back to heuristics only on failure

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
