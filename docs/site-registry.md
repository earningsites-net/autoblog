# Site Registry

Registry file: `sites/registry.json`

## Purpose
- Track operational status per site in a single place.
- Support transfer-first and managed modes without changing code.
- Reduce manual context switching during sales and handoff.

## Entry Shape
- `siteSlug`
- `ownerType`: `internal | client`
- `mode`: `transfer | managed`
- `sanityProjectId`
- `sanityDataset`
- `tokenRefs.read`, `tokenRefs.write`
- `webBaseUrl`
- `domainStatus`: `pending | active | transferred`
- `automationStatus`: `inactive | active | paused`
- `billingStatus`: `n/a | trial | active | overdue | canceled`
- `updatedAt`

## Lifecycle
1. `autoblog launch-site` creates/updates the entry as `internal + transfer`.
2. During provisioning, update `sanityProjectId`, `webBaseUrl`, and statuses.
3. On sale close, switch `ownerType` to `client` and update transfer state.
4. If managed add-on is active, set `mode=managed` and maintain billing state.
