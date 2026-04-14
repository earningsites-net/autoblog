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

## Task Naming
- Use short `kebab-case` ids (example: `fix-webhook-timeout`).
- Reuse the same task id across threads until that activity is complete.
- For concurrent work, start each new thread with `TASK: <task-id>`.
