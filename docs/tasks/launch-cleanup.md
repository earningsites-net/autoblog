# Task: launch-cleanup

## Goal
- Verificare l'allineamento tra repo locale, `origin/main` e checkout Git sulla VPS di produzione prima del lancio.

## Done
- Creato task file per questo thread.
- Verificato il repo locale: `main`, `HEAD` e `origin/main` coincidono sul commit `1f5aaf2dcec26e0438a5ee7b3cfab02919e87583` dopo `git fetch origin main --prune`.
- Verificato il checkout Git sulla VPS (`/srv/auto-blog-project`): `main` e' fermo al commit `3e0ab295fba8f56ed7634d13f054a170440bcc07`, ora confermato `behind 13` rispetto a `origin/main`.
- Raccolto lo stato del working tree sulla VPS: presenti modifiche tracked, staged, unstaged e file untracked che possono bloccare `git pull`/`checkout`.
- Confrontati gli hash dei file sporchi sulla VPS con `origin/main`: la maggior parte dei file modificati sul server coincide gia' con il contenuto corrente di `origin/main`, segno di aggiornamenti manuali/copiati senza avanzare `HEAD`; divergenze locali confermate almeno in `docs/tasks/ads-management.md` e `docs/tasks/add-disclaimer-page.md`.
- Verificata la cronologia Git sulla VPS:
  - ultimo `pull --ff-only origin main` riuscito: `2026-04-09 18:13:02 +0200` su commit `3e0ab29`
  - primo segnale documentato di drift operativo: il `2026-04-09` stesso, quando il pull e' stato inizialmente bloccato da file source-safe creati direttamente nel clone (`sites/beauty-lab/*`) e spostati in backup prima del retry
  - il `2026-04-10` compaiono modifiche locali al rename `sites/beauty-lab -> sites/daily-beauty-lab`
  - il `2026-04-14` e `2026-04-15` vengono sincronizzati file direttamente nel clone VPS invece di avanzare `HEAD`, lasciando il worktree sporco ma con molti blob gia' uguali a `origin/main`
- Verificata l'accessibilita' GitHub SSH dal server: `git ls-remote origin main` funziona, quindi il blocco operativo non era la rete/SSH ma il clone sporco.
- Individuata una seconda root cause materiale: diverse directory sorgente del clone sulla VPS (`apps/engine/src`, `apps/studio/schemaTypes/objects`, `docs`, `infra/n8n/workflows`) erano finite `root:root`, probabilmente per rollout manuali eseguiti come root; questo impediva a `autoblog` di fare `git reset` o `git pull`.
- Creato backup completo dello stato sporco in `/var/lib/autoblog/backups/git-cleanup-20260415-170500` con:
  - `status`, `reflog`, patch del working tree/index, elenco untracked
  - copia dei file divergenti reali
- Corrette ownership e permessi delle sole directory sorgente necessarie al clone Git, senza toccare i dati runtime di Postgres dentro `infra/n8n/postgres`.
- Riallineato il clone VPS a `origin/main` con `git reset --hard origin/main` e `git clean -fd`; stato finale pulito con `HEAD == origin/main == 1f5aaf2dcec26e0438a5ee7b3cfab02919e87583`.
- Eseguiti smoke checks post-cleanup:
  - `https://aiblogs.earningsites.net/healthz` -> `{"ok":true,...}`
  - `http://127.0.0.1:8787/portal` -> `200`
  - `https://aiblogs.earningsites.net/portal` -> `200`
  - `systemctl is-active autoblog-engine` -> `active`
  - `systemctl is-active autoblog-n8n` -> `active`
