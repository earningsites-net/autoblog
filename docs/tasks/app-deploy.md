# Task: app-deploy

## Goal
- Rendere eseguibile il rilascio produzione del pilot `lux-living-01` (web + Sanity + n8n + engine/portal/factory) con staging/production separati e controlli operativi ripetibili.

## Done
- Impostato task attivo su `app-deploy` (`docs/tasks/_active.md`).
- Aggiunti script operativi di rilascio:
  - `scripts/release/init-env-files.sh` (bootstrap env staging/production)
  - `scripts/release/pilot-readiness.mjs` (gate configurazione staging/production)
  - `scripts/release/factory-launch-smoke.mjs` (smoke/preflight e launch one-click opzionale)
  - `scripts/release/update-site-status.mjs` (promozione stato in `sites/registry.json`)
- Aggiunti comandi npm dedicati al pilot:
  - `release:pilot:init-env`
  - `release:pilot:check:staging`
  - `release:pilot:check:production`
  - `release:pilot:smoke:factory`
  - `release:pilot:activate`
- Aggiornato `.gitignore` per evitare commit accidentali dei nuovi env di rilascio:
  - `.env.staging`, `.env.production`
  - `infra/n8n/.env.staging`, `infra/n8n/.env.production`
- Aggiunta documentazione operativa:
  - runbook completo: `docs/deploy/pilot-lux-living-01.md`
  - piano sito: `sites/lux-living-01/deploy-plan.md`
  - template infrastruttura VPS:
    - `infra/ops/systemd/autoblog-engine.service.example`
    - `infra/ops/nginx/engine-and-factory.conf.example`
- Aggiornato contesto durevole (`docs/context.md`) e README con riferimenti al nuovo runbook.
- Verifiche eseguite:
  - `node --check` su tutti i nuovi script release
  - `npm run typecheck` OK
  - readiness/smoke script eseguiti in dry-run locale con output coerente (fallimenti attesi su env non allineato/servizi non up)
- Preparato avvio guidato step-by-step per rilascio, includendo la fase iniziale di account setup (Vercel, Sanity, Stripe, VPS/DNS) con riferimenti ufficiali aggiornati.

## Decisions
- Pilot operativo fissato su `lux-living-01`.
- Il rilascio viene codificato in runbook + script CLI ripetibili (non in passaggi manuali ad-hoc).
- La promozione stato sito (`domainStatus`, `automationStatus`) resta azione esplicita post go-live, non automatica.
- Factory smoke supporta modalità preflight sicura (default) e modalità `--execute` per validazione reale del one-click launch.

## Next
- Popolare `.env.staging`, `.env.production`, `infra/n8n/.env.staging`, `infra/n8n/.env.production` con segreti reali e domini.
- Eseguire gate completi:
  - `npm run release:pilot:check:staging`
  - `npm run release:pilot:check:production`
  - `npm run n8n:test:flows`
- Eseguire deploy staging, smoke E2E e successivo cutover production seguendo `docs/deploy/pilot-lux-living-01.md`.
- Dopo go-live, eseguire `npm run release:pilot:activate`.

## Risks
- I gate `release:pilot:check:*` assumono file env dedicati (`.env.staging/.env.production` e varianti n8n): senza questi file il check fallisce immediatamente.
- Il comando `factory-launch-smoke --execute` può innescare operazioni reali di creazione/seed/discovery/prepopulate: usare prima la modalità preflight.
- Rimangono modifiche locali non correlate preesistenti su database engine (`apps/engine/data/portal.db-*`).
