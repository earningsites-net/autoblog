# IONOS VPS Runbook (Ops Production)

Questo runbook usa `IONOS VPS` come baseline per il backend ops production del pilot `lux-living-01`.

Architettura target:

- sito pubblico su `Vercel`
- `engine` su VPS come servizio `systemd`, bind su `127.0.0.1:8787`
- `n8n + postgres` su VPS via `docker compose`
- `nginx` davanti a `engine` e `n8n` con HTTPS
- `factory ops` esposto dentro `engine`, protetto con Basic Auth + secret
- `Hetzner` resta solo come fallback tecnico

## Taglia consigliata

Per questo stack non scendere sotto:

- `4 vCore`
- `8 GB RAM`
- `120 GB NVMe`

Se hai la variante flessibile con `240 GB NVMe`, preferiscila.

## 1. Preparazione locale

Genera una chiave SSH dedicata:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/autoblog_ionos -C "autoblog-prod"
cat ~/.ssh/autoblog_ionos.pub
```

Alias SSH locale opzionale:

```bash
cat <<'EOF' >> ~/.ssh/config
Host autoblog-ionos
  HostName 87.106.29.31
  User root
  IdentityFile ~/.ssh/autoblog_ionos
EOF
```

## 2. Creazione VPS in IONOS

Nel pannello `IONOS`:

1. Crea un nuovo `VPS Linux`.
2. Scegli `Ubuntu 24.04`.
3. Seleziona almeno `4 vCore / 8 GB RAM / >=120 GB NVMe`.
4. Scegli il piano piu flessibile disponibile, non il promo piu vincolante.
5. Attiva i backup provider se disponibili senza vincoli eccessivi.
6. Recupera `IP pubblico` e credenziali iniziali del server.

## 3. Firewall IONOS

Configura la policy firewall del VPS con queste regole:

- inbound `22/tcp` solo dal tuo IP pubblico
- inbound `80/tcp` da `0.0.0.0/0`
- inbound `443/tcp` da `0.0.0.0/0`
- nessuna esposizione pubblica per `8787` o `5678`

Nota operativa:

- se la policy di default apre porte di management come `8443` o `8447`, chiudile
- usa `nginx` come unico entrypoint pubblico per le app

## 4. DNS

Crea almeno questi record verso l'IPv4 del VPS:

- `aiblogs.earningsites.net`
- `n8n.earningsites.net`

Verifica:

```bash
dig +short aiblogs.earningsites.net
dig +short n8n.earningsites.net
```

## 5. Primo accesso e hardening SSH

Carica la chiave SSH sul server:

```bash
ssh-copy-id -i ~/.ssh/autoblog_ionos.pub root@87.106.29.31
```

Accedi:

```bash
ssh -i ~/.ssh/autoblog_ionos root@87.106.29.31
```

Bootstrap base:

```bash
apt update
apt upgrade -y
apt install -y git nginx fail2ban ca-certificates curl gnupg unzip snapd
timedatectl set-timezone Europe/Rome
hostnamectl set-hostname autoblog-ops-prod
```

Crea l'utente applicativo:

```bash
adduser --disabled-password --gecos "" autoblog
usermod -aG sudo autoblog
install -d -m 700 -o autoblog -g autoblog /home/autoblog/.ssh
cp /root/.ssh/authorized_keys /home/autoblog/.ssh/authorized_keys
chown autoblog:autoblog /home/autoblog/.ssh/authorized_keys
chmod 600 /home/autoblog/.ssh/authorized_keys
```

Verifica login:

```bash
ssh -i ~/.ssh/autoblog_ionos autoblog@87.106.29.31
```

Solo dopo la verifica, disabilita password e root login:

```bash
sudo sed -i 's/^#\\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

## 6. Docker

Installa Docker dal repository ufficiale:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker autoblog
```

Verifica:

```bash
docker --version
docker compose version
```

## 7. Node.js 22

Installa `Node.js 22`:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
```

Verifica:

```bash
node -v
npm -v
```

## 8. Accesso GitHub al repo

Genera una deploy key sul VPS:

