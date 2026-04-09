# Task: ads-management

## Goal
- Replace the AdSense-specific monetization model with a provider-agnostic monetization system based on head code plus targeted placement embeds.

## Done
- Active task switched to `ads-management`.
- Replaced the AdSense-specific settings model with a shared provider-agnostic `monetization` object across factory SDK, portal store, engine API, web frontend, runtime registry, and Sanity schema.
- Replaced `PATCH /api/portal/sites/:siteSlug/ads` with `PATCH /api/portal/sites/:siteSlug/monetization` and updated the portal Monetization tab to use `enabled`, `providerName`, `headHtml`, and advanced target-based placements.
- Removed legacy AdSense columns/fields from Postgres bootstrap and portal/site settings normalization; runtime sync now writes a non-sensitive monetization summary to the registry and the full `monetization` object to Sanity.
- Replaced the public-site AdSense renderer with generic `MonetizationHead` and `MonetizationSlot` components that inject head code once and rerun embedded scripts inside placement HTML.
- Updated legal-page ad detection, sample registry data, seed mutations, and factory/bootstrap scripts to the new monetization model.
- Fixed a static-to-dynamic runtime regression uncovered by smoke testing by changing public site runtime-state fetching to use production revalidation instead of `no-store`.
- Fixed a portal access regression where the Monetization textarea placeholders injected literal `</script>` inside the inline portal script, causing `Unexpected end of input` in the browser; the placeholders are now HTML-escaped.
- Refined the portal Monetization UI by making the `Enable monetization` checkbox use natural width and simplifying the provider hint copy.
- Fixed a Vercel web build regression caused by the recent monetization/legal-page refactor: `apps/web` now declares `@autoblog/factory-sdk` in its own `package.json`, so workspace resolution matches the new imports during isolated app builds.
- Verified with `npm run typecheck`, `npm --workspace @autoblog/engine run typecheck`, `npm run build:web`, and a local smoke on `/`, `/categories/beauty-tips-hacks`, and `/articles/natural-beauty-tips-everyday-radiance-mneuejrg2hkm`.
- Strengthened editorial workflow guardrails so `brief_generation_worker` and `article_generation_worker` always produce English output even when the topic mentions another language/culture (for example `in Hindi`), and re-imported the updated workflows into local n8n.
- Verified the local refill architecture path: scheduler/topic refill uses engine `POST /api/factory/site/discover-topics` -> `scripts/autoblog.mjs`, while `topic_discovery_daily` remains a legacy/minimal template; aligned local root `.env` so engine-side discovery now has `OPENAI_API_KEY` available for the selector path too.
- Confirmed that `npm run sanity:cleanup -- --site-slug <slug> --include-topics` is not topic-only: it also deletes `article`, `qaLog`, and `generationRun`, so it must not be used for queue-only resets.
- Reverted the temporary `--topics-only` flag and related docs after the reported bad outcome; the repo no longer advertises or supports that cleanup path.
- Hardened `scripts/sanity-cleanup.mjs` to fail on unknown arguments, so removed flags like `--topics-only` cannot be silently ignored and fall back to destructive default behavior.
- Investigated current production `ops/factory` access flow:
  - the browser auth prompt uses `FACTORY_UI_USERNAME` + `FACTORY_UI_PASSWORD`
  - the in-page `Factory API secret` field uses `FACTORY_API_SECRET`
  - production currently has all three variables configured, so `FACTORY_API_SECRET` alone is not sufficient for the browser HTTP Basic prompt
- Investigated the local `Factory Ops` login flow after a repeated browser auth prompt report:
  - `/ops/factory` is gated by HTTP Basic Auth with `FACTORY_UI_USERNAME` and `FACTORY_UI_PASSWORD`, falling back to `FACTORY_API_SECRET` only when `FACTORY_UI_PASSWORD` is empty
  - after the page loads, the in-page `Factory API secret` field is still required separately for `x-factory-secret` on `/api/factory/*`
  - the current repo `.env` sets `FACTORY_UI_USERNAME=admin` and defines both `FACTORY_UI_PASSWORD` and `FACTORY_API_SECRET`
- Reproduced the current `Factory Ops` button no-op bug and isolated it to a browser parse failure in the inline script:
  - the `shellEscape()` helper inside `/ops/factory` rendered invalid JavaScript (`missing ) after argument list`)
  - the broken inline script prevented event listeners from being attached to `Launch Site`, `Create Only`, and `Check Status`
  - replaced that helper with a JS-safe `JSON.stringify(...)` implementation and re-validated the extracted route script with `node --check`
- Rolled out the Factory inline-script hotfix to production with commit `3d3176c` and verified:
  - `GET /healthz` still returns `ok:true`
  - authenticated `GET /ops/factory` serves a script body that now passes `node --check`
- Investigated the Vercel web build failure on commit `3d3176c`:
  - production build failed on `Module not found: Can't resolve '@autoblog/factory-sdk'` from `apps/web/src/lib/legal-pages.ts`
  - local `next build` still passed, so the break was specific to Vercel's `Root Directory = apps/web` monorepo resolution
  - fixed `apps/web/next.config.ts` by adding `transpilePackages: ['@autoblog/factory-sdk']` and `outputFileTracingRoot` to the repo root
  - re-ran local `npm --workspace @autoblog/web run build` successfully after the config change