- Verificato il path di creazione `ops/factory`:
  - per design `createSite()` scrive il blueprint source-safe in `sites/<slug>/site.blueprint.json` dentro il workspace/clone Git
  - il runtime-only (`.env.generated`, registry, handoff, seed-content`) invece puo' vivere fuori repo via `AUTOBLOG_RUNTIME_ROOT`
  - quindi la factory puo' creare una divergenza temporanea e attesa tra VPS e `main`, ma non giustifica da sola file `root:root` o rollout manuali che lasciano `HEAD` fermo e il worktree sporco
- Valutata l'utilita' di rafforzare `AGENTS.md`: utile come guardrail per agenti/Codex, ma va affiancato anche da runbook o script operativi perche' da solo non impedisce comandi manuali eseguiti sul server.
- Chiarito il motivo per cui `AGENTS.md` e' particolarmente rilevante in questo caso: commit/push e pull dalla VPS vengono spesso delegati all'agente, quindi le istruzioni nel file possono governare direttamente il flusso operativo piu' a rischio.
- Aggiornato `AGENTS.md` con una nuova sezione `Git And VPS Guardrails` che impone:
  - Git sulla VPS solo come `autoblog`
  - stop obbligatorio se il clone production e' sporco o con ownership errata
  - preferenza per `git fetch` + `git pull --ff-only origin main`
  - divieto di sync manuali nel clone come strategia standard
  - sync+commit obbligatorio del blueprint dopo create via `ops/factory`
- Verificato il nuovo sito `ai-news-blogger`:
  - il source-safe e' correttamente presente su `main` (`d3c7421`, `feat(main): Added site AI News Blogger`)
  - il clone Git production sulla VPS e' ancora fermo al commit precedente `1f5aaf2`
  - `sites/ai-news-blogger/{README.md,site.blueprint.json}` esiste ancora come directory `untracked` nel clone production, quindi il riallineamento della VPS a `main` non e' ancora stato eseguito
  - il successivo `git pull --ff-only origin main` sulla VPS fallisce con `The following untracked working tree files would be overwritten by merge`, confermando che quei file vanno prima spostati o rimossi dal clone e solo dopo assorbiti tramite Git dal commit gia' pushato
- Implementata una correzione architetturale per ridurre il problema alla radice:
  - introdotto supporto a `AUTOBLOG_SOURCE_SITES_ROOT` (alias legacy `AUTOBLOG_SITE_SOURCE_ROOT`) in engine e CLI per tenere i file source-safe dei siti fuori dal clone Git production
  - `LocalSiteRegistry`, `SiteRuntimeService` e i resolver shared ora leggono i blueprint dal source root configurato invece di assumere sempre `./sites`
  - aggiunto fallback compatibile al path legacy `./sites`, cosi i siti esistenti nel repo continuano a funzionare anche durante una migrazione graduale al source root esterno
  - `scripts/site-pull.mjs` ora rileva automaticamente sia il layout nuovo consigliato (`/var/lib/autoblog/source-sites`) sia quello legacy nel clone (`/srv/auto-blog-project/sites`)
  - aggiornata la documentazione operativa (`docs/context.md`, `docs/factory.md`, `docs/deploy/ionos-vps-ops.md`)
- Verifica tecnica della patch architetturale:
  - `npm --workspace @autoblog/engine run typecheck` -> ok
  - `node --check scripts/site-pull.mjs` -> ok
  - `node --check scripts/autoblog.mjs` -> ok

## Decisions
- Il thread usa `docs/tasks/launch-cleanup.md` come fonte di stato.
- Non eseguire cleanup distruttivo o reset sulla VPS senza conferma esplicita, perche' ci sono modifiche locali non ancora classificate come sacrificabili.
- Per questo cleanup era sicuro forzare il riallineamento solo dopo backup, perche' il diff reale del working tree contro `origin/main` toccava documentazione/task files e `.env.example`, non codice runtime live divergente.
- La strategia corretta per production deve tornare a essere `git fetch/pull --ff-only` eseguito come utente `autoblog`; niente sync manuali di file nel clone come `root`.
- La factory production resta `prod-first`: dopo un create da `/ops/factory` va sempre eseguito il sync locale del solo source-safe (`site.blueprint.json` / `README.md`) e poi commit su `main`, altrimenti il clone VPS restera' volutamente avanti rispetto a GitHub su quei file.
- Ha senso aggiungere istruzioni esplicite in `AGENTS.md` su:
  - divieto di copiare file nel clone production come `root`
  - obbligo di usare `sudo -u autoblog` per Git sulla VPS
  - obbligo di sync+commit del blueprint dopo create via Factory
  - stop immediato se il clone production non e' pulito o contiene file non `autoblog:autoblog`
- Nel tuo workflow `AGENTS.md` ha un impatto pratico alto, perche' intercetta proprio le azioni che deleghi piu' spesso all'agente: commit/push locale e riallineamento Git sulla VPS.
- Le regole Git/VPS critiche sono state promosse dentro `AGENTS.md` per trasformarle in guardrail operativi eseguibili dall'agente, non solo in note del task.
- Dopo una create via Factory seguita da pull locale e push su `main`, resta ancora un passo operativo: riallineare il clone Git della VPS, altrimenti il server resta con file untracked che bloccheranno il prossimo `pull`.
- La soluzione strutturale migliore non e' complicare la procedura di pulizia del clone, ma impedire alla Factory production di scrivere i blueprint source-safe dentro `/srv/auto-blog-project` quando il server e' configurato con un source root esterno dedicato.

## Next
- Fissare il runbook di deploy production:
- evitare qualsiasi `tar`, `cp`, `scp` o edit manuale diretto dentro `/srv/auto-blog-project` eseguito come `root`
- se serve sync mirato, eseguirlo sempre come `autoblog` e solo come eccezione documentata
- preferire sempre backup + `git fetch` + `git pull --ff-only origin main`
- Valutare se spostare fuori dal clone anche altri artefatti operativi residui per ridurre ulteriormente il rischio di drift.
- Se vuoi, aggiornare `AGENTS.md` e il runbook VPS con questi guardrail operativi per ridurre la probabilita' di nuovi disallineamenti.
- Se serve, riflettere le stesse regole anche nel runbook VPS (`docs/deploy/ionos-vps-ops.md`) o in uno script di preflight per automatizzare i controlli prima di `pull/reset`.
- Per `ai-news-blogger`, ripulire ora i file untracked sul clone VPS e portare `main` del server a `d3c7421`.
- Applicare su production l'env `AUTOBLOG_SOURCE_SITES_ROOT=/var/lib/autoblog/source-sites`, creare la directory dedicata e poi migrare gradualmente i source-safe site files dal clone legacy al nuovo root esterno.

## Risks
- Il clone Git sulla VPS e' ora pulito, ma il rischio ricompare immediatamente se si torna a deployare copiando file nel repo come `root`.
- Il backup del vecchio stato sporco resta in `/var/lib/autoblog/backups/git-cleanup-20260415-170500`; va conservato finche' non confermiamo che non serve recuperare note operative locali.
