# Hetzner VPS Runbook (Fallback Option)

Questo runbook usa `Hetzner Cloud` come alternativa al baseline `IONOS VPS` per il pilot `lux-living-01`.

## Perche Hetzner

- Buon rapporto prezzo/prestazioni in Europa.
- `Cloud Firewall` gratuito.
- `Backups` giornalieri disponibili lato provider.
- Buon fit per stack semplice: `Ubuntu 24.04 + nginx + systemd + Docker`.

## Taglia consigliata

Per questo stack (`engine + nginx + n8n + postgres` sullo stesso VPS), non scendere sotto:

- `x86_64`
- `4 vCPU`
- `8 GB RAM`
- `80 GB NVMe`

Se vuoi partire piu stretto per il solo engine, `2 vCPU / 4 GB` puo partire, ma per il rollout completo e meno confortevole.

## 1. Preparazione locale

Genera una chiave SSH dedicata per il VPS:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/autoblog_hetzner -C "autoblog-prod"
cat ~/.ssh/autoblog_hetzner.pub
```

Opzionale: aggiungi un alias SSH locale:

```bash
cat <<'EOF' >> ~/.ssh/config
Host autoblog-hetzner
  HostName SERVER_IP
  User root
  IdentityFile ~/.ssh/autoblog_hetzner
EOF
```

## 2. Creazione server in Hetzner Console

In `https://console.hetzner.com/`:

1. Crea un progetto, ad esempio `autoblog-prod`.
2. Aggiungi la chiave SSH pubblica `~/.ssh/autoblog_hetzner.pub`.
3. Crea il server con queste scelte:
- `Location`: Germania o Finlandia
- `Image`: `Ubuntu 24.04`
- `Type`: piano x86 con almeno `4 vCPU / 8 GB RAM`
- `Networking`: `IPv4 + IPv6`
- `Backups`: `ON`
- `Labels`: `env=production`, `app=autoblog`
4. Crea una `Firewall` Hetzner e associa il server.

Regole firewall consigliate:

- inbound `22/tcp` solo dal tuo IP pubblico
- inbound `80/tcp` da `0.0.0.0/0`
- inbound `443/tcp` da `0.0.0.0/0`
- non esporre `8787` o `5678`

## 3. DNS

Crea almeno questi record DNS verso l'IPv4 del server:

- `engine.tuodominio.com`
- `n8n.tuodominio.com`

Verifica propagazione:

```bash
dig +short engine.tuodominio.com
dig +short n8n.tuodominio.com
```

## 4. Primo accesso

Accedi al server:

```bash
ssh -i ~/.ssh/autoblog_hetzner root@SERVER_IP
```

Aggiorna il sistema:

```bash
apt update
apt upgrade -y
apt install -y git nginx fail2ban ca-certificates curl gnupg unzip
timedatectl set-timezone Europe/Rome
```

## 5. Utente applicativo

Crea un utente dedicato:

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
ssh -i ~/.ssh/autoblog_hetzner autoblog@SERVER_IP
```

Solo dopo aver verificato il login con `autoblog`, disabilita password e root login:

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

Sul server, genera una deploy key:

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
4. `Allow write access` solo se ti serve deploy dal server

## 9. Clone del progetto

```bash
sudo mkdir -p /srv
sudo chown autoblog:autoblog /srv
sudo -u autoblog git clone git@github.com:earningsites-net/autoblog.git /srv/auto-blog-project
cd /srv/auto-blog-project
sudo -u autoblog npm ci
```

## 10. Env engine

Dal tuo computer locale trasferisci il file env:

```bash
scp -i ~/.ssh/autoblog_hetzner .env.production root@SERVER_IP:/tmp/engine.env
```

Sul server:

```bash
sudo mkdir -p /etc/autoblog
sudo install -m 600 /tmp/engine.env /etc/autoblog/engine.env
rm /tmp/engine.env
sudo nano /etc/autoblog/engine.env
```

Valori da sistemare subito in `/etc/autoblog/engine.env`:

- `PORTAL_BASE_URL=https://engine.tuodominio.com`
- `NEXT_PUBLIC_PORTAL_BASE_URL=https://engine.tuodominio.com`
- `ENGINE_PORT=8787`
- `ENGINE_HOST=0.0.0.0`
- `SITE_SLUG=lux-living-01`
- `NEXT_PUBLIC_SITE_SLUG=lux-living-01`
- `PLAN_AUTOMATION_TRIGGER_URL=https://n8n.tuodominio.com/webhook/plan-automation`
- `PREPOPULATE_TRIGGER_URL=https://n8n.tuodominio.com/webhook/factory-prepopulate`

Se `n8n` non e ancora online, gli ultimi due URL possono restare placeholder temporanei, ma il service engine deve almeno partire.

## 11. Service systemd engine

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

## 12. Nginx reverse proxy

Crea un virtual host HTTP iniziale:

```bash
sudo tee /etc/nginx/sites-available/autoblog-engine >/dev/null <<'EOF'
server {
  listen 80;
  server_name engine.tuodominio.com;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/autoblog-engine /etc/nginx/sites-enabled/autoblog-engine
sudo nginx -t
sudo systemctl reload nginx
```

Smoke:

```bash
curl -I http://engine.tuodominio.com
```

## 13. TLS con Certbot

Installa Certbot:

```bash
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
```

Richiedi certificato e abilita redirect HTTPS:

```bash
sudo certbot --nginx -d engine.tuodominio.com -m tua-email@dominio.com --agree-tos --no-eff-email --redirect
```

Verifica:

```bash
curl -I https://engine.tuodominio.com
curl -sS https://engine.tuodominio.com/v1/sites/lux-living-01/health
```

## 14. Check finali engine

Controlla:

```bash
systemctl status autoblog-engine --no-pager
systemctl status nginx --no-pager
sudo certbot renew --dry-run
```

Controlla anche:

- login al portale su `https://engine.tuodominio.com/portal`
- pagina factory su `https://engine.tuodominio.com/ops/factory`

## 15. Dopo questo step

Quando l'engine e online:

1. puoi creare il webhook Stripe production verso `https://engine.tuodominio.com/api/billing/webhooks/stripe`
2. puoi proseguire con il deploy `n8n` sullo stesso VPS
3. puoi poi chiudere gli URL reali nei file env