- Confirmed the remaining Vercel-specific requirement: with `Root Directory = apps/web`, the project must allow source files outside that directory in the build step or the app cannot resolve monorepo packages from `/packages/*` even if local builds succeed.
- Identified the actual regression boundary more precisely:
  - the first breaking change is `2739b25`, where `apps/web` started importing runtime helpers/types from `@autoblog/factory-sdk`
  - for this Vercel setup, that coupling is what reopened deploy fragility even after package.json and next.config fixes
- Applied the least invasive recovery:
  - copied the legal-content helper into `apps/web/src/lib/legal-content.ts`
  - replaced `apps/web` imports from `@autoblog/factory-sdk` with local web-owned helpers/types in:
    - `apps/web/src/lib/legal-pages.ts`
    - `apps/web/src/lib/site-settings.ts`
  - removed the last monorepo-coupling residues from `apps/web/next.config.ts` and app-level package resolution so the web app no longer relies on `@autoblog/factory-sdk` at build/runtime
  - re-ran `cd apps/web && npm run build` successfully

## Decisions
- Remove the AdSense legacy model instead of keeping a compatibility layer.
- Use a generic `monetization` object with `enabled`, `providerName`, `headHtml`, and target-based placement embeds.
- Keep the initial placement target set fixed to `homeLead`, `homeMid`, `categoryTop`, `articleTop`, `articleSidebar`, and `articleBottom`.
- Treat monetization code as trusted owner-provided HTML/script: no sanitization layer is added in this iteration.
- When a workspace app imports another internal package at runtime, that dependency must also be declared in the app-local `package.json`; local hoisting is not enough for Vercel/isolated workspace builds.
- Treat non-English mentions inside topics/keywords as subject matter to explain in English, not as a signal to switch article/brief output language.
- Treat n8n workflow instance-added settings metadata (`executionOrder`, `binaryMode`, `callerPolicy`, `availableInMCP`) as non-blocking local drift; workflow nodes/connections remain aligned with repo source.
- For Factory Ops support, distinguish clearly between UI auth credentials and API secret; they are separate in production when `FACTORY_UI_PASSWORD` is explicitly set.
- For local debugging, treat a repeated browser Basic Auth prompt as a process/config mismatch first: the engine reads `.env` only at startup, and `apps/engine/src/load-local-env.ts` does not override already-exported environment variables in the running shell/process.
- For Factory Ops command previews, shell quoting does not need to be shell-perfect POSIX; it must first be valid browser JavaScript and copyable by the operator.
- For `apps/web` on Vercel, declaring an internal workspace dependency in `package.json` is not enough by itself; Next also needs explicit monorepo package handling in `next.config.ts`.
- For this repo's current deployment model, `apps/web` should not depend on runtime helper imports from `packages/factory-sdk`; shared logic is acceptable only when the deploy target can reliably consume the whole monorepo.
- For the current Vercel setup, the safest fix is full web self-containment, not additional monorepo resolution workarounds.

## Next
- If needed, add product-level guidance or tooling for provider prerequisites outside the current scope: `ads.txt`, CMP/consent mode, exclusivity checks, and onboarding validation.
- Consider adding targeted smoke fixtures with sample monetization snippets so head injection and placement rendering can be asserted automatically in CI.
- If topic clustering still feels too repetitive after the engine env sync, tune `scripts/autoblog.mjs` selector/category-balancing heuristics or expose the selector mode explicitly in the factory API/UI instead of relying only on env defaults.
- After topic queue cleanup, re-run `discover-topics` and then `prepopulate` with a higher total target if more published articles are desired.
- If queue-only reset is still needed, implement a safer deletion path only after reproducing the failure mode and adding an explicit verification step against the exact mutation payload.
- If Factory Ops continues to feel opaque, simplify the operator flow by either:
  - reusing `FACTORY_API_SECRET` as the UI password
  - or adding explicit copy/help text that explains `Basic Auth != Factory API secret`
- If the local login issue persists after restart, verify the running engine process and browser auth cache before rotating secrets in `.env`.
- Restart the local engine and roll the Factory fix to production so `/ops/factory` serves the corrected inline script in both environments.
- After restart, verify the Factory page by checking that clicking `Check Status` changes the in-page `Status` line before testing full `Launch Site`.
- Push the web self-containment fix and redeploy the Vercel project.
- After redeploy, verify that legal pages and category pages still build correctly on Vercel without any direct `packages/*` runtime imports.

## Risks
- `apps/engine/src/index.ts` already has unrelated local modifications in the worktree, so future edits in the portal UI layer still need care.
- The platform now intentionally executes owner-provided third-party monetization code on the public site; misconfigured snippets can still break layout or violate provider requirements even though the integration surface is generic.
- Local n8n still contains legacy duplicate workflows by name, so name-based inspections in the UI can look misleading; the canonical active workflows should be tracked by ID.
- The current Factory Ops production UX depends on remembering two distinct credentials; this is easy to misapply and looks like a broken login even when the server is behaving correctly.
- Local browser auth debugging is opaque: stale exported env vars, a non-restarted engine, or cached browser Basic Auth credentials all surface as the same repeated login modal.
- The Factory page is rendered as one large inline script; a single malformed helper string can silently disable the whole UI while leaving the HTML apparently intact.
- Local `npm --workspace @autoblog/web run typecheck` can still fail on stale `.next/types/*` references even when `next build` is healthy; for this issue the build result is the relevant verification signal.
- Vercel Root Directory isolation can override otherwise-correct monorepo code/config and present as a plain `Module not found` error during webpack compile.
- If the web app reintroduces direct runtime imports from `packages/*`, the same Vercel regression can recur even when local `next build` stays green.
