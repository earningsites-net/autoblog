# Task: populate-project-kanban

## Goal
- Preparare card kanban piu dettagliate e operative per il backlog della repo Autoblog.

## Done
- Letti `AGENTS.md`, `docs/context.md` e i task/documenti gia presenti su monetization, billing, handoff, n8n, firewall e QA.
- Raccolti i riferimenti di codice e di runtime utili a rendere ogni card concreta invece che generica.
- Creato `docs/project-kanban-drafts.md` con 9 bozze di card pronte da copiare/adattare nel board.
- Registrato in `docs/context.md` il vincolo di non contaminare questo workspace Autoblog con progetti aziendali non correlati (`next`, `datahub`, `dils`).
- Verificato il remoto Git della repo corretta: `https://github.com/earningsites-net/autoblog.git`.
- Verificato che il blocco attuale all'import diretto su GitHub non e' il repo, ma il `gh` CLI locale: account attivo `dciamprone` con token `default` non piu valido.
- Rieseguiti i check GitHub fuori sandbox:
- `gh auth status` conferma login valido per account `earningsites-net`
- `gh repo view` conferma accesso al repo `earningsites-net/autoblog`
- Creata issue di test dal draft locale:
- `E2E manuale monetization su siti live`
- `https://github.com/earningsites-net/autoblog/issues/1`
- Create anche le altre 8 issue dal draft kanban locale:
- `#2` Security review completa piattaforma con workstream paralleli
- `#3` Rafforzare AGENTS.md per evitare fix superficiali e regressioni
- `#4` Resettare correttamente la quota articoli dopo handoff e nuova subscription
- `#5` Rivedere o disattivare il criterio rejected_auto degli articoli
- `#6` Rendere il prepopulate e i workflow n8n piu resilienti agli errori
- `#7` Rendere privata la UI di n8n via Tailscale mantenendo pubblici solo i webhook necessari
- `#8` Consentire l'annullamento di un downgrade pianificato dal portal
- `#9` Analizzare e rimuovere solo i workflow n8n davvero inutili
- Analizzati e creati altri 5 issue body mirati con riferimenti reali a deploy VPS, `topicCandidate`, UI pubblica, date articoli e naming `daily-beauty-lab`.
- Nuove issue create:
- `#10` Investigare le date `1 Jan 1970` su `ai-news-blogger`
- `#11` Valutare auto deploy VPS a ogni push su `main`
- `#12` Rimuovere il QA score dal frontend pubblico
- `#13` Capire perche `Daily Beauty Lab` mostra ancora il vecchio titolo nel frontend
- `#14` Analizzare supporto e priorita per topic candidates manuali

## Decisions
- Questo thread usa `docs/tasks/populate-project-kanban.md` anche se il messaggio utente ha usato `Task:` invece di `TASK:`: l'intento e il task id sono chiari.
- Le bozze complete delle card vivono in un file dedicato, non nel task file del thread, cosi restano riusabili e facili da rivedere.
- Le bozze kanban devono restare limitate al perimetro Autoblog/Earningsites e non devono assorbire contesto da repo o account esterni.

## Next
- Rivedere con l'utente priorita, eventuali split di card troppo larghe e livello di dettaglio desiderato per il board.
- Se richiesto, convertire le stesse bozze in issue body piu brevi o in checklist operative per i singoli agenti.
- Se l'utente vuole push diretto su GitHub:
- riallineare `gh auth login` per l'account corretto
- creare una issue di test nel repo `earningsites-net/autoblog`
- se il test va bene, creare le altre issue e aggiungerle al board
- Verificare se il project board GitHub dell'org aggiunge automaticamente le nuove issue del repo.
- Se non le aggiunge, richiedere scope GitHub aggiuntivo `read:project` per individuare il board corretto e `project` per aggiungere le issue da CLI.
- Se il test e' approvato dall'utente, creare le restanti issue dai draft locali.
- Se l'utente vuole anche il popolamento esplicito del board da CLI, richiedere `gh auth refresh -s read:project -s project` e poi aggiungere le issue al project corretto.
- Se l'utente vuole continuare, creare altre issue o passare al popolamento effettivo del GitHub Project con scope `project`.

## Risks
- Alcune card fanno riferimento a indizi gia presenti nel repo, ma richiederanno comunque verifica sul runtime live prima dell'implementazione.
- Le attivita su sicurezza e pulizia n8n possono allargarsi rapidamente se non vengono mantenute ben scoperte e con criteri di chiusura chiari.
- Finche' il `gh` CLI locale non viene riautenticato, non posso creare issue o popolare il board direttamente dal terminale.
- L'aggiunta esplicita al GitHub Project resta bloccata dagli scope mancanti: il token attuale ha `read:org`, `repo`, `workflow`, ma non `read:project` / `project`.
