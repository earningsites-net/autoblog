# Task: issue-10-1970-dates

## Goal
- Investigare e correggere le date `1 Jan 1970` su `ai-news-blogger` per la issue GitHub #10.

## Done
- Riprodotto il bug sul dominio live `https://www.ainewsblogger.com/`: diversi articoli mostravano `Jan 1, 1970`.
- Verificato Sanity production per `ai-news-blogger`:
  - 7 articoli erano `status=published` con `publishedAt` mancante.
  - I campioni rotti avevano `prepopulateBatchId` e alcuni `qaLog.decision=reject`, coerente con publish manuale di articoli rejected.
  - `daily-beauty-lab` non mostrava lo stesso pattern nel frontend.
- Riparati i 7 documenti Sanity live impostando `publishedAt` al loro `_updatedAt` pre-repair.
- Confermato post-repair che Sanity non ha piu' articoli `ai-news-blogger` `published` senza `publishedAt`.
- Invalidata la cache live via `/api/revalidate` per homepage, categorie e le 7 pagine articolo.
- Create modifiche sorgente preventive, poi rimosse su richiesta: il fix mantenuto e' solo il repair dati live.
- Verificato stato GitHub issue #10: issue aperta, senza assignee e senza `projectItems`, quindi nessun project-board item disponibile da spostare in `In Progress`/`Done`.
- Verificato anche `gh project list --owner earningsites-net`: il token attivo manca dello scope `read:project`, quindi non puo' leggere o modificare GitHub Projects via CLI finche' non viene autorizzato quello scope.
- Aperta draft PR documentale: https://github.com/earningsites-net/autoblog/pull/17
- Il connettore GitHub ha fallito la creazione PR con `403 Resource not accessible by integration`; usato fallback `gh pr create`.
- Verifiche passate:
  - `npm --workspace @autoblog/web run typecheck`
  - `npm --workspace @autoblog/studio run typecheck`
  - `npm --workspace @autoblog/web run build`

## Decisions
- Root cause classificata come data issue prodotta da publish manuale/fuori path autorevole di articoli rejected/prepopulate: il workflow QA publish imposta `publishedAt`, mentre il cambio manuale dello status non lo fa.
- Per il repair live, usare `_updatedAt` come `publishedAt` perche' rappresentava il momento della promozione manuale a `published`.
- Nessuna modifica codice mantenuta per questa task: il problema concreto e' stato risolto correggendo i documenti Sanity.
- Aprire comunque PR documentale quando richiesto esplicitamente, anche se il fix applicativo e' stato un repair dati live senza diff codice.
- L'assenza di assignee non e' il blocker per spostare un item di GitHub Projects; il blocker osservato e' la mancanza dello scope `read:project` e l'assenza di `projectItems` visibili sulla issue.

## Next
- Nessun deploy codice necessario per la correzione attuale.
- Per spostare la issue su GitHub Projects, autorizzare `gh` con scope project (`gh auth refresh -s read:project,project`) o collegare/rendere visibile l'item Project alla issue.

## Risks
- Se in futuro si pubblicano manualmente altri articoli cambiando solo `status` a `published`, bisogna valorizzare anche `publishedAt`.
- Gli articoli riparati includono contenuti che in QA erano stati rejected; la correzione sistema la data, non rivaluta la qualita' editoriale di quei pezzi.
