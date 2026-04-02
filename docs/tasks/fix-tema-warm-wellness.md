# Task: fix-tema-warm-wellness

## Goal
- Correggere il tema `warm_wellness` eliminando CTA inadatte a un blog, riallineando il loader alla palette e rimuovendo incoerenze visive o di copy.

## Done
- Impostato il task attivo per il lavoro sul tema `warm_wellness`.
- Rimossi copy e CTA da sito vetrina/clinic nel recipe `warm_wellness` su header, hero magazine, homepage e category cards.
- Riallineato il loader del tema a un gradiente rosato coerente con `warm_wellness` e colorato lo spinner con accento rosa.
- Uniformati gli override visivi di `about`, `categories` e `contact` al linguaggio del tema (`rounded-xl`, bordi `rose`, superfici rosate invece di `bg-paper` generico).
- Aggiornata la descrizione footer wellness verso un tono più editoriale.
- Allineato il preset generativo `warm_wellness` a una palette rosata in `scripts/autoblog.mjs`.
- Aggiornato il blueprint esistente `sites/glowlab-daily/site.blueprint.json` alla stessa palette per eliminare il verde fuori tema.
- Verificato `npm --workspace @autoblog/web run typecheck` con esito positivo.
- Verificato `npm --workspace @autoblog/web run build` con esito positivo nel setup corrente del workspace.
- Diagnosticato il motivo per cui il test locale continuava a mostrare il sito luxury:
  - `apps/web/.env.local` era ancora pinzato a `lux-living-01` e sovrascriveva `.env`
  - `localhost:3000` era occupato da un processo esterno (`vite`) in un altro workspace
- Esteso `npm run site:use -- <site-slug>` per sincronizzare anche `apps/web/.env.local`, non solo root `.env` e `apps/studio/.env`.
- Eseguito `npm run site:use -- glowlab-daily` con esito positivo per riallineare gli env locali del web.
- Corretto il cache degli articoli nel web locale:
  - in dev `getPublishedArticles()` ora bypassa `unstable_cache`
  - in production la chiave cache include slug sito, progetto/dataset Sanity, base URL contenuti e blueprint path
- Verificato di nuovo `npm --workspace @autoblog/web run typecheck` con esito positivo dopo il fix cache.
- Corretto il sidebar block `Internal Links / Related reading` nelle pagine articolo:
  - usa i `internalLinks` editoriali se presenti
  - se sono vuoti o insufficienti, li integra con articoli correlati già risolti dal sistema
  - evita duplicati e l'articolo corrente
- Verificato `npm --workspace @autoblog/web run typecheck` con esito positivo dopo il fix del sidebar links fallback.
- Rifinito il copy del blocco sidebar articolo: `Related reading` -> `Read next`.

## Decisions
- Normalizzato l'id del task utente in `fix-tema-warm-wellness` per rispettare il formato kebab-case del repo.
- Corretto il problema di palette in due punti: override CSS del loader per il runtime attuale e preset/blueprint rosati per evitare che il mismatch si ripresenti nei futuri siti `warm_wellness`.
- Sostituiti i blocchi “indicatori/appointment/visit” con elementi editoriali da blog invece di metriche o CTA da servizio.
- `site:use` deve essere la fonte unica di verità anche per il frontend locale Next; se `apps/web/.env.local` resta scollegato, il sito mostrato può appartenere a un altro slug anche con `.env` corretto.
- In locale non conviene cacheare gli articoli con `unstable_cache` durante gli switch sito: il feedback corretto vale più del micro-ottimizzare la dev experience.
- Per l'MVP il blocco `Internal Links` non deve dipendere solo dal popolamento CMS: se manca il linking editoriale, il frontend deve ripiegare su articoli correlati già disponibili.

## Next
- Verificare visualmente `glowlab-daily` in locale o preview con `SITE_SLUG=glowlab-daily` quando l'ambiente può risolvere i font Google.
- Valutare se spostare i font usati da `next/font/google` a una strategia locale/self-hosted per evitare build bloccate in ambienti senza rete.
- Chiudere o spostare il processo esterno che occupa `127.0.0.1:3000`, poi riavviare Auto Blog con `npm run dev:up -- --fresh`.
- Verificare manualmente uno switch completo `glowlab-daily -> ai-blog-news` con restart del web, controllando che tema e articoli restino allineati allo stesso progetto/slug.
- Valutare se applicare la stessa logica di fallback anche in fase di generazione contenuti, così il CMS riceve `internalLinks` già pronti e il frontend resta solo consumer.

## Risks
- Il build mirato con `SITE_SLUG=glowlab-daily` fallisce in sandbox per fetch esterno di Google Fonts (`fonts.googleapis.com`), quindi la verifica specifica del sito warm non è completa in questo ambiente offline.
- Anche con gli env corretti, se `localhost:3000` resta occupata da un altro progetto locale si continua a vedere l'app sbagliata e il test del tema risulta fuorviante.
- Se il web resta acceso mentre si modifica `.env.local`, serve comunque riavviare il dev server Next per riallineare client Sanity, `siteConfig` e redirect config.
