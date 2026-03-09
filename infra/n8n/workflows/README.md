# Workflow Templates

These JSON files are n8n workflow templates matching the MVP pipeline stages.
They can also be used in adapter mode by calling the engine API (`engine_pipeline_trigger`).

## Import order (recommended)
1. `budget_monitor_and_alerts`
2. `topic_discovery_daily`
3. `brief_generation_worker`
4. `article_generation_worker`
5. `image_generation_worker`
6. `qa_scoring_and_publish_worker`
7. `publish_scheduler_worker`
8. `plan_generation_scheduler_worker`
9. `prepopulate_bulk_runner`
10. `internal_link_refresh`
11. `engine_pipeline_trigger` (optional adapter mode)

## Required setup after import
- Map credentials for AI providers and Sanity HTTP nodes.
- Map `N8N_WORKFLOW_ID_*` env vars if using `prepopulate_bulk_runner` (IDs of imported worker workflows).
- Re-import worker workflows after schema changes (`ready_to_publish`, dual-mode QA, subworkflow trigger).
- Configure `siteSettings.publishing.cadenceRules` in Sanity (required).
- Configure plan scheduler env (`PLAN_SCHEDULER_*`) if using plan-based automated generation.
- `Call Web Revalidate` is best-effort (set `Continue On Fail`, especially in local Docker + Next dev).
- Add retry and error trigger workflows if needed.
- If using the engine API as the core, configure `CONTENT_ENGINE_URL` and import `engine_pipeline_trigger`.
