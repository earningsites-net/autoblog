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
- Corretto blocco build Vercel sul frontend:
  - aggiunta dipendenza `react-is` in `apps/web/package.json` (e lockfile aggiornato)
  - fix Next.js 15 `useSearchParams` su `/disclaimer` con boundary `Suspense` in `apps/web/src/app/layout.tsx`
- Verifica tecnica post-fix:
  - `npm --workspace @autoblog/web run build` completato con successo.
- Debug deploy Vercel riuscito ma configurato male:
  - sito online mostra branding `Luxury Living Style` ma categorie/tema `Home & DIY`, segnale di blueprint non risolto correttamente in runtime/build.
  - identificata causa probabile: `SITE_BLUEPRINT_PATH` relativo non valido con `Root Directory=apps/web` in Vercel (`./sites/...` punta a path inesistente e fa fallback su `hammer-hearth`).
- Hardened fix applicata al loader blueprint web:
  - `apps/web/src/lib/site-blueprint.ts` ora prova anche il path per slug atteso (`SITE_SLUG` / `NEXT_PUBLIC_SITE_SLUG`) e scarta blueprint con slug non coerente.
  - questo evita fallback silenzioso su `hammer-hearth` quando il sito atteso è `lux-living-01`.
- Build di verifica dopo fix: `npm --workspace @autoblog/web run build` OK.
- Diagnostica runtime su deploy live `https://autoblog-web-ruddy.vercel.app/`:
  - confermato fallback attivo su blueprint `hammer-hearth` (`category-hammer-hearth-*`, `data-theme-recipe=bold_magazine`, categorie Home & DIY).
  - branding `Luxury Living Style` arriva da env (`NEXT_PUBLIC_SITE_NAME`), creando mix incoerente.
  - `meta og:url` mostra valore staging (`autoblog-web-staging.vercel.app`), ulteriore segnale di env production non allineate.
- Confermata dinamica cache lato Vercel:
  - risposta homepage con `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `x-vercel-cache: STALE/HIT`.
  - comportamento coerente con ISR: dopo ~5 minuti una rigenerazione può propagare la configurazione errata e il problema riappare al refresh.
- Verifica locale di build/traces:
  - build locale `@autoblog/web` OK con blueprint `lux-living-01` in output statico.
  - la regressione osservata live è quindi di configurazione env/runtime production, non di compilazione.
- Rimozione fallback confusivi nel web runtime:
  - `apps/web/src/lib/site-blueprint.ts`: rimossi fallback legacy automatici a `sites/hammer-hearth/*`; loader ora usa solo path esplicito/env + slug configurato.
  - `apps/web/src/lib/site.ts`: rimosso default hardcoded `hammer-hearth`; in production ora richiede slug configurato (`SITE_SLUG` o `NEXT_PUBLIC_SITE_SLUG`) e non ricade su brand legacy.
  - `apps/web/src/lib/content-repository.ts`: rimosso fallback categorie da blueprint legacy e fallback automatico a `mock` in production quando driver/env non sono configurati.
- Verifica post-change:
  - `npm --workspace @autoblog/web run build` OK.

## Decisions
- Pilot operativo fissato su `lux-living-01`.
- Il rilascio viene codificato in runbook + script CLI ripetibili (non in passaggi manuali ad-hoc).
- La promozione stato sito (`domainStatus`, `automationStatus`) resta azione esplicita post go-live, non automatica.
- Factory smoke supporta modalità preflight sicura (default) e modalità `--execute` per validazione reale del one-click launch.
- Modello ambienti aggiornato per richiesta utente:
  - sito cliente `lux-living-01` orientato a solo production
  - staging mantenuto per dashboard/ops quando necessario.
- Priorità immediata: stabilizzare env production Vercel del sito (slug/path/url) prima di ulteriori modifiche codice.
- Strategia fallback aggiornata: privilegiare fail-fast su production rispetto a fallback silenziosi cross-brand.

## Next
- Popolare `.env.staging`, `.env.production`, `infra/n8n/.env.staging`, `infra/n8n/.env.production` con segreti reali e domini.
- Eseguire gate completi:
  - `npm run release:pilot:check:staging`
  - `npm run release:pilot:check:production`
  - `npm run n8n:test:flows`
- Eseguire deploy staging, smoke E2E e successivo cutover production seguendo `docs/deploy/pilot-lux-living-01.md`.
- Dopo go-live, eseguire `npm run release:pilot:activate`.
- Eseguire redeploy Vercel del progetto web dopo il fix dipendenze/layout.
- Confermare su Vercel che le env siano production-ready per modello “sito solo prod”.
- Allineare in Vercel (scope `Production`) almeno:
  - `SITE_SLUG=lux-living-01`
  - `NEXT_PUBLIC_SITE_SLUG=lux-living-01`
  - `SITE_BLUEPRINT_PATH=../../sites/lux-living-01/site.blueprint.json`
  - `NEXT_PUBLIC_SITE_URL` al dominio reale production (non staging).
- Eseguire redeploy production dopo update env e validare marker HTML:
  - assenza `category-hammer-hearth-*`
  - `data-theme-recipe` coerente con `lux-living-01`
  - `og:url` coerente col dominio production.
- Dopo il redeploy, monitorare il primo ciclo ISR (5 minuti) per confermare che la rigenerazione non reintroduca stato errato.

## Risks
- I gate `release:pilot:check:*` assumono file env dedicati (`.env.staging/.env.production` e varianti n8n): senza questi file il check fallisce immediatamente.
- Il comando `factory-launch-smoke --execute` può innescare operazioni reali di creazione/seed/discovery/prepopulate: usare prima la modalità preflight.
- Rimangono modifiche locali non correlate preesistenti su database engine (`apps/engine/data/portal.db-*`).
- Se `SITE_SLUG` / `NEXT_PUBLIC_SITE_SLUG` non sono impostati in production, il loader può continuare a selezionare blueprint legacy e generare mix brand/tema.
- ISR a 300s può “riattivare” il problema dopo un deploy apparentemente corretto se la configurazione env resta incoerente.
- Con fallback rimossi, env mancanti in production possono generare errore esplicito (expected) anziché contenuti di un sito sbagliato.
