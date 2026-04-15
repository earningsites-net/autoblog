# Task: add-disclaimer-page

## Goal
- Rifinire alcuni link del `/portal`, incluso il footer e la sezione monetization.

## Done
- Sostituito il vecchio footer `Support: info@earningsites.net` nella UI del portal.
- Aggiunti i link `Terms of use` verso `https://www.earningsites.net/terms` e `Support` verso `mailto:info@earningsites.net`.
- Verificato il markup finale tramite controllo del diff locale.
- Rimosso il link `Site status JSON` dalla sezione monetization del portal.

## Decisions
- La modifica resta localizzata al markup del footer del portal in `apps/engine/src/index.ts`.
- Il separatore visivo tra i link è testo inline semplice: ` | `.
- Il link tecnico `Site status JSON` viene rimosso dalla UI portal per semplificare l'interfaccia owner-facing.

## Next
- Verificare nel portal renderizzato che il footer mostri entrambi i link correttamente su desktop e mobile.
- Verificare che la sezione monetization mantenga allineamento e spaziatura corretti senza il link rimosso.

## Risks
- Nessun rischio tecnico rilevante; resta solo la verifica visiva del rendering.
