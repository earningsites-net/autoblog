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

## Decisions
- La mail di reset usa il branding del portal engine, non quello del sito pubblico `apps/web`.
- Se `PORTAL_PASSWORD_RESET_REPLY_TO` punta a una casella `noreply`, la mail non invita a rispondere e mostra invece un avviso che la mailbox non è monitorata.
- Per ambienti locali (`localhost` / `127.0.0.1` / `0.0.0.0`) il logo in email fa fallback al data URI; sugli ambienti remoti usa la route pubblica del portal.
- Il blocco attuale dell'invio locale non è nel codice portal ma nella configurazione Resend del dominio mittente.

## Next
- Pushare il fix e riallineare production aggiornando sia il codice engine sia i valori `PORTAL_PASSWORD_RESET_*` in `/etc/autoblog/engine.env`.
- Eseguire smoke test E2E del reset password contro `https://aiblogs.earningsites.net/portal`.
- Se serve, rifinire copy o spacing del template dopo la prima verifica visuale.

## Risks
- Alcuni client email possono comunque bloccare immagini remote finché l'utente non consente il caricamento.
- Il clone Git del VPS production è sporco e potrebbe impedire un `git pull --ff-only` completo; potrebbe servire un rollout mirato del file engine invece di un fast-forward dell'intero checkout.
