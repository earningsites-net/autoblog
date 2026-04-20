# Project Kanban Drafts

Queste bozze sono pensate per essere copiate o adattate nel board della repo Autoblog. Ogni card e' scritta per dare a un coding agent un obiettivo chiaro, riferimenti iniziali e criteri di accettazione verificabili.

Usare solo contesto, credenziali e runtime del progetto Autoblog sotto account `earningsites`. Escludere esplicitamente asset o task provenienti da progetti non correlati come `next`, `datahub` o `dils`.

## 1. E2E manuale monetization su siti live

**Obiettivo**

Validare end-to-end il flusso annunci/monetization sui siti live, dal salvataggio nel portal fino al rendering pubblico reale, con test manuale guidato e bug list finale.

**Contesto**

La repo usa ora un modello provider-agnostic basato su `headHtml` e placement HTML mirati. Il portal consente di salvare snippets per `homeLead`, `homeMid`, `categoryTop`, `articleTop`, `articleSidebar` e `articleBottom`, mentre il web li rende su home, category e article pages. Prima di considerare stabile la monetization, serve una verifica reale su siti pubblici con snippet caricati manualmente.

**Scope**

- Verificare il flusso `portal -> persistence -> runtime sync -> rendering pubblico`.
- Testare almeno home, category e article su un sito live con monetization abilitata.
- Confermare che il codice `headHtml` venga iniettato nel `<head>` e che i placement compaiano negli slot giusti.
- Verificare che la disattivazione monetization rimuova l'iniezione pubblica.
- Registrare regressioni visuali, errori console, doppie iniezioni, problemi su client-side navigation e mismatch tra page source e DOM runtime.

**Deliverable attesi**

- Test matrix con siti/pagine/placement verificati.
- Screenshot o evidenze delle pagine testate.
- Elenco bug riproducibili con step, impatto e priorita.
- Nota finale su cosa e' gia ok e cosa blocca il rollout ads.

**Criteri di accettazione**

- Almeno un sito live e' testato su home, category e article.
- Ogni placement configurato compare solo nello slot previsto.
- `View Source` o evidenza equivalente conferma il `headHtml` lato server.
- Non emergono errori console o layout break introdotti dagli snippet.
- Esiste una lista finale dei bug, oppure una chiusura esplicita che il flusso e' valido.

**Riferimenti iniziali**

- `apps/engine/src/index.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/categories/[slug]/page.tsx`
- `apps/web/src/app/articles/[slug]/page.tsx`
- `docs/context.md`

## 2. Security review completa piattaforma con workstream paralleli

**Obiettivo**

Eseguire una security review approfondita della piattaforma per identificare vulnerabilita che possono compromettere stabilita, dati utenti o accessi amministrativi.

**Contesto**

Il perimetro include portal, engine, billing, database, email, endpoint interni/pubblici, n8n e hardening ops. Vista la sensibilita del tema, il lavoro va organizzato per aree di rischio e prodotto come audit vero, non come raccolta vaga di osservazioni.

**Scope**

- Analizzare autenticazione, sessioni, reset password e controllo accessi.
- Analizzare endpoint interni e pubblici, inclusi token applicativi e protezione dei webhook.
- Analizzare billing/Stripe/webhooks e possibili abusi o escalation.
- Analizzare Postgres/entitlements/site access e isolamento dati per sito.
- Analizzare invio email, segreti, env, error leakage e logging sensibile.
- Analizzare esposizione n8n, editor/admin surfaces e dipendenze infra.

**Suddivisione suggerita per sub-agent**

- Workstream 1: auth, sessioni, portal access control.
- Workstream 2: billing, Stripe, webhook handling, plan changes.
- Workstream 3: database, entitlements, handoff, data isolation.
- Workstream 4: public/internal endpoints, n8n exposure, firewall, Tailscale.
- Workstream 5: email delivery, secret handling, env, logging, operational leakage.

**Deliverable attesi**

- Report con findings ordinati per severita.
- Per ogni finding: scenario di abuso, punti del codice coinvolti, riproducibilita o motivazione forte, remediation proposta.
- Distinzione tra quick wins, fix strutturali e hardening ops.
- Se non emergono finding critici, dichiararlo esplicitamente con gap residui e aree non completamente verificate.

**Criteri di accettazione**

- Nessun finding resta nel vago: ogni punto ha evidenze e impatto.
- Il report copre almeno auth, DB, endpoints, email e n8n.
- Le remediation proposte sono coerenti con l'architettura attuale del repo.
- Il lavoro separa chiaramente codice, runtime locale e runtime production.

**Riferimenti iniziali**

