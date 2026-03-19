# Agent Handoff Contract

Use this contract when `latest-handoff.md` is generated.

## Target Agent

- Name: `Crea sito blog autopopolato`

## Trigger

Generate handoff only when:
- `overallStatus=fail`, or
- `regression.count > 0`.

## Required Sections

1. Context
2. Failed workflows
3. Requested actions
4. Regression delta

## Required Inputs

- `latest-report.json` in the configured flow-check report dir
- `latest-handoff.md` in the configured flow-check report dir

## Minimal Prompt Pattern

```text
Usa il report n8n allegato per analizzare i workflow in errore.
Priorità: ripristinare i flussi falliti/regressi, proporre patch minime, e indicare test di verifica.
Concludi con comando di retest: npm run n8n:check:flows
```
