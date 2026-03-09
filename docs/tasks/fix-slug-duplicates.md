# Task: fix-slug-duplicates

## Goal
- Evitare collisioni di slug durante la creazione automatica degli articoli in Sanity.

## Done
- Impostato task attivo a `docs/tasks/fix-slug-duplicates.md`.
- Individuato il punto di generazione slug nel workflow `infra/n8n/workflows/article_generation_worker.json` (nodo `Normalize Article Payload`).
- Aggiornata la logica slug: ora usa `buildUniqueSlug(...)` con suffisso breve `timestamp(base36)+random` e mantiene il limite massimo di 120 caratteri.
- Eseguito import workflow con comando standard repo `npm run n8n:import:changed` (esito `pass`, workflow `article_generation_worker` aggiornato).
- Aggiornata documentazione operativa per thread futuri:
  - `docs/context.md`
  - `infra/n8n/README.md`
  - `docs/start-local.md`
- Aggiornato anche `docs/tasks/inbox.md` con riepilogo fix slug + comando standard di import workflow n8n.

## Decisions
- Scelta una soluzione semplice e robusta: slug leggibile + suffisso univoco, senza query extra verso Sanity.
- Il suffisso viene aggiunto sempre per evitare errori `slug is already in use` anche con titoli identici.
- Per sincronizzare i workflow n8n usare il comando standardizzato `npm run n8n:import:changed` (non import manuale dalla UI).

## Next
- Eseguire un run pipeline completo con topic simili per verificare assenza collisioni slug end-to-end.
- Opzionale: eseguire `npm run n8n:test:flows` per avere anche smoke test workflow nel report.

## Risks
- Gli slug risultano leggermente meno "puliti" (hanno un suffisso tecnico finale).
- Se il container n8n gira su un ambiente diverso da quello locale corrente, serve import anche su quell'ambiente.
