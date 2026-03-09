# AGENTS.md

## Goal
Keep thread context small and reliable while working on `main` (no branch-based task split).

## Thread Bootstrap (always)
1. Read this file.
2. Read `docs/context.md`.
3. Read `docs/tasks/_active.md` to get the active task file path.
4. If the user message contains `TASK: <task-id>`, set active task to `docs/tasks/<task-id>.md` and update `docs/tasks/_active.md`.
5. If the active task file does not exist, create it from `docs/tasks/_template.md`.

## Task Update Policy (auto-sync)
- Treat every turn as potentially final.
- Before sending any response that includes completed work, update the active task file.
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

## Task Naming
- Use short `kebab-case` ids (example: `fix-webhook-timeout`).
- Reuse the same task id across threads until that activity is complete.

