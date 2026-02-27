# Architecture Overview

## Summary
This MVP is a low-ops AI-assisted publishing system for a Home & DIY content site. It combines a premium frontend (`Next.js`), managed CMS (`Sanity`), and workflow automation (`n8n`) with budget-aware throttling.

## High-level Flow
```mermaid
flowchart LR
  A["topic_discovery_daily"] --> B["topicCandidate (Sanity)"]
  B --> C["brief_generation_worker"]
  C --> D["article_generation_worker"]
  D --> E["article draft (Sanity)"]
  E --> F["image_generation_worker"]
  F --> G["qa_scoring_and_publish_worker"]
  G --> H["published article (Sanity)"]
  G --> I["POST /api/revalidate (Next.js)"]
  H --> J["ISR pages / sitemap"]
  K["budget_monitor_and_alerts"] --> C
  K --> D
  K --> F
  K --> G
```

## Components
- `apps/web`: public website, SEO metadata, schema.org, ad placeholders, revalidate endpoint.
- `apps/studio`: CMS authoring/ops console, schema types for pipeline entities.
- `infra/n8n`: automation runtime and workflow templates.
- `docs/prompts`: prompt templates versioned outside runtime for auditability.

## Core Contracts
- n8n writes/patches `topicCandidate`, `article`, `qaLog`, `generationRun` in Sanity.
- n8n triggers frontend ISR via `POST /api/revalidate` with secret header.
- Frontend reads only `status == published` content.

## Budget Strategy
- Generate many topic candidates (`20+/day`) but publish quota is throttled to fit budget.
- Mode transitions: `normal` -> `economy` -> `throttle` -> `stop`.
