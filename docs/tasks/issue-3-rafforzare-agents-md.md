# Task: issue-3-rafforzare-agents-md

## Goal
- Analizzare come rafforzare `AGENTS.md` per imporre un workflow di bugfix piu rigoroso, ridurre fix superficiali e abbassare il rischio di regressioni.

## Done
- Letti `AGENTS.md` e `docs/context.md` come bootstrap del thread.
- Recuperato il contenuto della issue GitHub `#3` (`Rafforzare AGENTS.md per evitare fix superficiali e regressioni`) e confrontato con il file attuale.
- Verificato che `AGENTS.md` oggi copre bene task tracking, runtime alignment e guardrail Git/VPS, ma non impone ancora in modo esplicito un metodo di bugfix basato su diagnosi, confine della regressione, impact scan e verifica post-fix.
- Confrontati i requisiti della issue con `docs/project-kanban-drafts.md`: il perimetro e' coerente e gia formalizzato.
- Verificato che il repo locale e' su `main` con working tree pulito.
- Rilevati esempi interni di workflow solido "root cause prima del fix" in task gia riusciti (`fix-plan_generation_scheduler_worker-flow`, `fix-and-e2e-test-stripe-payments`, `ads-management`) da usare come riferimento pratico per le nuove istruzioni.
- Verificato che la issue `#3` e' aperta ma al momento non risulta assegnata; quindi i passaggi branch/kanban/PR vanno trattati come workflow operativo da applicare quando parte l'implementazione, non come stato gia soddisfatto.
- Verificato lo stato dell'autenticazione GitHub locale:
- `gh auth status` conferma account attivo `earningsites-net`
- `gh project list --owner earningsites-net` fallisce per scope mancante `read:project`, quindi la gestione del kanban non e' ancora eseguibile da questo ambiente senza refresh permessi
- Aggiornato `AGENTS.md` con due nuove sezioni operative:
- `Bugfix Workflow`, posizionata prima di `Runtime Alignment`, per imporre l'ordine `diagnosi -> boundary -> root cause -> search existing -> impact scan -> patch -> verification -> handoff`
- `GitHub Issue Workflow`, separata dal metodo tecnico, per branch/kanban/PR sulle issue assegnate
- Aggiornato `docs/context.md` per includere anche `rtr-technology` tra i progetti esterni da non contaminare nel contesto Autoblog.
- Riletto il file finale per verificare che le nuove regole restino corte, imperative e non duplicative rispetto ai guardrail Git/VPS gia presenti.
- Creato branch dedicato `codex/issue-3-rafforzare-agents-md` a partire dallo stato locale corrente per preparare commit e PR della task.

## Decisions
- Questo thread usa `docs/tasks/issue-3-rafforzare-agents-md.md` come task file, normalizzando il riferimento utente `TASK: #3 - ...` in un id `kebab-case` coerente con `AGENTS.md`.
- Prima di modificare `AGENTS.md` conviene definire una struttura corta e ad alta priorita', evitando di disperdere le regole tra sezioni esistenti o duplicare guardrail Git/VPS gia presenti.
- Le nuove regole dovrebbero imporre un ordine operativo verificabile:
- capire il problema
- delimitare la regressione
- cercare soluzioni gia esistenti
- fare impact scan
- solo dopo applicare la patch
- chiudere con verifica e spiegazione della causa
- Il blocco relativo al lifecycle GitHub issue/branch/kanban/PR va probabilmente tenuto separato dal bugfix workflow, per non confondere metodo tecnico e hygiene di delivery.
- Le istruzioni su spostamento issue nel kanban possono entrare in `AGENTS.md` come workflow atteso, ma vanno formulate senza assumere che i permessi `read:project`/`project` siano sempre gia disponibili nel terminale.
- La nuova sezione `Bugfix Workflow` va tenuta volutamente breve e in alto nel file: il valore e' imporre il sequencing corretto, non descrivere tutte le tecniche possibili di debugging.
- L'esclusione dei progetti non correlati e' piu corretta in `docs/context.md` che in `AGENTS.md`, perche' e' contesto durevole condiviso e non procedura di esecuzione.

## Next
- Creare commit, push e PR della modifica verso `main`.
- Se vuoi automatizzare davvero il passaggio di kanban richiesto dalla nuova policy, serve prima estendere i permessi GitHub locali con scope `read:project` e probabilmente `project`.
- Facoltativo: riflettere le stesse regole di diagnosi anche in eventuali runbook operativi se vuoi che valgano non solo per gli agenti ma anche per i fix manuali.

## Risks
- Se le nuove istruzioni diventano troppo lunghe o descrittive, gli agenti tenderanno a ignorarle o a seguirle in modo parziale.
- Se il workflow GitHub viene fuso male con il metodo di bugfix, il file rischia di mescolare disciplina tecnica e procedura di project management in modo poco leggibile.
- Anche con istruzioni corrette, la parte kanban puo' restare bloccata da scope GitHub mancanti; il rischio va distinto dal contenuto del file.
- La policy migliora il comportamento degli agenti futuri, ma non elimina da sola i rischi di fix manuali eseguiti fuori processo o fuori repo.
