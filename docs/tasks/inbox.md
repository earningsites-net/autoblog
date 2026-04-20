# Task: inbox

## Goal
- Catch-all task when no explicit `TASK: <task-id>` is provided.

## Done
- Initialized task tracking system (`AGENTS.md`, `docs/context.md`, `docs/tasks/*`).
- Switched task routing to a thread-local model for simultaneous Codex threads.
- Reduced `docs/tasks/_active.md` to a fallback default and pointed it back to `docs/tasks/inbox.md`.
- Diagnosed local Git sync issue:
  - current branch `codex/change-daily-beauty-lab-title` tracks deleted upstream `origin/codex/change-daily-beauty-lab-title`
  - `git fetch --prune origin` confirmed remote branch deletion and updated `origin/main`
  - working tree is clean; the apparent "changes" belong to a local-only commit on the stale branch, not to uncommitted files
- Restored the local-only commit back into working tree changes for inspection:
  - created backup branch `backup-context-files-3ff34de`
  - ran `git reset --mixed HEAD~1` on `codex/change-daily-beauty-lab-title`
  - tracked files from that commit now show again as local changes/untracked files
- Published the restored docs/task changes onto `main`:
  - committed selected files as `docs: add context and task notes`
  - fast-forwarded local `main` to `origin/main`
  - cherry-picked the docs commit onto `main` for direct push
- Stabilizzato pipeline end-to-end n8n (`article -> image -> qa/publish`) con publish reale su frontend.
- Introdotto scheduler piano-based (`plan_generation_scheduler_worker`) con quote mensili (`base=3`, `standard=20`, `pro=60`) e trigger periodico.
- Attivato test mode scheduler con cadenze rapide per validazione:
  - `base`: 1 articolo ogni 3 minuti
  - `standard`: 1 articolo ogni 2 minuti
  - `pro`: 1 articolo ogni 1 minuto
- Aggiunto auto-refill topic quando `brief_ready` è vuoto:
  - chiamata a `POST /api/factory/site/discover-topics`
  - `source=suggest`, `status=brief_ready`, `replace=true`, `apply=true`
- Corretto comportamento batch:
  - `ARTICLE_BATCH_SIZE`, `IMAGE_BATCH_SIZE`, `QA_BATCH_SIZE` ora passati esplicitamente al container n8n via `docker-compose`.
- Aggiornata reportistica scheduler:
  - no-op esplicito quando non c'è lavoro
  - messaggio dedicato quando parte auto-refill.
- Hardened access:
  - route Factory protette con secret (`x-factory-secret`) o token interno (`x-internal-token`)
  - webhook n8n sensibili (`plan-automation`, `factory-prepopulate`) validano `INTERNAL_API_TOKEN`
  - Factory UI richiede `Factory API secret` per chiamare le API.
  - `/ops/factory` ora protetta con HTTP Basic Auth (`FACTORY_UI_USERNAME` / `FACTORY_UI_PASSWORD`, fallback password a `FACTORY_API_SECRET`).
- Completato fix collisioni slug articolo in `article_generation_worker`:
  - generazione slug ora con suffisso univoco (`timestamp+random`) per evitare `slug is already in use`.
  - workflow importato su n8n runtime con `npm run n8n:import:changed` (report `pass`).
- Documentata automazione import workflow n8n in file persistenti:
  - `docs/context.md`
  - `infra/n8n/README.md`
  - `docs/start-local.md`
  - report standard: `docs/ops/n8n-flow-checks/latest-report.json`
- Refactor strict per-site Sanity completato:
  - aggiunto endpoint interno engine `GET /api/internal/sites/:siteSlug/sanity-connection`
  - rimosso fallback globale `SANITY_*` da `SiteRuntimeService.getSiteSanityConnection`
  - workflow n8n Sanity-aware ora risolvono connessione per-run via engine (`Resolve Site Context`)
  - `infra/n8n/docker-compose.yml` non espone più `SANITY_*` globali al container

## Decisions
- Chosen approach: auto-update active task file on each response with meaningful progress.
- Keep `AGENTS.md` concise and stable; task history stays in `docs/tasks/*`.
- Multi-thread safe rule: every concurrent thread should declare `TASK: <task-id>` and keep that task thread-local.
- `_active.md` is no longer a repo-global active task pointer; it is only a fallback for threads without explicit `TASK:`.
- For stale local branches after PR merge, prefer diagnosing with `git fetch --prune origin` before changing branch tracking or deleting anything.
- Before rewriting a local stale branch for inspection, keep a local backup ref to the original commit.
- Scheduler plan-based con `siteSlug` esplicito e senza fallback ambiguo.
- Refill topic gestito dal scheduler via API engine/factory (non via webhook n8n secondari).
- Nessuna chiamata factory costosa deve essere eseguibile senza secret/token espliciti.
- Standard operativo per sync workflow n8n: usare comando repo `npm run n8n:import:changed` (e `npm run n8n:test:flows` quando serve smoke).
- Isolamento dati Sanity tra siti: enforced by design (strict per-site credentials).

## Next
- For any new concurrent thread, start the first message with `TASK: <task-id>`.
- If needed, realign local repo by switching to `main`, fast-forwarding from `origin/main`, and deciding whether to keep/cherry-pick local commit `3ff34de`.
- Optionally delete stale local branch `codex/change-daily-beauty-lab-title` after confirming no further work is needed there.
- Validare un giro completo cambio piano `base -> standard -> pro` con verifica incremento publish nel mese.
- Portare variabili da test mode a valori produzione prima del rilascio commerciale.
- Aggiungere soglia refill opzionale (`brief_ready < N`) per evitare buchi tra publish e refill.
- Rifinire quality gate topic discovery (evitare query rumorose o troppo simili).
- Definire e salvare in modo sicuro i nuovi segreti runtime:
  - `INTERNAL_API_TOKEN` (root + n8n)
  - `FACTORY_API_SECRET` (root)
- Eseguire smoke end-to-end del fix slug con batch di topic simili (assenza collisioni in Sanity).
- Validare run scheduler su 2 siti con projectId distinti (assenza cross-write).

## Risks
- If `TASK:` is omitted for a new activity, updates will continue in `inbox.md`.
- Deleting the stale local branch without deciding what to do with commit `3ff34de` would lose unmerged local work unless it remains reachable elsewhere.
- `docs/tasks/inbox.md` is also modified by task tracking and is not part of the original restored commit payload.
- The old branch still tracks a deleted upstream (`gone`); keeping it around may cause future sync confusion until it is cleaned up.
- Se `apps/engine` non è raggiungibile, il refill automatico non rigenera topic e lo scheduler resta in no-op.
- Config test mode lasciata attiva in produzione può accelerare publish oltre il ritmo atteso.
- Gli slug sono meno “clean” per via del suffisso tecnico, ma il tradeoff evita errori bloccanti di unicità.
