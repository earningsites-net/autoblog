# Task: aggiunta-contenuti-sito-esistente

## Goal
- Documentare come aggiungere nuovi contenuti a un sito esistente senza attendere lo scheduler.

## Done
- Verificato che `prepopulate_bulk_runner` conta prima gli articoli `published` del sito e pianifica solo il delta verso `targetPublishedCount`.
- Verificato che `discover-topics` deduplica contro topic e articoli già esistenti del sito.
- Raccolta la procedura operativa per aggiungere contenuti a un sito esistente senza attendere lo scheduler.
- Verificato come il workflow immagini sceglie `IMAGE_MODEL` e da quale env locale viene letto.
- Verificata compatibilità del modello Replicate `openai/gpt-image-1.5` con il payload corrente del workflow immagini.

## Decisions
- Task id impostato a `aggiunta-contenuti-sito-esistente`.
- Per refill incrementale, usare `discover-topics` con `status=brief_ready` e approccio append-only (`replace: false` lato API oppure senza `--replace` lato CLI).
- Per aggiungere articoli, chiamare manualmente `/api/factory/site/prepopulate` impostando `targetPublishedCount` come totale desiderato, non come numero di articoli aggiuntivi.
- Per testare un modello immagini alternativo su Replicate, il punto di configurazione operativo è `infra/n8n/.env -> IMAGE_MODEL`; cambiare solo il root `.env` non garantisce l'effetto sui workflow n8n.
- Il cambio “solo env” è sicuro solo per modelli Replicate compatibili con l'attuale contratto del workflow (`/predictions`, input `prompt` + `aspect_ratio`, output immagine scaricabile).
- `openai/gpt-image-1.5` rispetta quel contratto minimo, quindi per questo modello specifico il cambio può essere `env-only`.
- Il workflow attuale non è predisposto a pinnare facilmente una specifica version Replicate nel valore `IMAGE_MODEL`: costruisce l'endpoint `/v1/models/<owner>/<model>/predictions`.

## Next
- Se serve, trasformare questa procedura in documentazione permanente del repo.
- Se serve, adattare `image_generation_worker` a uno specifico modello alternativo con schema input/output diverso da Flux.
- Se serve, aggiungere opzioni env per parametri specifici di `gpt-image-1.5` come `quality`, `background` e `output_format`.

## Risks
- `targetPublishedCount` non è un hard cap stretto se i worker n8n elaborano più item per ciclo; per refill molto piccoli conviene allineare i batch env dei worker.
- Nel repo il sito esistente è `glowlab-daily`; `globlab-daily` non risulta presente.
- Un modello Replicate non compatibile con l'attuale payload può fallire anche se `IMAGE_MODEL` viene aggiornato correttamente.