```bash
sudo -u autoblog mkdir -p /home/autoblog/.ssh
sudo -u autoblog ssh-keygen -t ed25519 -f /home/autoblog/.ssh/id_ed25519 -N "" -C "autoblog-vps"
sudo -u autoblog bash -lc 'ssh-keyscan github.com >> ~/.ssh/known_hosts'
sudo cat /home/autoblog/.ssh/id_ed25519.pub
```

In GitHub:

1. `Repo -> Settings -> Deploy keys`
2. `Add deploy key`
3. Incolla la chiave pubblica
4. Mantieni `Allow write access` disattivo, salvo bisogno esplicito

## 9. Clone del progetto

```bash
sudo mkdir -p /srv
sudo chown autoblog:autoblog /srv
sudo -u autoblog git clone git@github.com:earningsites-net/autoblog.git /srv/auto-blog-project
cd /srv/auto-blog-project
sudo -u autoblog npm ci
```

## 10. Env production sul VPS

Trasferisci i file env dal tuo computer:

```bash
scp -i ~/.ssh/autoblog_ionos .env.production root@87.106.29.31:/tmp/engine.env
scp -i ~/.ssh/autoblog_ionos infra/n8n/.env.production root@87.106.29.31:/tmp/n8n.env
```

Sul server:

```bash
sudo mkdir -p /etc/autoblog
sudo install -m 600 /tmp/engine.env /etc/autoblog/engine.env
sudo install -m 600 /tmp/n8n.env /etc/autoblog/n8n.env
rm /tmp/engine.env /tmp/n8n.env
sudo chown root:autoblog /etc/autoblog
sudo chmod 750 /etc/autoblog
sudo chown root:autoblog /etc/autoblog/n8n.env
sudo chmod 640 /etc/autoblog/n8n.env
sudo mkdir -p /var/lib/autoblog
sudo chown autoblog:autoblog /var/lib/autoblog
```

Valori da allineare in `/etc/autoblog/engine.env`:

- `PORTAL_BASE_URL=https://aiblogs.earningsites.net`
- `ENGINE_HOST=127.0.0.1`
- `PORTAL_DB_PATH=/var/lib/autoblog/portal.db`
- `PLAN_AUTOMATION_TRIGGER_URL=https://n8n.earningsites.net/webhook/plan-automation`
- `PREPOPULATE_TRIGGER_URL=https://n8n.earningsites.net/webhook/factory-prepopulate`

Note:

- `ENGINE_PORT=8787` è opzionale; l'engine usa gia quel default.
- non impostare `SITE_SLUG` o `NEXT_PUBLIC_SITE_SLUG` nel root env dell'engine production: il runtime ops è multi-site.
- `NEXT_PUBLIC_PORTAL_BASE_URL` va configurata sul web/Vercel, non è richiesta dal backend engine.

Valori da allineare in `/etc/autoblog/n8n.env`:

- `N8N_HOST=n8n.earningsites.net`
- `N8N_PROTOCOL=https`
- `WEBHOOK_URL=https://n8n.earningsites.net/`
- `N8N_EDITOR_BASE_URL=https://n8n.earningsites.net/`
- `CONTENT_ENGINE_URL=https://aiblogs.earningsites.net`
- `WEB_APP_URL=https://lux-living-01.tuodominio.com`
- `SITE_SLUG=` (opzionale; solo fallback legacy single-site)
- `INTERNAL_API_TOKEN` identico al root env
- `WEB_REVALIDATE_SECRET` identico a `REVALIDATE_SECRET`

Nota su Sanity:

- i workflow n8n risolvono la connessione Sanity via engine per `siteSlug`
- quindi il server deve avere `sites/lux-living-01/.env.generated` con token e project id production coerenti

## 11. Service systemd engine

Installa il service engine:

```bash
sudo cp /srv/auto-blog-project/infra/ops/systemd/autoblog-engine.service.example /etc/systemd/system/autoblog-engine.service
sudo systemctl daemon-reload
sudo systemctl enable --now autoblog-engine
sudo systemctl status autoblog-engine --no-pager
```

Log:

```bash
sudo journalctl -u autoblog-engine -n 100 --no-pager
```

Smoke locale:

```bash
curl -sS http://127.0.0.1:8787/v1/sites/lux-living-01/health
```

## 12. Service systemd n8n + postgres

fino qui
Installa il service dello stack n8n:

