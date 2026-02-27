# Check Rules

## Scope

- Default path: `infra/n8n/workflows`
- File type: `*.json`
- Mode `changed-only`: include modified/staged/untracked workflow files from git.
- Mode `all`: include every workflow JSON under the directory.

## Validation Rules

Fail when:
- JSON cannot be parsed.
- Root object is not a workflow-like object.
- `name` is missing or empty.
- `nodes` is not an array.
- `connections` is not an object.
- Node `id`, `name`, or `type` is missing.
- Duplicate node IDs are found.
- Any connection points to a missing source/target node.
- Import request to n8n fails.

Warn when:
- Duplicate node names are found.
- Node parameters still include TODO/placeholders.
- `$env.*` variables are used but not listed in `.env.example` or `infra/n8n/.env.example`.
- Import is skipped because credentials are missing.

Pass when:
- No fail rules hit.
- No warnings or skipped imports.

## Overall Status

- `fail` when any workflow result is `fail`.
- `warn` when no failures exist and at least one workflow is `warn`.
- `pass` when all workflows are `pass`.

## Regression Rule

Mark regression when:
- Previous `latest-report.json` had workflow `status=pass`, and
- Current run has `status=fail` for the same `path`.
