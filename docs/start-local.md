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

- In `.env`: `SITE_SLUG`, `SANITY_STUDIO_SITE_SLUG`, `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`, `REVALIDATE_SECRET`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`
- In `infra/n8n/.env`: `SITE_SLUG`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `POSTGRES_PASSWORD`, `SANITY_*`, `WEB_APP_URL`, `WEB_REVALIDATE_SECRET`, provider keys AI

Note utili:

- Per il revalidate da n8n locale verso Next locale, usa `WEB_APP_URL=http://host.docker.internal:3000`.
- `WEB_REVALIDATE_SECRET` (n8n) deve combaciare con `REVALIDATE_SECRET` (web).
- Se lavori su un sito diverso, aggiorna `SITE_SLUG` in entrambi i file env prima di lanciare i workflow.

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
  --blueprint home-diy-magazine \
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