- `apps/engine/src/services/auth-service.ts`
- `apps/engine/src/services/billing-service.ts`
- `apps/engine/src/services/portal-store-postgres.ts`
- `apps/engine/src/index.ts`
- `apps/web/src/app/api/revalidate/route.ts`
- `infra/n8n/workflows/*.json`
- `docs/tasks/improve-user-authentication.md`
- `docs/tasks/recurring-firewall-problems.md`

## 3. Analizzare e rimuovere solo i workflow n8n davvero inutili

**Obiettivo**

Capire quali workflow n8n non servono piu, non sono pubblicati, non hanno esecuzioni o non sono referenziati, e rimuoverli in sicurezza senza rompere il runtime.

**Contesto**

La repo contiene 11 workflow versionati. Dalle note di deploy risulta che alcuni workflow live sono attivi e altri inattivi, ma inattivo non significa automaticamente inutile: i child workflow con `Execute Workflow Trigger` possono essere chiamati da parent flow e restare inattivi come entrypoint manuali. Il task deve quindi evitare cleanup aggressivi e basarsi su inventario reale.

**Scope**

- Fare inventario tra workflow versionati nel repo e workflow presenti nell'istanza live.
- Per ogni workflow stabilire: attivo, inattivo ma usato come child, inattivo e non referenziato, orfano solo live, orfano solo repo.
- Controllare execution history, webhook exposure, scheduler usage, riferimenti da altri workflow e riferimenti in docs/env.
- Proporre una decisione per ogni workflow: keep, archive, remove, document only.
- Applicare la pulizia solo dove il rischio di regressione e' stato escluso.

**Deliverable attesi**

- Tabella inventario workflow con stato e decisione.
- Lista workflow candidati alla rimozione con motivazione.
- Eventuali rimozioni allineate tra repo, live runtime e documentazione.
- Nota finale su workflow che restano inattivi intenzionalmente.

**Criteri di accettazione**

- Ogni workflow e' classificato con evidenze.
- Nessun workflow viene rimosso se referenziato da webhook, scheduler, `Execute Workflow`, env o runbook.
- Il risultato distingue chiaramente gli "inactive ma necessari" dagli "unused veri".
- Dopo la pulizia, repo e runtime risultano coerenti.

**Riferimenti iniziali**

- `infra/n8n/workflows/*.json`
- `docs/tasks/app-deploy.md`
- `docs/ops/n8n-flow-checks/history/*.json`

## 4. Rafforzare AGENTS.md per evitare fix superficiali e regressioni

**Obiettivo**

Aggiornare `AGENTS.md` per imporre un approccio piu rigoroso ai bugfix: prima diagnosi e impact analysis, poi fix.

**Contesto**

Al momento il file contiene gia guardrail utili su task tracking, runtime alignment e Git/VPS. Manca pero una sezione forte sul metodo di lavoro quando viene segnalato un bug: ricerca root cause, controllo regressioni recenti, verifica se esiste gia una funzionalita equivalente, analisi dell'impatto su aree adiacenti e divieto implicito di "fix blind".

**Scope**

- Aggiungere una sezione dedicata al bugfix workflow.
- Rendere obbligatori:
- ricerca della root cause prima della patch, salvo casi banali e dimostrati
- controllo di regressioni recenti e boundary temporale del problema
- ricerca di codice/funzionalita gia esistenti prima di introdurre nuove soluzioni
- impact scan sulle aree collegate prima di cambiare comportamento
- divieto di introdurre script/helper temporanei se non servono davvero in modo durevole
- spiegazione finale della causa, non solo del fix
- test o verifiche minime che provino di non aver rotto altri flussi

**Deliverable attesi**

- `AGENTS.md` aggiornato con istruzioni concrete, corte e attuabili.
- Se serve, piccolo riordino del file per mantenere leggibilita e priorita delle regole.

**Criteri di accettazione**

- Le nuove regole sono operative e non slogan generici.
- Un coding agent che legge il file capisce l'ordine corretto delle attivita in un bugfix.
- Le nuove regole non duplicano inutilmente le sezioni Git/VPS gia presenti.
- Il file resta leggibile e non esplode in lunghezza inutile.

**Riferimenti iniziali**

- `AGENTS.md`
- `docs/tasks/launch-cleanup.md`

## 5. Rendere il prepopulate e i workflow n8n piu resilienti agli errori

**Obiettivo**

Ridurre i casi in cui un errore transiente o parziale interrompe completamente il flusso, soprattutto nel prepopulate, e migliorare resume/retry/recovery operativa.

**Contesto**