```bash
sudo cp /srv/auto-blog-project/infra/ops/systemd/autoblog-n8n.service.example /etc/systemd/system/autoblog-n8n.service
sudo systemctl daemon-reload
sudo systemctl enable --now autoblog-n8n
sudo systemctl status autoblog-n8n --no-pager
```

Verifica container:

```bash
sudo -u autoblog docker compose --env-file /etc/autoblog/n8n.env -f /srv/auto-blog-project/infra/n8n/docker-compose.yml ps
sudo -u autoblog docker compose --env-file /etc/autoblog/n8n.env -f /srv/auto-blog-project/infra/n8n/docker-compose.yml logs --tail 100
```

Smoke locale:

```bash
curl -I http://127.0.0.1:5678
```

## 13. Nginx reverse proxy

Prima del certificato, crea un vhost HTTP minimale:

```bash
sudo tee /etc/nginx/sites-available/autoblog-ops-http >/dev/null <<'EOF'
server {
  listen 80;
  server_name aiblogs.earningsites.net;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name n8n.earningsites.net;

  location / {
    proxy_pass http://127.0.0.1:5678;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/autoblog-ops-http /etc/nginx/sites-enabled/autoblog-ops-http
sudo nginx -t
sudo systemctl reload nginx
```

## 14. TLS con Certbot

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d aiblogs.earningsites.net -d n8n.earningsites.net -m info@earningsites.net --agree-tos --no-eff-email --redirect
```

## 15. Configurazione HTTPS definitiva

Installa la configurazione HTTPS di esempio solo dopo avere i certificati:

```bash
sudo cp /srv/auto-blog-project/infra/ops/nginx/engine-and-factory.conf.example /etc/nginx/sites-available/autoblog-ops
sudo ln -sf /etc/nginx/sites-available/autoblog-ops /etc/nginx/sites-enabled/autoblog-ops
sudo rm -f /etc/nginx/sites-enabled/autoblog-ops-http
sudo nginx -t
sudo systemctl reload nginx
```

Nota su Certbot:

- con `certbot --nginx -d aiblogs.earningsites.net -d n8n.earningsites.net ...` viene creato un certificato SAN unico
- nel caso corrente il nome del certificato è `aiblogs.earningsites.net`
- quindi anche il blocco `server_name n8n.earningsites.net` usa:
  - `/etc/letsencrypt/live/aiblogs.earningsites.net/fullchain.pem`
  - `/etc/letsencrypt/live/aiblogs.earningsites.net/privkey.pem`

Prima del reload finale, sostituisci la allowlist di `/ops/factory` con il tuo IP pubblico o con il range della VPN.
Esempio:

```nginx
location /ops/factory {
  allow 203.0.113.10/32;
  deny all;

  proxy_pass http://127.0.0.1:8787/ops/factory;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Verifica:

```bash
curl -I https://aiblogs.earningsites.net
curl -I https://n8n.earningsites.net
curl -sS https://aiblogs.earningsites.net/v1/sites/lux-living-01/health
```

## 16. Workflow import e smoke finale

Importa e verifica i workflow:

```bash
cd /srv/auto-blog-project
sudo -u autoblog npm run n8n:import:changed
sudo -u autoblog npm run n8n:test:flows
```

Controlli finali:

```bash
systemctl status autoblog-engine --no-pager
systemctl status autoblog-n8n --no-pager
systemctl status nginx --no-pager
sudo certbot renew --dry-run
```

Verifica anche:

- login portal su `https://aiblogs.earningsites.net/portal`
- pagina `factory` su `https://aiblogs.earningsites.net/ops/factory`
- editor `n8n` su `https://n8n.earningsites.net`

## 17. Billing e cutover

Quando l'engine e online su HTTPS:

1. crea in Stripe Live il webhook `https://aiblogs.earningsites.net/api/billing/webhooks/stripe`
2. copia il signing secret `whsec_...` in `STRIPE_WEBHOOK_SECRET` dentro `/etc/autoblog/engine.env`
3. riavvia l'engine:

```bash
sudo systemctl restart autoblog-engine
```

4. esegui gli smoke finali del pilot:

```bash
cd /srv/auto-blog-project
node scripts/release/factory-launch-smoke.mjs --site lux-living-01 --base-url https://aiblogs.earningsites.net --root-env .env.production
```
