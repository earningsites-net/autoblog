# Task: improve-user-authentication

## Goal
- Aggiungere il recupero password (forgot/reset) al portale utenti.

## Done
- Impostato task attivo a `docs/tasks/improve-user-authentication.md`.
- Aggiunta persistenza token reset password in SQLite (`password_reset_tokens`) con cleanup, scadenza e consumo monouso.
- Esteso `AuthService` con `requestPasswordReset(...)` e `resetPasswordWithToken(...)`.
- Implementate nuove API:
  - `POST /api/portal/auth/forgot-password`
  - `POST /api/portal/auth/reset-password`
- Aggiornata UI `/portal` con flusso completo:
  - richiesta reset via email
  - form reset password con token
  - supporto query param `?resetToken=...`
- Integrato invio email reset diretto via Resend (REST API) con template HTML/TXT.
- Implementata strategia delivery configurabile:
  - `PORTAL_PASSWORD_RESET_DELIVERY_MODE=auto|resend|webhook`
  - `auto`: Resend-first con fallback webhook
- Aggiunte env di configurazione in `.env.example` per TTL reset + Resend + webhook notifiche reset.
- Aggiornato `docs/context.md` con la decisione architetturale del reset password.
- Eseguito `npm --workspace @autoblog/engine run typecheck` con esito OK.
- Allineata documentazione condivisa per lavoro parallelo (`TASK:` esplicito) e persistenza runbook n8n nei file di contesto/inbox.
- Troubleshooting locale reset email: confermato che `401` su `GET /api/portal/me` all’apertura di `/portal` è atteso (utente non autenticato).
- Individuata causa probabile mancato invio locale: mittente Resend configurato con dominio placeholder/non verificato.
- Verificato DB utenti locale: l’email usata nel test deve esistere nel portale (endpoint forgot-password risponde sempre `ok` anche se utente assente).
- Verificato `.env` corrente: `PORTAL_PASSWORD_RESET_FROM` impostato a `onboarding@resend.dev`, modalità `resend`, debug attivo.
- Rimosso comportamento debug nel flusso forgot/reset (niente token/url di reset in risposta API).
- UI reset resa production-ready:
  - rimosso campo token dal form
  - reset consentito solo da link email (`?resetToken=...`)
  - dopo reset riuscito ritorno alla login (nessun auto-login).
- Rimossa env `PORTAL_PASSWORD_RESET_DEBUG` dal template `.env.example` perché non più utilizzata.

## Decisions
- Token reset salvati in DB come hash SHA-256 (mai in chiaro), con validità default 30 minuti (`PORTAL_PASSWORD_RESET_TTL_MINUTES`).
- Endpoint forgot-password restituisce sempre messaggio generico per evitare user-enumeration.
- Provider primario consigliato: Resend (`RESEND_API_KEY` + `PORTAL_PASSWORD_RESET_FROM`) per avere invio reale senza dipendenze n8n.
- Webhook mantenuto come fallback/integrazione alternativa (`PORTAL_PASSWORD_RESET_WEBHOOK_URL`).
- Flusso reset standardizzato: reset solo da link email valido, poi login esplicita con nuova password.

## Next
- Configurare account Resend (dominio mittente + API key) nell’ambiente target.
- Configurare un mittente Resend valido/verified in locale (`PORTAL_PASSWORD_RESET_FROM`) e rifare smoke test end-to-end.
- Assicurare restart del solo processo engine con env aggiornato (evitare processi stale con variabili vecchie in memoria).
- Fare smoke test end-to-end su ambiente reale (richiesta link -> ricezione -> reset -> login).
- Valutare rate-limit su forgot-password per mitigare abusi.

## Risks
- Senza Resend e senza webhook configurati non c’è consegna automatica email (resta solo flusso debug/log locale).
- Mancano limitazioni anti-abuso specifiche sul nuovo endpoint forgot-password.
- In esecuzione parallela, senza `TASK: <task-id>` esplicito il puntatore `_active.md` può far confluire update nel file task sbagliato.
