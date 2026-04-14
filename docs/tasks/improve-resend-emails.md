# Task: improve-resend-emails

## Goal
- Migliorare la mail Resend del reset password aggiornando sender/reply-to e introducendo un template brandizzato coerente con il portal.

## Done
- Creato il task file per tracciare questo intervento.
- Aggiornati i valori `PORTAL_PASSWORD_RESET_FROM` e `PORTAL_PASSWORD_RESET_REPLY_TO` ai nuovi indirizzi `AI Blogs <noreply@earningsites.net>` / `noreply@earningsites.net` nei file env del workspace e nell'esempio versionato.
- Rifatto il template Resend del reset password in `apps/engine/src/index.ts` con branding `AI Blogs`, palette del portal, logo e footer `powered by earningsites`.
- Aggiunta una route pubblica `GET /portal/assets/brand-logo.png` per servire il logo del portal nei client email che gestiscono male i data URI.
- Eseguito `npm --workspace @autoblog/engine run typecheck` con esito positivo.
- Verificato con una probe live verso l'API Resend usando l'env locale: risposta `403 validation_error` con messaggio `The earningsites.net domain is not verified`.
- Commit locale creato (`b483e74`) e pushato su `origin/main`.
- Su production il `git pull --ff-only origin main` è stato bloccato dal clone sporco; eseguito rollout mirato del solo `apps/engine/src/index.ts` da `origin/main`, aggiornati in `/etc/autoblog/engine.env` i valori `PORTAL_PASSWORD_RESET_FROM` e `PORTAL_PASSWORD_RESET_REPLY_TO`, poi riavviato `autoblog-engine`.
- Verificato su VPS production che `apps/engine/src/index.ts` matcha il blob `origin/main` (`worktree=origin_main=6ab5529ae9d3c0ab0bfd456b0c894e26ac07df18`) e che l'engine è tornato in ascolto su `127.0.0.1:8787`.
- Eseguito smoke test production `forgot-password` verso `info@earningsites.net`; l'engine ha risposto `ok:true`, ma Resend ha rifiutato l'invio con `403 validation_error` perché `earningsites.net` non risulta verificato per la API key attuale del VPS.

## Decisions
- La mail di reset usa il branding del portal engine, non quello del sito pubblico `apps/web`.
- Se `PORTAL_PASSWORD_RESET_REPLY_TO` punta a una casella `noreply`, la mail non invita a rispondere e mostra invece un avviso che la mailbox non è monitorata.
- Per ambienti locali (`localhost` / `127.0.0.1` / `0.0.0.0`) il logo in email fa fallback al data URI; sugli ambienti remoti usa la route pubblica del portal.
- Il blocco attuale dell'invio locale non è nel codice portal ma nella configurazione Resend del dominio mittente.
- Per questo rollout production non è stato sicuro forzare un fast-forward dell'intero clone VPS; il deploy corretto è stato un update mirato del file engine e dell'env live, preservando il resto della worktree sporca.
- Il blocco reale attuale è la configurazione Resend associata alla `RESEND_API_KEY` presente in `/etc/autoblog/engine.env`, non il codice del template email.

## Next
- Allineare su production una `RESEND_API_KEY` appartenente all'account dove `earningsites.net` è realmente verificato, oppure verificare il dominio proprio su quell'account.
- Ripetere subito dopo lo smoke test E2E del reset password contro `https://aiblogs.earningsites.net/portal`.
- Se serve, rifinire copy o spacing del template dopo la prima verifica visuale.

## Risks
- Alcuni client email possono comunque bloccare immagini remote finché l'utente non consente il caricamento.
- Il clone Git del VPS production resta sporco e continuerà a impedire `git pull --ff-only` completi finché non verrà ripulito o normalizzato.
- Anche con codice ed env già allineati, l'invio resterà bloccato finché la API key production non vedrà `earningsites.net` come dominio verificato.
