# Task: aggiunta-contenuti-sito-esistente

## Goal
- Documentare come aggiungere nuovi contenuti a un sito esistente senza attendere lo scheduler.

## Done
- Verificato che `prepopulate_bulk_runner` conta prima gli articoli `published` del sito e pianifica solo il delta verso `targetPublishedCount`.
- Verificato che `discover-topics` deduplica contro topic e articoli già esistenti del sito.
- Raccolta la procedura operativa per aggiungere contenuti a un sito esistente senza attendere lo scheduler.
- Verificato come il workflow immagini sceglie `IMAGE_MODEL` e da quale env locale viene letto.
- Verificata compatibilità del modello Replicate `openai/gpt-image-1.5` con il payload corrente del workflow immagini.
- Verificato che l'errore `Unauthorized` arriva dalla protezione delle route factory/engine quando mancano `x-factory-secret` o `x-internal-token`.
- Verificato che `prepopulate_bulk_runner` può essere eseguito anche da `Manual Trigger` in n8n, bypassando il controllo header del webhook, ma richiede comunque `siteSlug` disponibile nell'input o in env.
- Corretto il workflow template `image_generation_worker` per supportare `IMAGE_ASPECT_RATIO` da env e fare fallback automatico a `3:2` quando `IMAGE_MODEL=openai/gpt-image-1.5` e il ratio configurato non è supportato.
- Aggiornati gli env example e la documentazione locale per il nuovo parametro `IMAGE_ASPECT_RATIO`.
- Verificata la validità JSON del workflow aggiornato.
- Tentato import automatico del workflow aggiornato con `npm run n8n:import:changed`.
- Verificato che l'import locale fallisce per auth API n8n (`401 unauthorized` su `/api/v1/workflows`), quindi il fix è nel repo ma non ancora sincronizzato nell'istanza locale.
- Verificato che i file workflow nel repo erano già allineati e che il disallineamento era solo nell'istanza n8n locale.
- Confermato via export CLI che il workflow locale attivo `image_generation_worker` conteneva ancora il vecchio prompt hardcoded `Home & DIY article`.
- Allineati in locale 11 workflow canonici del repo importandoli nel DB n8n tramite CLI dal volume montato `infra/n8n/data`.
- Ripubblicati e riattivati i workflow che erano attivi prima del sync:
  - `article_generation_worker`
  - `brief_generation_worker`
  - `image_generation_worker`
  - `plan_generation_scheduler_worker`
  - `prepopulate_bulk_runner`
  - `qa_scoring_and_publish_worker`
  - `topic_discovery_daily`
- Riavviato il container `autoblog-n8n` per rendere effettive le versioni pubblicate.
- Verificato post-sync che `image_generation_worker` attivo non contiene più `Home & DIY` / `modern workspace scene` e usa `IMAGE_ASPECT_RATIO`.
- Verificato che i duplicati locali di `prepopulate_bulk_runner` erano già presenti prima dell'ultimo sync:
  - `8YwagurIXUK4gHYd` inattivo (`2026-02-27`)
  - `5KJ3pCbyHAOOHBAQ` inattivo (`2026-03-02`)
  - `XAbrjNOIwN89YVjK` inattivo (`2026-03-02`)
  - `IK5hWdMSdBZKr51n` attivo e aggiornato con l'ultimo sync (`2026-04-02`)
- Verificato che il file sorgente `infra/n8n/workflows/prepopulate_bulk_runner.json` non ha un `id` fisso, quindi storicamente i reimport locali hanno potuto generare duplicati.
- Verificato che il `no-op` del prepopulate è coerente con il codice: se `publishedCount >= targetPublishedCount`, il runner restituisce `noWorkNeeded=true`.

