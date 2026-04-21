# Task: issue-12-remove-qa-score

## Goal
- Remove the QA score from the public frontend surfaces for GitHub issue #12.

## Done
- Read `AGENTS.md` and `docs/context.md`.
- Fetched GitHub issue #12 and confirmed it is open and assigned to `earningsites-net`.
- Updated local `main` to `origin/main` (`fbf24fc`) and created branch `codex/issue-12-remove-qa-score`.
- Refreshed GitHub CLI auth for project access and confirmed issue #12 is in `Autoblog Kanban` with status `In progress`.
- Removed the public QA score rendering from article cards and article detail headers.
- Verified no `article.qaScore` UI references remain under `apps/web/src`.
- Ran `npm --workspace @autoblog/web run typecheck`.
- Ran `npm --workspace @autoblog/web run build`; Next prerendered listing and article routes successfully.
- Checked generated web build assets for visible `QA {}` / `QA 90`-style strings; none found.
- Committed and pushed branch `codex/issue-12-remove-qa-score`.
- Opened draft PR #18: `https://github.com/earningsites-net/autoblog/pull/18`.
- Moved issue #12 project status to `Done`; GitHub now reports the issue state as `CLOSED`.

## Decisions
- Use `issue-12-remove-qa-score` as the thread-local task file for the user-provided `TASK: #12 - Rimuovere il QA score dal frontend pubblico`.
- Keep `qaScore` in the data model and repository projection because workflows, Studio, and internal/debug surfaces still use it.
- Limit the public frontend change to removing visible markup and adjacent separators, preserving date/read-time metadata.

## Next
- Review and merge PR #18 when ready.

## Risks
- Public frontend no longer renders QA score, but the field remains available in Sanity/front-end data objects for internal uses.
