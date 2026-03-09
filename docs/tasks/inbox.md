# Task: inbox

## Goal
- Catch-all task when no explicit `TASK: <task-id>` is provided.

## Done
- Initialized task tracking system (`AGENTS.md`, `docs/context.md`, `docs/tasks/*`).
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

## Decisions
- Chosen approach: auto-update active task file on each response with meaningful progress.
- Keep `AGENTS.md` concise and stable; task history stays in `docs/tasks/*`.
- Scheduler plan-based con `siteSlug` esplicito e senza fallback ambiguo.
- Refill topic gestito dal scheduler via API engine/factory (non via webhook n8n secondari).

## Next
- Validare un giro completo cambio piano `base -> standard -> pro` con verifica incremento publish nel mese.
- Portare variabili da test mode a valori produzione prima del rilascio commerciale.
- Aggiungere soglia refill opzionale (`brief_ready < N`) per evitare buchi tra publish e refill.
- Rifinire quality gate topic discovery (evitare query rumorose o troppo simili).

## Risks
- If `TASK:` is omitted for a new activity, updates will continue in `inbox.md`.
- Se `apps/engine` non è raggiungibile, il refill automatico non rigenera topic e lo scheduler resta in no-op.
- Config test mode lasciata attiva in produzione può accelerare publish oltre il ritmo atteso.
