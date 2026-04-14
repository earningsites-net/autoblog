# Task: add-disclaimer-page

## Goal
- Aggiornare il footer del `/portal` con link `Terms of use` e `Support`.

## Done
- Sostituito il vecchio footer `Support: info@earningsites.net` nella UI del portal.
- Aggiunti i link `Terms of use` verso `https://www.earningsites.net/terms` e `Support` verso `mailto:info@earningsites.net`.
- Verificato il markup finale tramite controllo del diff locale.

## Decisions
- La modifica resta localizzata al markup del footer del portal in `apps/engine/src/index.ts`.
- Il separatore visivo tra i link è testo inline semplice: ` | `.

## Next
- Verificare nel portal renderizzato che il footer mostri entrambi i link correttamente su desktop e mobile.

## Risks
- Nessun rischio tecnico rilevante; resta solo la verifica visiva del rendering.
