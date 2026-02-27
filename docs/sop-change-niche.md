# SOP: Change Niche / Expand Topic Scope

## Goal
Retheme the content engine while preserving the same automation and UI architecture.

## Steps
1. Update category docs in Sanity (`category` records).
2. Replace seed topics in `topic_discovery_daily` workflow code node.
3. Update prompt templates in `docs/prompts/*` and the active `promptPreset` docs.
4. Update banned/risky terms in QA rules (n8n and `apps/web/src/lib/qa.ts`).
5. Update legal/disclaimer copy if the new niche has higher risk.
6. Refresh homepage/about messaging and example mock content.
7. Rebuild sitemap after the first new articles are published.

## Do Not Change (unless needed)
- `POST /api/revalidate` contract
- Article schema core fields
- Budget monitor thresholds (only tune values)
