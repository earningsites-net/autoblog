# Avvio Locale Completo (Web + Studio + Engine/Factory + n8n)

Questa guida è il riferimento operativo unico per avviare tutto in locale.

## 0) Prerequisiti

- Node.js `>=22`
- npm
- Docker + Docker Compose

## 1) Setup una tantum

Esegui dalla root del repo:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm install
```

Configura i file env (se non già fatto):

```bash
cp .env.example .env
cp infra/n8n/.env.example infra/n8n/.env
```

Compila almeno questi valori:

- In `.env`: `SITE_SLUG`, `SANITY_STUDIO_SITE_SLUG`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`, `REVALIDATE_SECRET`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `INTERNAL_API_TOKEN`, `FACTORY_API_SECRET`, `FACTORY_UI_USERNAME`, `FACTORY_UI_PASSWORD` (opzionale)
- In `infra/n8n/.env`: `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `POSTGRES_PORT`, `POSTGRES_PASSWORD`, `WEB_APP_URL`, `WEB_REVALIDATE_SECRET`, `CONTENT_ENGINE_URL`, provider keys AI, `INTERNAL_API_TOKEN` (`SITE_SLUG` opzionale solo fallback legacy)
- In `infra/n8n/.env` per scheduler piano-based: `PLAN_SCHEDULER_TEST_MODE`, `PLAN_SCHEDULER_TICK_MINUTES`, `PLAN_TEST_INTERVAL_MINUTES_BASE`, `PLAN_TEST_INTERVAL_MINUTES_STANDARD`, `PLAN_TEST_INTERVAL_MINUTES_PRO`, `PLAN_TOPIC_REFILL_INTERVAL_MINUTES`, `PLAN_TOPIC_REFILL_COUNT`, `ARTICLE_BATCH_SIZE`, `IMAGE_BATCH_SIZE`, `QA_BATCH_SIZE`

Note utili:

- Per il revalidate da n8n locale verso Next locale, usa `WEB_APP_URL=http://host.docker.internal:3000`.
- `WEB_REVALIDATE_SECRET` (n8n) deve combaciare con `REVALIDATE_SECRET` (web).
- In strict multi-site, evita `SITE_SLUG` fisso in `infra/n8n/.env`: il planner risolve i siti target dall'engine.
- `SITE_SLUG` / `SANITY_STUDIO_SITE_SLUG` nel root `.env` servono solo a scegliere quale sito vedere localmente su web/studio. Non definiscono la tenancy runtime di engine+n8n.
- Se vuoi usare Postgres anche per il portal locale, il Postgres del compose `infra/n8n` viene esposto solo in loopback host su `127.0.0.1:${POSTGRES_PORT}`.
- Per attivare un sito nella pipeline multi-site, usa `sites/registry.json` con `automationStatus=active`.
- In strict per-site mode, n8n non usa più `SANITY_*` globali: le credenziali sono risolte via engine da `sites/<slug>/.env.generated`.
- Lo scheduler piano-based usa `siteSlug` e quota dal backend engine; se `brief_ready` è vuoto attiva auto-refill topic via API factory.
- `INTERNAL_API_TOKEN` deve avere lo stesso valore in `.env` e `infra/n8n/.env` (usato per endpoint interni engine e webhook n8n sensibili).
- `FACTORY_API_SECRET` protegge le route factory (`/api/factory/*`, `/v1/factory/*` e la UI `/ops/factory` lato chiamate API).
- `/ops/factory` è protetta da HTTP Basic Auth:
  - username: `FACTORY_UI_USERNAME` (default `admin`)
  - password: `FACTORY_UI_PASSWORD` (fallback: `FACTORY_API_SECRET` se vuota)

### Cambio sito locale (web + studio) con un comando

Per passare rapidamente a un altro sito locale e aggiornare in automatico le variabili Sanity/SITE nel `.env` root e in `apps/studio/.env`:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run site:use -- <site-slug>
```

Esempio:

```bash
npm run site:use -- lux-living-01
```

Poi riavvia i servizi. In particolare `Sanity Studio` legge il progetto all'avvio, quindi se `npm run dev:studio` è già acceso va fermato e riavviato:

```bash
npm run dev:down
npm run dev:up
```

### Bootstrap portal Postgres locale

Se vuoi spostare il portal locale da SQLite a Postgres:

1. avvia il compose locale (`./scripts/dev-up.sh` oppure `docker compose up -d` in `infra/n8n`)
2. crea database + utente dedicati per il portal:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run portal:postgres:bootstrap -- \
  --admin-url postgres://n8n:replace-me@127.0.0.1:5432/postgres \
  --database autoblog_portal_local \
  --user autoblog_portal_local \
  --write-env .env
```

3. migra i dati attuali del portal:

```bash
npm run portal:store:migrate:postgres -- \
  --source-sqlite apps/engine/data/portal.db \
  --target-url "$(sed -n 's/^PORTAL_DATABASE_URL=//p' .env)"
```

4. riavvia `engine`:

```bash
npm run dev:engine
```

Dopo il bootstrap, in `.env` devono esserci:

```env
PORTAL_STORE_PROVIDER=postgres
PORTAL_DATABASE_URL=postgres://...
```

