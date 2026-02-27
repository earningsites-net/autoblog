# Runbook (MVP Operations)

## Daily Checks (5-10 min)
- Confirm n8n is reachable and workflows ran in the last 24h.
- Check `budget_monitor_and_alerts` mode and publish quota.
- Verify new articles appear on homepage/category pages.
- Spot-check one published article for image, metadata, and disclaimer.

## Weekly Checks
- Review `rejected_auto` patterns (common QA flags).
- Refresh/adjust topic seeds for seasonality (optional).
- Verify Search Console indexing and crawl issues.
- Check VPS disk usage (`n8n` and Postgres volumes).

## Incident Handling
### AI provider failure
- Disable image/text workflow temporarily.
- Switch to backup provider/model in env vars.
- Re-run failed workflow batches.

### Sanity API failure/token expired
- Rotate token, update n8n env, restart container.
- Re-run backlog workers (`brief`, `article`, `image`, `qa`).

### Frontend revalidate errors
- Check `WEB_REVALIDATE_SECRET` and `WEB_APP_URL`.
- Test with `curl` to `/api/revalidate`.
- Fallback: full redeploy on Vercel.

## Backups
- Postgres volume snapshot daily.
- Export n8n workflows weekly.
- Keep Sanity schema repo under git (this repo).