Le note di contesto mostrano piu failure mode gia emersi: webhook inattivi o con URL legacy, errori provider immagini, retry che riusano stato vecchio, fallimenti parziali che lasciano il dataset in stato misto, recovery troppo manuale. Il task non deve partire da zero: serve consolidare questi TODO e trasformarli in comportamento piu robusto.

**Scope**

- Analizzare `prepopulate_bulk_runner` e i worker chiamati a valle.
- Catalogare i failure mode gia noti e definire per ciascuno il comportamento desiderato.
- Introdurre retry/backoff dove ha senso e isolamento per item/batch dove possibile.
- Migliorare resume semantico: non rigenerare tutto se mancano solo immagini o publish.
- Rendere chiari i segnali operativi di recovery per l'operatore.
- Evitare che un singolo errore recuperabile blocchi l'intero lotto.

**Deliverable attesi**

- Piano di failure handling per ogni step critico.
- Patch ai workflow e, se serve, piccoli aggiustamenti engine/runtime correlati.
- Procedura di recovery documentata per i casi piu comuni.
- Verifica esplicita di allineamento tra repo, runtime locale e runtime production.

**Criteri di accettazione**

- Un singolo item fallito non interrompe inutilmente tutto il batch quando il caso e' recuperabile.
- I retry non riusano ciecamente stato stale se questo produce effetti sbagliati.
- Esiste un recovery path mirato per draft senza immagine, articoli pronti ma non pubblicati e batch interrotti.
- I workflow aggiornati vengono importati e verificati sul runtime corretto, non solo modificati nel repo.

**Riferimenti iniziali**

- `infra/n8n/workflows/prepopulate_bulk_runner.json`
- `infra/n8n/workflows/image_generation_worker.json`
- `infra/n8n/workflows/qa_scoring_and_publish_worker.json`
- `docs/tasks/add-new-content-to-existing-site.md`
- `docs/tasks/fix-and-e2e-test-stripe-payments.md`
- `docs/tasks/ads-management.md`

## 6. Rivedere o disattivare il criterio `rejected_auto` degli articoli

**Obiettivo**

Ridurre i falsi negativi nel QA automatico e impedire che articoli potenzialmente validi vengano scartati senza una gestione successiva sensata.

**Contesto**

Oggi la regola e' molto rigida: `score < 75` porta direttamente a `rejected_auto`. Il workflow QA usa un punteggio sintetico con alcune penalita hardcoded e non esiste un vero flusso di sostituzione se un articolo viene scartato. Questo puo ridurre inutilmente l'output disponibile e rendere opaco il motivo reale del reject.

**Scope**

- Verificare se il criterio attuale va corretto, ammorbidito o rimosso temporaneamente.
- Se il reject resta, introdurre reason codes piu chiari e percorso successivo esplicito.
- Valutare se un articolo borderline debba restare `draft` o andare in review invece di essere scartato.
- Valutare la generazione di un articolo sostitutivo o il requeue di un topic alternativo.
- Allineare workflow, prompt QA, schema e metriche.

**Deliverable attesi**

- Decisione esplicita: keep-and-improve, soften, replace, oppure remove for now.
- Aggiornamento coerente tra prompt QA, workflow QA e stato articoli.
- Se il reject resta, comportamento successivo definito e testabile.

**Criteri di accettazione**

- Non esistono piu reject "muti" senza motivazione leggibile.
- Un articolo rifiutato non sparisce senza un next step chiaro.
- Il numero di falsi negativi attesi si riduce rispetto alla logica attuale.
- La decisione e' coerente con l'MVP: meglio meno automazione ma piu chiarezza che automazione opaca.

**Riferimenti iniziali**

- `docs/prompts/qa-scoring-v1.md`
- `infra/n8n/workflows/qa_scoring_and_publish_worker.json`
- `apps/studio/schemaTypes/documents/article.ts`

## 7. Consentire l'annullamento di un downgrade pianificato dal portal

**Obiettivo**

Permettere all'utente di annullare un cambio piano pianificato e mantenere il piano corrente prima della fine del ciclo.

**Contesto**

La UI attuale disabilita il bottone del `currentPlan` in base al piano attivo, senza considerare il caso in cui esista un `pendingPlan`. Questo crea un dead-end UX: l'utente vede il downgrade programmato ma non puo annullarlo dal portal. Il comportamento minimo desiderato e' un'azione esplicita di cancel della modifica pianificata.

**Scope**

- Correggere la logica UI dei bottoni piano quando esiste `pendingPlan`.
- Aggiungere CTA chiara per annullare il cambio pianificato.
- Allineare portal DB, stato Stripe e messaggistica UI.
- Verificare che l'annullamento non crei doppie subscription o mismatch di piano.

