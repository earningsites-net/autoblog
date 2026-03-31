## Per vedere in locale un altro sito/progetto, cambia nel root .env:

Routing sito attivo
SITE_BLUEPRINT_PATH=./sites/<slug>/site.blueprint.json
SITE_SLUG=<slug>
NEXT_PUBLIC_SITE_SLUG=<slug>
SANITY_STUDIO_SITE_SLUG=<slug>
Connessione Sanity locale (web + studio)
SANITY_PROJECT_ID=...
SANITY_DATASET=...
SANITY_API_VERSION=...
SANITY_READ_TOKEN=...
SANITY_WRITE_TOKEN=...
SANITY_STUDIO_PROJECT_ID=...
SANITY_STUDIO_DATASET=...

Poi riavvia:
npm run dev:down
npm run dev:up

## Procedura corretta per importare le env aggiornate sul server vps quando vengono cambiate:

scp -i ~/.ssh/autoblog_ionos .env.production root@87.106.29.31:/tmp/engine.env
scp -i ~/.ssh/autoblog_ionos infra/n8n/.env.production root@87.106.29.31:/tmp/n8n.env
Poi sul server:

sudo install -m 600 /tmp/engine.env /etc/autoblog/engine.env
sudo install -m 600 /tmp/n8n.env /etc/autoblog/n8n.env
rm /tmp/engine.env /tmp/n8n.env
E poi:

se hai cambiato solo env engine:
sudo systemctl restart autoblog-engine
se hai cambiato solo env n8n:
sudo systemctl restart autoblog-n8n
se hai cambiato entrambe:
sudo systemctl restart autoblog-engine
sudo systemctl restart autoblog-n8n
Verifica:

sudo systemctl status autoblog-engine --no-pager
sudo systemctl status autoblog-n8n --no-pager

# Login al vps con username autoblog

ssh -i ~/.ssh/autoblog_ionos autoblog@87.106.29.31

# Pull repo github sul server VPS:
sudo -u autoblog -H bash -lc 'cd /srv/auto-blog-project && git fetch origin && git pull --ff-only origin main'

# Handoff

## Prod

npm run site:handoff:prod -- ai-blog-news \
 --owner-email buyer@example.com \
 --temp-password 'TempPass123!' \
 --web-base-url https://ai-blog-news-mu.vercel.app \
 --studio-url https://ai-blog-news.sanity.studio

## Local

npm run site:handoff -- ai-blog-news \
 --owner-email buyer@example.com \
 --web-base-url https://ai-blog-news-mu.vercel.app \
 --studio-url https://ai-blog-news.sanity.studio

## Se vuoi impostare anche una password provvisoria portal:

npm run site:handoff -- ai-blog-news \
 --owner-email buyer@example.com \
 --temp-password 'TempPass123!' \
 --web-base-url https://ai-blog-news-mu.vercel.app \
 --studio-url https://ai-blog-news.sanity.studio

## Se vuoi fare il vero cutover owner:
npm run site:handoff -- ai-blog-news \
 --owner-email buyer@example.com \
 --revoke-other-owners
