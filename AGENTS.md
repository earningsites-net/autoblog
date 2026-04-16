# AGENTS.md

## Goal
Keep thread context small and reliable while working on `main`, including simultaneous threads.

## Thread Bootstrap (always)
1. Read this file.
2. Read `docs/context.md`.
3. Resolve the task file for this thread in this order:
   - If the current user message contains `TASK: <task-id>`, use `docs/tasks/<task-id>.md`.
   - Else, if this thread already established a task earlier in its own history, keep using that same task file.
   - Else, read `docs/tasks/_active.md` as the fallback default.
4. If the selected task file does not exist, create it from `docs/tasks/_template.md`.
5. Update `docs/tasks/_active.md` only when the user explicitly asks to change the fallback/default task for threads that do not declare `TASK:`.

## Task Update Policy (auto-sync)
- Treat every turn as potentially final.
- Before sending any response that includes completed work, update the selected task file for this thread.
- For simultaneous threads, task selection is thread-local. Do not switch task files mid-thread unless the user sends a new `TASK: <task-id>`.
- Keep updates concise and structured under these sections:
  - `Done`
  - `Decisions`
  - `Next`
  - `Risks`
- Add only meaningful progress; avoid noisy rewrites.

## Context Update Policy
- Update `docs/context.md` only for durable, cross-task information:
  - architecture decisions
  - stable conventions
  - important run/deploy commands
- Do not store per-task progress in `docs/context.md`.

## Git And VPS Guardrails
- Treat `/srv/auto-blog-project` on production as a `source-only` Git clone.
- Never copy, extract, or edit source files directly into `/srv/auto-blog-project` as `root`.
- On the VPS, run Git operations for the production clone only as user `autoblog`.
- Before any `git pull` or `git reset` on the VPS, check the clone state first:
  - `git status --porcelain=v2 --branch`
  - verify source files are owned by `autoblog:autoblog`
- If the production clone is dirty, has unexpected untracked files, or has source paths not owned by `autoblog:autoblog`, stop and fix that state before any pull/reset/deploy.
- Preferred VPS update flow is:
  - `git fetch origin`
  - `git pull --ff-only origin main`
- Do not use manual `tar`/`scp`/`cp` syncs into the production clone as a normal deploy strategy. Use them only if the user explicitly asks for an emergency workaround, and record it in the task file.
- Keep runtime state out of the clone:
  - runtime envs, registry, handoff files, reports, and seed artifacts belong under `AUTOBLOG_RUNTIME_ROOT`
  - `/etc/autoblog/*.env` is runtime config, not Git source
- `ops/factory` is allowed to create/update source-safe site files on the VPS (`sites/<slug>/site.blueprint.json`, optional `README.md`), which means the VPS clone can temporarily differ from `main` after site creation.
- After any production site creation via `ops/factory`, sync the source-safe site files back locally (`site:pull` or `site:sync:source`), commit them on `main`, and only then treat local, GitHub, and VPS as aligned again.
- When the user delegates commit/push/pull tasks, prefer the safe Git path above over ad-hoc file syncs, and explicitly stop if the repo state makes that unsafe.

## Task Naming
- Use short `kebab-case` ids (example: `fix-webhook-timeout`).
- Reuse the same task id across threads until that activity is complete.
- For concurrent work, start each new thread with `TASK: <task-id>`.
