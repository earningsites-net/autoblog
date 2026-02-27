---
name: n8n-flow-guard
description: Validate, smoke-check, and auto-import n8n workflow JSON files from infra/n8n/workflows, then generate failure/regression handoff artifacts for the agent "Crea sito blog autopopolato". Use when n8n workflows are edited, before testing a flow, or before syncing local workflow changes to a running n8n instance.
---

# N8n Flow Guard

## Overview

Validate workflow integrity, import changed flows into n8n, and create a structured handoff report only when failures or regressions appear.

## Quick Start

Run from project root:

```bash
npm run n8n:check:flows
```

Default behavior:
- Read changed JSON workflows under `infra/n8n/workflows`.
- Validate structure and n8n node connections.
- Auto-import into n8n when API credentials are configured.
- Auto-load n8n credentials from `infra/n8n/.env` and root `.env` (if present).
- Write report files in `docs/ops/n8n-flow-checks`.
- Write `latest-handoff.md` only on fail/regression.

## Workflow

1. Execute `scripts/check_n8n_flows.mjs`.
2. Read `docs/ops/n8n-flow-checks/latest-report.json`.
3. If `overallStatus` is `fail` or `regression.count > 0`, open `latest-handoff.md`.
4. Use `latest-handoff.md` to brief the agent "Crea sito blog autopopolato".
5. Fix and rerun until `overallStatus` becomes `pass` or acceptable `warn`.

## Agent Triggers

Use these mappings in chat:
- User says flow files were changed: run `npm run n8n:import:changed`.
- User asks to run flow tests: run `npm run n8n:test:flows`.
- Always return the key report metrics (`pass/warn/fail`, import result, smoke result).

## Commands

- Check changed workflows only:
```bash
node skills/n8n-flow-guard/scripts/check_n8n_flows.mjs --mode changed-only
```

- Import changed workflows (no smoke):
```bash
npm run n8n:import:changed
```

- Import + smoke test changed workflows:
```bash
npm run n8n:test:flows
```

- Check all workflows:
```bash
node skills/n8n-flow-guard/scripts/check_n8n_flows.mjs --mode all
```

- Validate only (skip remote import):
```bash
node skills/n8n-flow-guard/scripts/check_n8n_flows.mjs --mode changed-only --no-import
```

- Enable smoke checks from CLI:
```bash
node skills/n8n-flow-guard/scripts/check_n8n_flows.mjs --mode changed-only --import --smoke
```

## Required Environment for Auto-Import

Prefer API key auth:
- `N8N_API_BASE_URL`
- `N8N_API_KEY`

Fallback basic auth:
- `N8N_API_BASE_URL`
- `N8N_BASIC_AUTH_USER`
- `N8N_BASIC_AUTH_PASSWORD`

When credentials are missing, keep validation active and mark import as `skipped`.

## References

- Check logic and severity rules: `references/check-rules.md`
- Handoff contract to the blog agent: `references/agent-handoff-contract.md`
