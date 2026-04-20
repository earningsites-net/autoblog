# Task: change-daily-beauty-lab-title

## Goal
- Capire perche il frontend di `daily-beauty-lab` mostra ancora il vecchio titolo pubblico e riallinearlo a `My Identity Beauty Lab`.

## Done
- Creata la task file della thread.
- Letta la issue GitHub `earningsites-net/autoblog#13` e raccolto il contesto iniziale.
- Verificato il source of truth corrente del titolo nel frontend:
  - `apps/web/src/lib/site.ts` privilegiava `NEXT_PUBLIC_SITE_NAME` rispetto a `brandName` del blueprint.
  - `apps/web/src/lib/site-settings.ts` non usa `siteSettings.siteName` per header/footer/metadata pubblici.
- Verificato il disallineamento reale sul sito `daily-beauty-lab`:
  - `sites/daily-beauty-lab/site.blueprint.json` contiene `brandName: "My Identity Beauty Lab"`.
  - `sites/daily-beauty-lab/.env.generated` conteneva ancora `NEXT_PUBLIC_SITE_NAME=Daily Beauty Lab`.
- Applicato il fix:
  - il web ora usa prima `brandName` del blueprint per `siteConfig.name`.
  - l'engine/factory status ora propone per Vercel il nome/description dal blueprint prima dell'env runtime.
  - `scripts/autoblog.mjs provision-env` aggiorna sempre i campi branding derivati dal blueprint (`NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_SITE_DESCRIPTION`).
  - riallineata la `.env.generated` locale di `daily-beauty-lab`.
- Aggiornati i riferimenti locali:
  - `sites/daily-beauty-lab/README.md` ora usa il nuovo brand.
  - `docs/context.md` e' stato aggiornato localmente per documentare il source of truth del brand pubblico, ma resta fuori da questa PR per evitare di includere cambi gia' presenti e non correlati nel worktree.
- Verifica eseguita:
  - `npm --workspace @autoblog/web run typecheck` OK
  - `npm --workspace @autoblog/engine run typecheck` OK

## Decisions
- Il source of truth del brand pubblico nel frontend resta `sites/<slug>/site.blueprint.json -> brandName`.
- `NEXT_PUBLIC_SITE_NAME` va trattato come env derivato/bootstrap legacy: puo' servire al deploy, ma non deve prevalere sul blueprint.
- `siteSettings.siteName` in Sanity non rinomina da solo il frontend pubblico attuale; un brand rename richiede comunque blueprint + riallineamento deploy/runtime.

## Next
- Riallineare il deploy production/Vercel di `daily-beauty-lab` con il nuovo output:
  - aggiornare l'env production se contiene ancora `NEXT_PUBLIC_SITE_NAME=Daily Beauty Lab`
  - rieseguire il deploy del web
  - verificare header, footer e metadata sul sito live

## Risks
- Finche' il deploy production attivo non viene ricostruito con il nuovo codice o con env riallineata, il sito live puo' continuare a mostrare il vecchio titolo.
