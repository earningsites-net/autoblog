# Task: recurring-firewall-problems

## Goal
- Valutare una policy firewall/VPS piu robusta per accessi admin con IP domestico dinamico, senza indebolire la sicurezza.

## Done
- Verificata la baseline ops IONOS gia documentata nel repo: `22/tcp` limitata all'IP admin, `80/443` pubbliche, nessuna esposizione di `8787` o `5678`.
- Chiarita la distinzione tra firewall provider e protezione applicativa: l'accesso a `/ops/factory` passa da `443` e dipende da `nginx` + Basic Auth, non dalla sola regola firewall SSH.
- Verificato su documentazione ufficiale che il firewall IONOS opera con regole per `Allowed IP`/range e porte, mentre un overlay admin tipo `Tailscale SSH` puo' confinare `SSH` al solo tailnet.
- Definita una direzione operativa piu robusta per IP domestici variabili:
  - preferire una rete admin privata/stabile (`WireGuard`, `Tailscale` o bastion)
  - evitare di allargare come default una allowlist a grandi CIDR residenziali
  - se `SSH` resta pubblico, compensare con hardening `sshd` e `fail2ban`
- Preparata una spiegazione piu semplice dei concetti base:
  - `80/443` sono le porte web pubbliche (`HTTP/HTTPS`)
  - `8787/5678` sono porte interne dei processi (`engine` e `n8n`) e non dovrebbero essere raggiungibili direttamente da Internet
  - una rete admin privata/stabile evita che il cambio del tuo IP domestico ti blocchi fuori dal server
- Chiarito l'impatto tecnico:
  - non serve refactoring dell'app `engine/web/n8n`
  - il lavoro e' quasi tutto infrastrutturale/configurativo (`IONOS firewall`, `sshd`, `nginx`, eventuale agente VPN)
  - complessita' bassa con `Tailscale`, media con `WireGuard`, piu alta con `bastion`
- Tentato accesso SSH reale al VPS `87.106.29.31` per procedere con l'installazione, ma `22/tcp` va ancora in timeout dal mio IP corrente.
- Preparati gli artefatti per il rollout:
  - `scripts/vps-enable-tailscale.sh` per installare/bootstrap `Tailscale` sul VPS via SSH
  - `scripts/ops-factory-tunnel.sh` per usare `/ops/factory` via tunnel SSH locale verso `127.0.0.1:8787`
  - runbook IONOS e esempio `nginx` aggiornati per preferire `Tailscale` + tunnel e bloccare la route pubblica di `/ops/factory`
- Segnalato comportamento anomalo sul pannello web IONOS (`Cloud e VPS` logout automatico): non correlato alle modifiche fatte qui, perche' in questa sessione non sono state eseguite automazioni sul browser/pannello IONOS e nessun comando remoto sul VPS e' andato a buon fine.
- Verificato nuovo accesso SSH riuscito al VPS (`autoblog-ops-prod` come `root`).
- Installato `Tailscale` sul VPS:
  - pacchetto `tailscale` installato correttamente
  - servizio `tailscaled` abilitato e attivo
  - login al tailnet completato
  - IPv4 Tailscale assegnato: `100.68.245.109`
- Avviato `tailscale up` sul VPS, autorizzato il device nel tailnet utente e verificato backend `Running`.
- Verificato che `sshd` sul VPS continua ad ascoltare regolarmente su `0.0.0.0:22` e `[::]:22`.
- Verificato che la macchina locale da cui sto operando non ha ancora il client `Tailscale` installato/attivo (`which tailscale` non trovato), quindi non ha route verso l'IP tailnet del VPS e i test `ssh ...@100.68.245.109` vanno in timeout.
- Tentata installazione del client locale `Tailscale` su macOS via Homebrew cask:
  - download del pacchetto riuscito
  - installazione bloccata da richiesta password admin `sudo`
  - il pacchetto segnala anche possibile approvazione manuale in `System Settings -> Privacy & Security`
- Verificato accesso `SSH` via Tailscale riuscito verso il VPS:
  - `root@100.68.245.109`
  - `autoblog@100.68.245.109`
- Verificato percorso privato per la `Factory UI`:
  - `./scripts/ops-factory-tunnel.sh --host autoblog@100.68.245.109`
  - `http://127.0.0.1:8788/ops/factory` risponde `401 Unauthorized`, quindi la `Basic Auth` applicativa resta attiva anche via tunnel