**Deliverable attesi**

- UX aggiornata nel pannello Billing & Plan.
- Endpoint o logica server per cancellare la modifica pianificata.
- Smoke test per scheduled downgrade -> cancel -> stato riallineato.

**Criteri di accettazione**

- Con un downgrade pianificato, l'utente vede un'azione concreta per annullarlo.
- Dopo l'annullamento, `pendingPlan` e campi correlati vengono svuotati.
- Il piano corrente torna chiaramente nello stato "keep current".
- Portal, Stripe e quota mensile restano coerenti.

**Riferimenti iniziali**

- `apps/engine/src/index.ts`
- `apps/engine/src/services/billing-service.ts`
- `apps/engine/src/services/portal-store-postgres.ts`

## 8. Resettare correttamente la quota articoli dopo handoff e nuova subscription

**Obiettivo**

Fare in modo che, dopo il transfer di un sito e l'attivazione della subscription del nuovo owner, il contatore articoli e la finestra quota partano in modo corretto per il nuovo ciclo commerciale.

**Contesto**

Ci sono due indizi forti nel codice: `handoff-site` cambia owner e stato billing ma non resetta `publishedThisMonth`, mentre l'attivazione/aggiornamento della subscription aggiorna piano e quota ma non azzera il contatore gia consumato. Il risultato puo essere che il nuovo owner paghi una subscription piena e si ritrovi quota residua parziale.

**Scope**

- Analizzare il flusso `handoff-site`, checkout session e webhook Stripe.
- Definire la business rule corretta per reset quota e nuovo periodo.
- Correggere i punti dove il contatore viene ereditato indebitamente.
- Verificare anche il sync verso Sanity/runtime e l'effetto sul planner.

**Deliverable attesi**

- Fix del flusso di trasferimento e attivazione nuova subscription.
- Test che coprano handoff -> acquisto nuovo piano -> quota disponibile corretta.
- Nota tecnica che chiarisca se il comportamento desiderato e' reset totale o carryover esplicitamente voluto.

**Criteri di accettazione**

- Dopo transfer + nuova subscription, il nuovo owner non eredita consumo articoli del precedente ciclo.
- `publishedThisMonth`, `periodStart` e `periodEnd` riflettono il nuovo stato commerciale.
- Portal UI, scheduler e stato salvato in runtime mostrano gli stessi numeri.
- Il comportamento e' verificato con almeno un flusso reale o un test riproducibile.

**Riferimenti iniziali**

- `scripts/autoblog.mjs`
- `apps/engine/src/services/billing-service.ts`
- `apps/engine/src/services/portal-store-postgres.ts`
- `apps/engine/src/index.ts`

## 9. Rendere privata la UI di n8n via Tailscale mantenendo pubblici solo i webhook necessari

**Obiettivo**

Limitare l'accesso all'editor/UI di n8n alla rete privata Tailscale, mantenendo pero raggiungibili i webhook che devono restare pubblici per il funzionamento della piattaforma.

**Contesto**

Le note ops indicano che oggi `n8n.earningsites.net` e' pubblicamente raggiungibile e serve sia editor sia webhook. La direzione raccomandata e' restringere l'editor/admin surface e lasciare pubblici solo i path strettamente necessari. Il task richiede una scelta architetturale consapevole, non un blocco grezzo che rompa i flussi.

**Scope**

- Scegliere il modello tecnico:
- hostname separati editor/webhook
- oppure stesso hostname con regole Nginx path-based
- Allineare `WEBHOOK_URL`, `N8N_EDITOR_BASE_URL`, reverse proxy e accesso via Tailscale.
- Verificare che i trigger pubblici usati da engine e servizi esterni continuino a funzionare.
- Aggiornare runbook e procedura operativa quotidiana.

**Deliverable attesi**

- Config infra proposta e implementata.
- Verifica accesso editor solo da rete privata o tunnel autorizzato.
- Verifica reachability webhook pubblici rimasti necessari.
- Piano rollback in caso di lockout.

**Criteri di accettazione**

- L'editor/login/API admin di n8n non sono piu esposti pubblicamente.
- I webhook effettivamente necessari restano raggiungibili e testati.
- Documentazione e env sono allineati al nuovo assetto.
- Il team ha un percorso chiaro per accesso admin giornaliero via Tailscale.

**Riferimenti iniziali**

- `docs/tasks/recurring-firewall-problems.md`
- `docs/tasks/app-deploy.md`
- `infra/ops/nginx/engine-and-factory.conf.example`
- `infra/n8n/docker-compose.yml`
- `infra/n8n/README.md`
