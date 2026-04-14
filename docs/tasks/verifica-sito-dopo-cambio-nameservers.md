# Task: verifica-sito-dopo-cambio-nameservers

## Goal
- Verificare configurazione DNS/nameserver di `earningsites.net` dopo passaggio a Vercel e capire perche' `www` e `aiblogs` mostrano comportamenti intermittenti.

## Done
- Creato task file del thread e raccolto il contesto di progetto rilevante.
- Verificata la delega al registry `.net`: `earningsites.net` punta a `ns1.vercel-dns.com` e `ns2.vercel-dns.com`.
- Confrontate zona DNS Vercel e vecchia zona Hobohost.
- Verificata la risposta HTTP reale di `earningsites.net`, `www.earningsites.net`, `aiblogs.earningsites.net/portal` e `n8n.earningsites.net` forzando sia i target Vercel sia il VPS legacy.
- Raccolta la procedura ufficiale Vercel per aggiungere manualmente record DNS nella UI del dominio gestito con nameserver Vercel.
- Verificato il caso email/webmail:
- nella vecchia zona Hobohost `webmail.earningsites.net` punta a `208.82.114.179` e risponde con la webmail Roundcube
- nella zona Vercel `webmail.earningsites.net` punta invece a target errati e finisce su `404 DEPLOYMENT_NOT_FOUND`
- la vecchia zona usa `MX 0 earningsites.net`, ma questo target non e' piu' coerente se l'apice `earningsites.net` serve il sito su Vercel
- Verificato tramite documentazione ufficiale Vercel che Vercel non offre hosting mailbox: il dominio puo' restare su Vercel per DNS/web, ma la posta va affidata a un provider esterno tramite record DNS.
- Raccolte opzioni attuali per semplificare la posta:
- forwarding gratuito via Cloudflare Email Routing
- mailbox custom-domain gratuita limitata via Zoho Mail (web-only, disponibilita' regionale non garantita)
- servizi forwarding dedicati come ImprovMX / Forward Email
- Definito il piano minimo-complessita' richiesto dall'utente:
- nameserver e zona DNS pubblica restano su Vercel
- il sito web principale resta su Vercel
- `aiblogs` e `n8n` tornano a puntare al VPS `87.106.29.31`
- la posta resta su Hobohost, ma con record mail ricreati nella zona Vercel
- in Hobohost non serve modificare la zona DNS pubblica; serve solo mantenere mailbox e routing mail locale
- Ricontrollato lo stato live dopo le correzioni:
- il resolver locale e `1.1.1.1` vedono entrambi `ns1.vercel-dns.com` e `ns2.vercel-dns.com`
- `https://earningsites.net` risponde da Vercel con redirect `307` a `https://www.earningsites.net/`
- `https://www.earningsites.net` risponde da Vercel con `200`
- i singoli IP attualmente pubblicati nella zona Vercel per apex e `www` rispondono tutti da Vercel, non da Hobohost

## Decisions
- Useremo questo task file per tutta la thread, come richiesto da `AGENTS.md`.
- La delega nameserver e' corretta al livello registry, ma la zona DNS attiva su Vercel e' incompleta per i sottodomini infrastrutturali (`aiblogs`, `n8n`) e manca dei record mail legacy.
- Il record `A` mantenuto su Hobohost non e' il source of truth futuro: influisce solo sui resolver che stanno ancora usando cache/delega vecchia.
- Se si vuole mantenere la posta su Hobohost e il web su Vercel, i record mail vanno gestiti nella zona Vercel puntando ai target Hobohost corretti; non basta lasciarli nella vecchia zona.
- Il record `webmail` puo' essere riallineato subito a `208.82.114.179`; per `MX` conviene usare un host mail dedicato (es. `mail.<dominio>` o hostname provider) e non l'apice `earningsites.net`.
- Se l'obiettivo e' ridurre complessita', il percorso piu' semplice e' non mantenere mailbox su Hobohost: usare o solo forwarding gratis oppure un provider mailbox dedicato e lasciare Vercel come solo DNS/web.
- Per questo task l'approccio scelto e' tenere Hobohost come host mail temporaneo e Vercel come DNS/web definitivo.
- In Hobohost e' opportuno impostare `Local Mail Exchanger` per `earningsites.net`, per evitare che il server mail tratti il dominio come remoto.
- A questo punto il vecchio sito visto sporadicamente e' piu' coerente con cache DNS/browser/rete lato client che con una configurazione pubblica ancora mista.
- Eliminare adesso i record della vecchia zona Hobohost non aiutera' a "disambiguare" il traffico pubblico; puo' solo togliere un fallback utile finche' qualche cache residua non e' sparita del tutto.

## Next
- Correggere nella zona DNS Vercel almeno:
- `aiblogs.earningsites.net -> 87.106.29.31`
- `n8n.earningsites.net -> 87.106.29.31`
- Correggere `webmail.earningsites.net` nella zona Vercel verso `208.82.114.179`.
- Recuperare da Hobohost i record esatti per mail esterna (`MX`, eventuale `mail`, SPF/DKIM/DMARC`) e ricrearli in Vercel.
- In alternativa, scegliere se:
- attivare forwarding gratuito
- migrare a mailbox dedicate su provider esterno e sostituire i record mail legacy
- Verificare in Vercel che `earningsites.net` e `www.earningsites.net` siano associati al progetto web corretto e che `aiblogs.earningsites.net` non sia aggiunto come custom domain a un progetto Vercel se deve restare sul VPS.
- Attendere la scadenza delle cache di delega residue e poi dismettere i record/hosting Hobohost non piu' necessari.
- Eseguire la checklist operativa:
- in Hobohost: verificare mailbox esistenti e `Email Routing = Local Mail Exchanger`
- in Vercel: correggere `aiblogs`, `n8n`, `mail`, `webmail`, `MX`, `TXT`
- testare `webmail`, ricezione mail, `aiblogs/portal` e `n8n`
- Attendere ancora 24-48 ore prima di rimuovere eventuali record web legacy da Hobohost o smantellare il vecchio WordPress.
- Se il vecchio sito compare ancora oltre la finestra cache, controllare DNS/VPN/private relay sul dispositivo interessato.

## Risks
- Fino alla scadenza della cache NS del parent `.net` alcuni resolver possono ancora interrogare Hobohost e mostrare il vecchio WordPress.
- Quando tutte le cache useranno Vercel, `aiblogs` e `n8n` smetteranno di funzionare correttamente finche' non verranno puntati al VPS invece che a Vercel.
- `webmail.earningsites.net` restera' intermittente o rotto finche' il relativo record Vercel non verra' corretto.
- Se usi email sul dominio, un `MX` che continua a puntare all'apice `earningsites.net` diventera' incompatibile con il sito ospitato su Vercel e puo' rompere il recapito.
- Qualche dispositivo o rete puo' ancora avere in cache vecchi record A/NS o usare DNS/VPN propri, mostrando il vecchio sito anche se la configurazione autorevole ormai e' corretta.