- Verificato anche l'engine interno dal VPS su `127.0.0.1:8787` con health OK per `lux-living-01`.
- Applicato tightening live su `nginx` del VPS:
  - file live aggiornato: `/etc/nginx/sites-enabled/autoblog-ops`
  - backup creato: `/etc/nginx/sites-enabled/autoblog-ops.bak-20260416105632`
  - vecchia allowlist di IP domestici rimossa da `/ops/factory`
  - nuova policy pubblica: `location /ops/factory { deny all; }`
  - `nginx -t` eseguito con successo e reload applicato
- Verifiche finali post-change:
  - pubblico `https://aiblogs.earningsites.net/ops/factory` => `403`
  - privato via tunnel `http://127.0.0.1:8788/ops/factory` => `401 Unauthorized`
- Valutata anche l'esposizione `n8n`:
  - `https://n8n.earningsites.net/` oggi risponde pubblicamente `200`
  - la porta `5678` resta interna dietro `nginx`, quindi non e' esposta direttamente
  - sul VPS live `WEBHOOK_URL` e `N8N_EDITOR_BASE_URL` puntano entrambi a `https://n8n.earningsites.net/`
  - sul VPS live non risultano impostate `N8N_PUBLIC_API_DISABLED` o `N8N_PUBLIC_API_SWAGGERUI_DISABLED`
  - il setup corrente e' funzionale ma non e' l'assetto piu prudente: la raccomandazione e' lasciare pubblici solo i webhook necessari e restringere l'editor/UI a rete privata o accesso forte separato
- Pulizia live finale del VPS completata:
  - `autoblog` puo' usare `sudo -n` senza password
  - `SSH` via Tailscale resta operativa su `autoblog@100.68.245.109`
  - `root` via SSH e' ora bloccato
  - `AuthenticationMethods publickey` attivo per richiedere chiavi SSH
  - il test su `87.106.29.31:22` va in timeout, coerente con la rimozione delle regole firewall IONOS
  - `nginx` ripulito da file superflui in `sites-enabled` (`default` rimosso, backup spostato fuori dal glob)
  - `nginx -t` non mostra piu warning di `server_name` duplicati

## Decisions
- La soluzione raccomandata di lungo periodo e' spostare gli accessi admin su una rete privata stabile invece di inseguire IP domestici `/32`.
- Il firewall IONOS resta un controllo di porta/livello rete; per i path privati su `443` serve comunque un controllo a livello `nginx` o una reachability privata separata.
- Questa attivita' va trattata come hardening ops, non come refactor applicativo.
- Raccomandazione operativa per questo caso: `Tailscale` come rete admin privata/stabile.
- Strategia consigliata:
  - `SSH` al VPS via `Tailscale`
  - `22/tcp` chiusa su Internet pubblico dopo la verifica
  - `80/443` pubbliche solo per i servizi web necessari
  - `8787/5678` non esposte pubblicamente
  - `/ops/factory` da non dipendere piu' da allowlist dell'IP domestico; meglio accesso via tunnel/ rete admin privata + Basic Auth
  - preferire `OpenSSH` normale sopra `Tailscale` prima di valutare `Tailscale SSH`, per tenere il rollout piu semplice
- Con `SSH` via Tailscale verificato come funzionante, le regole pubbliche `22/tcp` basate su IP domestici/lavoro non sono piu' necessarie per l'operativita' ordinaria e andrebbero rimosse/disabilitate.

## Next
- Aggiornare l'accesso operativo quotidiano per usare `autoblog@100.68.245.109` o `autoblog-ops-prod.tail2bbeab.ts.net`.
- Usare `./scripts/ops-factory-tunnel.sh --host autoblog@100.68.245.109` per la `Factory UI`.
- Decidere il modello finale per `n8n`:
  - minimo: lasciare pubblico `n8n.earningsites.net` ma abilitare hardening aggiuntivo (`N8N_PUBLIC_API_DISABLED`, `N8N_PUBLIC_API_SWAGGERUI_DISABLED`, MFA/SSO se disponibile, aggiornamenti regolari)
  - meglio: separare hostname pubblico webhook e hostname privato editor, o bloccare l'editor pubblico via `nginx` lasciando esposti solo i path webhook

## Risks
- Un allowlist piu ampia sul range dell'ISP riduce i lockout ma aumenta la superficie di attacco.
- Tenere `/ops/factory` sul dominio pubblico con sola allowlist IP e' fragile quando l'IP client cambia spesso.
- Il problema di logout nel pannello IONOS va trattato come issue separata del portale/sessione browser finche' non emerge una causa lato account/provider.
- Su macOS, l'installazione del client `Tailscale` puo' richiedere intervento locale non automatizzabile: password admin e approvazione estensione/network component.
- Se l'editor `n8n` resta pubblicamente raggiungibile sullo stesso hostname dei webhook, la superficie di attacco resta piu ampia del necessario anche se `5678` non e' esposta direttamente.
