# Task: fix-head-script-injection

## Goal
- Make portal-injected head scripts effective on the public site, including crawler-visible AdSense verification.

## Done
- Traced the monetization flow across portal, engine, and web and isolated the main issue: `headHtml` was injected only from a client component, so crawlers could miss it in the initial HTML response.
- Added a dedicated server-rendered `MonetizationHead` component in `apps/web` that converts the saved head snippet into real `<head>` nodes during SSR.
- Moved layout injection from `<body>` client effect to `<head>` server output in the public web app.
- Extended the engine public site settings endpoint to expose `monetization`, and updated the web overlay fetch so portal monetization remains effective even if Sanity lags or is temporarily unavailable.
- Ran `npm --workspace @autoblog/web run typecheck` and `npm --workspace @autoblog/engine run typecheck` successfully.
- Checked Git alignment on April 17, 2026 between local and production clone `/srv/auto-blog-project`: both `main` and `origin/main` resolve to `4e2f7d5d1d9b73942fa947a41c982eee53498054`, and the production clone is clean.

## Decisions
- `headHtml` must be crawler-visible in the server-rendered document head; client-only insertion is not sufficient for AdSense verification.
- The public web app should be able to overlay monetization settings directly from the portal public endpoint instead of relying exclusively on Sanity sync timing.

## Next
- Deploy/restart the updated web and engine runtimes, then verify on a live page with `View Source` that the AdSense `<script ...>` appears as a real tag inside `<head>`.
- Re-run Google AdSense site verification after the updated runtime is live.
- Decide whether to keep or discard the remaining local docs-only changes before expecting the local repo to be fully clean.

## Risks
- The new head parser is intentionally lightweight and optimized for common head snippets (`script`, `meta`, `link`, `style`, `noscript`); unusually complex nested markup should still be validated with a live smoke test.
- Repo source is updated, but runtime alignment still depends on deploying the new web and engine code to the environments used for verification.
- Local working tree is still dirty because of docs/task tracking files, so "clean and aligned" is true for committed code state but not for the local working tree.