## Decisions
- Task id impostato a `aggiunta-contenuti-sito-esistente`.
- Per refill incrementale, usare `discover-topics` con `status=brief_ready` e approccio append-only (`replace: false` lato API oppure senza `--replace` lato CLI).
- Per aggiungere articoli, chiamare manualmente `/api/factory/site/prepopulate` impostando `targetPublishedCount` come totale desiderato, non come numero di articoli aggiuntivi.
- Per testare un modello immagini alternativo su Replicate, il punto di configurazione operativo è `infra/n8n/.env -> IMAGE_MODEL`; cambiare solo il root `.env` non garantisce l'effetto sui workflow n8n.
- Il cambio “solo env” è sicuro solo per modelli Replicate compatibili con l'attuale contratto del workflow (`/predictions`, input `prompt` + `aspect_ratio`, output immagine scaricabile).
- `openai/gpt-image-1.5` rispetta quel contratto minimo, quindi per questo modello specifico il cambio può essere `env-only`.
- Il workflow attuale non è predisposto a pinnare facilmente una specifica version Replicate nel valore `IMAGE_MODEL`: costruisce l'endpoint `/v1/models/<owner>/<model>/predictions`.
- Se si passa dall'engine API, bisogna inviare un header valido (`x-factory-secret` o `x-internal-token`).
- Se si esegue da UI n8n, l'autorizzazione webhook non serve, ma per lanciare tutto il runner senza modifiche è necessario che `SITE_SLUG` sia valorizzato come fallback oppure che il run riceva un payload con `siteSlug`.
- Per compatibilità multi-modello, il workflow immagini non deve più hardcodare `16:9`; il rapporto va risolto da env e adattato per modello quando necessario.
- In caso di istanza n8n locale disallineata e API import non affidabile, il percorso robusto è usare il CLI `n8n import:workflow` dentro il container, leggendo i file da `infra/n8n/data` montato come `/home/node/.n8n`.
- Per i workflow senza `id` fisso nei file sorgente, l'allineamento locale va fatto assegnando esplicitamente l'ID canonico locale prima dell'import, altrimenti si rischiano nuovi duplicati.
- L'ultimo sync locale non ha creato un nuovo duplicato di `prepopulate_bulk_runner`; ha aggiornato in-place l'ID attivo `IK5hWdMSdBZKr51n`.
- Per aggiungere nuovi articoli via prepopulate, il `targetPublishedCount` deve essere maggiore del numero di articoli già `published`; se il sito è a `12`, un target `12` produce legittimamente `Target already reached`.

## Next
- Se serve, trasformare questa procedura in documentazione permanente del repo.
- Se serve, adattare `image_generation_worker` a uno specifico modello alternativo con schema input/output diverso da Flux.
- Se serve, aggiungere opzioni env per parametri specifici di `gpt-image-1.5` come `quality`, `background` e `output_format`.
- Se serve, rendere il `Manual Trigger` del prepopulate più comodo aggiungendo defaults o un Set node iniziale per `siteSlug`.
- Reimportare il workflow aggiornato in n8n locale e ripetere lo smoke con `IMAGE_MODEL=openai/gpt-image-1.5`.
- In alternativa all'import API, applicare la modifica direttamente dalla UI n8n sul workflow `image_generation_worker`.
- Se serve, pulire in locale i duplicati storici inattivi dei workflow n8n per ridurre confusione operativa.
- Se serve, ripulire specificamente i tre `prepopulate_bulk_runner` inattivi legacy presenti nell'istanza locale.

## Risks
- `targetPublishedCount` non è un hard cap stretto se i worker n8n elaborano più item per ciclo; per refill molto piccoli conviene allineare i batch env dei worker.
- Nel repo il sito esistente è `glowlab-daily`; `globlab-daily` non risulta presente.
- Un modello Replicate non compatibile con l'attuale payload può fallire anche se `IMAGE_MODEL` viene aggiornato correttamente.
- Finché il workflow aggiornato non viene importato nell'istanza n8n attiva, l'esecuzione locale continuerà a usare il vecchio `16:9`.
- L'automazione `n8n:import:changed` resta bloccata finché `N8N_API_KEY` non è configurata correttamente per l'istanza locale.
- Nel DB locale n8n restano workflow storici duplicati inattivi; la chain attiva è allineata, ma la UI può ancora mostrare copie legacy accanto ai canonici.
- Finché `prepopulate_bulk_runner.json` resta senza `id` fisso nel source, future import non controllati possono ricreare lo stesso problema su istanze locali diverse.