## 2) Avvio stack (4 terminali)

## Avvio rapido (consigliato)

Dalla root:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
./scripts/dev-up.sh
# equivalente:
# npm run dev:up
```

Questo avvia:

- Docker n8n + Postgres
- Web (`localhost:3000`)
- Sanity Studio (`localhost:3333`)
- Engine + Factory UI (`localhost:8787`)

Opzioni utili:

```bash
./scripts/dev-up.sh --fresh
./scripts/dev-up.sh --no-docker
```

### Terminale A: n8n + Postgres (Docker)

```bash
cd "/Users/danilociamprone/Documents/Auto blog project/infra/n8n"
docker compose up -d
docker compose ps
```

UI n8n: `http://localhost:<N8N_PORT>` (dal file `infra/n8n/.env`, nel tuo caso `http://localhost:5679`)

Se porta occupata, cambia `N8N_PORT` in `infra/n8n/.env` (es. `5680`) e rilancia.

### Terminale B: Frontend Next.js

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm --workspace @autoblog/web run dev -- --hostname 0.0.0.0 --port 3000
```

Sito: [http://localhost:3000](http://localhost:3000)

### Terminale C: Sanity Studio

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run dev:studio
```

Studio: [http://localhost:3333](http://localhost:3333)

### Terminale D: Engine + Factory UI

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run dev:engine
```

Factory UI: [http://localhost:8787/ops/factory](http://localhost:8787/ops/factory)

## 3) Verifiche rapide

Da root progetto:

```bash
curl -sS http://localhost:8787/api/factory/options
```

```bash
curl -i -X POST "http://localhost:3000/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: <REVALIDATE_SECRET>" \
  --data '{"type":"site"}'
```

Verifica n8n:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project/infra/n8n"
docker compose logs -f n8n
```

Sincronizza i workflow n8n modificati (import automatico):

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run n8n:import:changed
```

Con smoke test sui workflow modificati:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run n8n:test:flows
```

Report ultimo run:

```bash
cat "/Users/danilociamprone/Documents/Auto blog project/docs/ops/n8n-flow-checks/latest-report.json"
```

Controllo rapido env effettive nel container n8n:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project/infra/n8n"
docker compose exec -T n8n sh -lc 'echo PLAN_SCHEDULER_TEST_MODE=$PLAN_SCHEDULER_TEST_MODE; echo PLAN_TEST_INTERVAL_MINUTES_BASE=$PLAN_TEST_INTERVAL_MINUTES_BASE; echo PLAN_TEST_INTERVAL_MINUTES_STANDARD=$PLAN_TEST_INTERVAL_MINUTES_STANDARD; echo PLAN_TEST_INTERVAL_MINUTES_PRO=$PLAN_TEST_INTERVAL_MINUTES_PRO; echo PLAN_TOPIC_REFILL_INTERVAL_MINUTES=$PLAN_TOPIC_REFILL_INTERVAL_MINUTES; echo PLAN_TOPIC_REFILL_COUNT=$PLAN_TOPIC_REFILL_COUNT; echo ARTICLE_BATCH_SIZE=$ARTICLE_BATCH_SIZE; echo IMAGE_BATCH_SIZE=$IMAGE_BATCH_SIZE; echo QA_BATCH_SIZE=$QA_BATCH_SIZE'
```

## 4) Creazione nuovo sito (2 modalità)

## Modalità A: UI (consigliata)

Apri [http://localhost:8787/ops/factory](http://localhost:8787/ops/factory), compila i campi, poi:

- `Launch Site (One Click)` per: create -> seed -> discover -> handoff (+ prepopulate opzionale)
- `Create Only` per creare solo la base progetto

Per usare il toggle `Run prepopulate`, configura `PREPOPULATE_TRIGGER_URL` nell'ambiente engine (endpoint webhook n8n che triggera `prepopulate_bulk_runner`).

## Modalità B: CLI

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run factory:launch -- my-new-site \
  --theme-tone auto \
  --topic-count 60 \
  --source suggest
```

Per applicare subito mutazioni su Sanity:

```bash
npm run sanity:apply -- --file sites/my-new-site/seed-content/sanity.mutations.json
npm run sanity:apply -- --file sites/my-new-site/seed-content/topic-candidates.mutations.json
```

Export handoff per cessione (bundle per singolo sito):

```bash
npm run factory -- release-site my-new-site --from-sanity
```

## 5) Operazioni comuni

Typecheck:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run typecheck
```

Controllo stato sito factory:

```bash
curl -sS http://localhost:8787/api/factory/site/hammer-hearth/status
```

Pulizia contenuti Sanity (attenzione, distruttivo):

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
npm run sanity:cleanup -- --site-slug hammer-hearth --include-topics
```

## 6) Stop servizi

Stop Next/Studio/Engine: `Ctrl+C` nei terminali B/C/D.

Stop rapido completo:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project"
./scripts/dev-down.sh
# equivalente:
# npm run dev:down
```

Se vuoi lasciare docker acceso:

```bash
./scripts/dev-down.sh --keep-docker
```

Stop n8n + Postgres:

```bash
cd "/Users/danilociamprone/Documents/Auto blog project/infra/n8n"
docker compose down
```
