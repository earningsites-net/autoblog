# Task: fix-plan_generation_scheduler_worker-flow

## Goal
- Fix the `plan_generation_scheduler_worker` refill path so `Run discover-topics refill` no longer fails when `daily-beauty-lab` needs new `brief_ready` topics.

## Done
- Reproduced the incident locally by running `node scripts/autoblog.mjs discover-topics daily-beauty-lab --count 60 --status brief_ready --source suggest --replace` twice in a row.
- Confirmed the original failure mode:
  - first run generated only `16` candidates
  - second run failed with `Error: No topic candidates discovered for 'daily-beauty-lab'`
- Expanded the synthetic discovery fallback in `scripts/autoblog.mjs` with semantically distinct angle variants instead of mostly format-only rewrites.
- Changed `discover-topics` CLI behavior so `0` new candidates writes empty topic mutations and exits successfully instead of throwing.
- Updated `apps/engine/src/services/factory-ops.ts` to:
  - detect empty `topic-candidates.mutations.json`
  - skip Sanity apply when there is nothing to write
  - return a successful no-op payload with note instead of surfacing HTTP 400
- Verified locally after the fix:
  - repeated `discover-topics` runs no longer fail immediately
  - refill regenerated `60` candidates on the first rerun from the failing state
  - a subsequent rerun still generated `28` additional candidates instead of crashing
- Ran `npm --workspace @autoblog/engine run typecheck` successfully.
- Investigated a separate live regression reported after the scheduler fix: n8n UI login failing with `Problem logging in / Request failed with status code 500`.
- Compared the suspected task history:
  - `docs/tasks/add-new-content-to-existing-site.md`
  - `docs/tasks/recurring-firewall-problems.md`
- Verified from production runtime state over SSH:
  - `autoblog-n8n.service` is up
  - `/etc/autoblog/n8n.env` still contains expected n8n auth/proxy settings (`N8N_HOST`, `N8N_PROTOCOL`, `WEBHOOK_URL`, `N8N_EDITOR_BASE_URL`, `N8N_ENCRYPTION_KEY`, `N8N_BASIC_AUTH_*`, `N8N_PROXY_HOPS=1`)
  - the n8n container logs repeated auth failures caused by Postgres filesystem errors, not by proxy/login config
- Confirmed the live root cause of the login `500`:
  - n8n auth queries fail because Postgres returns `could not open file "global/pg_filenode.map": Permission denied`
  - postgres logs also show repeated `Permission denied` on runtime files/directories like `pg_logical/snapshots`
  - inside the postgres container the DB process runs as `postgres` (`uid=70`)
  - the mounted data dir `/var/lib/postgresql/data` is owned by host uid/gid `1000:1000` (`autoblog:autoblog`) with mode `700`
  - this mismatch is sufficient to explain the live login regression
- Narrowed the likely regression source:
  - the recent scheduler/discover-topics code changes do not touch n8n login, proxy auth, or Postgres runtime
  - `recurring-firewall-problems` mainly changed Tailscale/nginx/firewall posture
  - `add-new-content-to-existing-site` is the most suspicious thread because it explicitly records ownership corrections under `/srv/auto-blog-project/infra/n8n`, where the production Postgres bind mount still lives
- Repaired the live n8n login regression in production:
  - stopped `autoblog-n8n`
  - restored ownership of `/srv/auto-blog-project/infra/n8n/postgres` to container uid/gid `70:70`
  - restarted `autoblog-n8n`
  - verified healthy restart: Postgres reports `database system is ready to accept connections` and n8n reports `Editor is now accessible via: https://n8n.earningsites.net`
  - confirmed the auth path no longer dies with `500`: the login endpoint now returns application-level validation errors on bad payloads instead of Postgres permission failures
- Investigated the follow-up report that `plan_generation_scheduler_worker` was "not starting anymore":
  - production workflow `plan_generation_scheduler_worker` is active in n8n as workflow id `hV5sUOLtf4ih8wLP`
  - fresh executions proved the workflow was still starting:
    - scheduled trigger execution `41162` at `2026-04-16 21:00:35 CEST`
    - manual webhook execution `41163` at `2026-04-16 21:01:26 CEST`
  - both failed on the old production engine with the same historical `Run discover-topics refill` `400` (`No topic candidates discovered for 'daily-beauty-lab'`)
- Deployed the refill fix to production:
  - committed and pushed `main` as `3015c15` (`Handle empty topic refill gracefully`)
  - on VPS production, verified clean clone state and updated `/srv/auto-blog-project` with `git fetch origin` + `git pull --ff-only origin main`
  - restarted `autoblog-engine`
  - verified engine health on `http://127.0.0.1:8787/healthz`
- Verified the live scheduler path after deploy:
  - direct production call to `POST /api/factory/site/discover-topics` for `daily-beauty-lab` now succeeds again
  - the endpoint generated and applied `60` `brief_ready` topic mutations in production (`Transaction: C6Tof5mjTvwXcWUxnLn8qB`)
  - post-deploy manual scheduler webhook execution `41164` completed with `status=success`

## Decisions
- Keep the fix in the source-of-truth discovery path (`scripts/autoblog.mjs` + engine factory endpoint), not in n8n-only workflow logic.
- Treat exhausted discovery as a graceful no-op for the factory API instead of a scheduler-breaking error.
- Keep the scheduler workflow template unchanged: the existing `Build no-op report` path can already surface the new success/no-op response from the engine.
- Treat the n8n login incident as a separate production runtime regression in the Postgres bind mount permissions, not as a consequence of the scheduler refill fix.
- The most plausible historical trigger is an ownership correction applied too broadly under `/srv/auto-blog-project/infra/n8n`, likely during the `add-new-content-to-existing-site` activity; the firewall/Tailscale work is not the primary suspect for this specific `500`.
- Treat `/srv/auto-blog-project/infra/n8n/postgres` as runtime state with container-owned permissions, not as source tree content that should be mass-chowned to `autoblog:autoblog`.
- Treat the current scheduler incident as a production rollout gap, not a trigger regression in n8n: the workflow was firing, but the engine on the VPS had not yet received the refill fix.

## Next
- Observe the next due automatic production tick for `plan_generation_scheduler_worker` to confirm the scheduled path now stays green without manual triggering.
- If `daily-beauty-lab` starts exhausting the broader pool again, widen the site blueprint seed topics rather than relaxing dedupe.
- Retest n8n UI login interactively now that the runtime stack is healthy again.
- Prevent recurrence by excluding `infra/n8n/postgres` from broad source ownership fixes under `/srv/auto-blog-project`.

## Risks
- `daily-beauty-lab` still has a fairly narrow editorial seed set; the broader synthetic generator increases runway but does not make the topic space infinite.
- Local verification ran without live Sanity reads (`fetch failed` in this sandbox), so the exact production mix/count can differ once remote existing topics/articles are included in dedupe.
- The Postgres data dir is production runtime state; any future recursive `chown`/permission repair under `infra/n8n` can break n8n login again if it touches the bind mount.
- `PLAN_SCHEDULER_TICK_MINUTES=60` means the scheduler does useful work on hourly ticks; intermediate schedule wakes can still be valid no-op runs.
