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

## Bugfix Workflow
- For reported bugs, diagnose first and patch second.
- Gather concrete evidence before editing:
  - reproduce the issue, or
  - inspect logs, runtime state, data, env, deploy state, or permissions until the failure mode is specific
- Classify the problem boundary before changing code: source bug, runtime/env drift, data issue, deploy mismatch, permissions/infrastructure, or external dependency behavior.
- Find the root cause before patching unless the case is truly trivial and directly proven.
- Check the regression boundary before fixing:
  - when the problem started
  - what changed recently
  - whether the behavior is new, intermittent, or pre-existing
- Search for existing code paths, helpers, configs, or features that already solve the problem before adding new logic.
- Scan adjacent flows, callers, configs, and runbooks that the change can affect before changing behavior.
- Prefer the smallest fix in the authoritative path. Do not add temporary scripts, helpers, or fallback logic unless they are clearly reusable or required for durable verification.
- Before closing the task, run the smallest meaningful verification that proves the fix and checks adjacent flows for regressions.
- In the final handoff, explain the root cause, the chosen fix, the verification performed, and any remaining risk. Do not describe only the patch.

## Runtime Alignment
- After any change to n8n workflows, runtime env, or code that affects live execution, explicitly sync every relevant environment instead of assuming the repo state is already live.
- Treat `repo source`, `local runtime`, and `production runtime` as separate states that can drift.
- For workflow changes:
  - import the changed workflow into the target n8n instance
  - publish/reactivate it if required
  - restart n8n when the platform requires it for the published version to take effect
  - verify the active workflow from the runtime side (for example by exporting the active workflow or checking execution logs), not only by reading the repo file
- For env/runtime config changes:
  - update the correct env file for each target environment
  - restart the affected service(s)
  - verify the effective runtime values from the target environment
- Before declaring a fix complete, confirm local and production alignment whenever both environments are expected to behave the same.

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

## GitHub Issue Workflow
- If working on an assigned GitHub issue, create a new branch from the current local state before editing. Use `codex/<issue-or-task-id>` unless the user asks for a different name.
- Move the issue to `In Progress` before starting implementation.
- Open a PR when the work is ready for review and move the issue to `Done` only after the PR step required by the board workflow is complete.
- If project-board access, permissions, or repository state make any of these steps unsafe or impossible, stop and report the blocker explicitly instead of silently skipping the step.

## Task Naming
- Use short `kebab-case` ids (example: `fix-webhook-timeout`).
- Reuse the same task id across threads until that activity is complete.
- For concurrent work, start each new thread with `TASK: <task-id>`.
