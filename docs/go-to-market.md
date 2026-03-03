# Go-To-Market (Low-Effort)

## Product Model
- Default offer: `transfer-first` (one-time sale) with optional managed add-on.
- Buyer panel: `Sanity Studio` for CRUD and publishing settings.
- No custom end-user dashboard in v1.
- Visual differentiation: `themeProfile` generated per site (palette, typography, layout recipe) to avoid clone-looking deliveries.

## Delivery Modes
- `transfer_first`: sell and transfer full ownership package.
- `managed`: keep automation in shared central infrastructure with monthly fee.

## Standard Delivery Checklist
1. `autoblog launch-site <site-slug>` to generate blueprint/env/seed/handoff assets.
2. Seed Sanity (`sanity.mutations.json`) and topic candidates (`topic-candidates.mutations.json`).
3. Run prepopulate workflow and QA smoke checks.
4. Deploy web app and attach domain.
5. Transfer credentials and docs from handoff pack.

## Theme Generation
- `autoblog theme-generate <site-slug> --tone auto` creates a deterministic one-time style profile based on niche/category signals.
- Optional override: `--theme-tone` and `--theme-recipe` in `launch-site`.

## Time/Cost Defaults
- Target setup time: 30-45 minutes per site.
- Initial publish inventory: 20-30 articles.
- Budget-aware defaults in blueprint + env keep cost under control during market test.

## Internal API + UI
- Engine exposes factory endpoints:
  - `POST /api/factory/site/create`
  - `POST /api/factory/site/launch`
  - `POST /api/factory/site/seed-cms`
  - `POST /api/factory/site/discover-topics`
  - `POST /api/factory/site/prepopulate`
  - `POST /api/factory/site/handoff-pack`
  - `GET /api/factory/site/:siteSlug/status`
- Internal lightweight form available at `GET /ops/factory`.
- The internal form now supports one-click launch with niche preset, theme profile, topic discovery config, and optional prepopulate.
