# Catalog operations

The catalog uses a cadence-aware dispatcher, resumable ingestion, and a separate enrichment queue. Registering an adapter in `src/lib/ingest/sources/index.ts` automatically adds it to scheduling; a source no longer needs its own Vercel cron entry. Existing `/api/cron/<source>` endpoints remain available for targeted recovery.

## Production configuration

Set `CRON_SECRET`, `INGEST_ENABLED=true`, `NEXT_PUBLIC_SUPABASE_URL`, and a server-only `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`). Individual opt-in providers still require their documented flags or credentials. Never expose service credentials with a `NEXT_PUBLIC_` prefix.

`INGEST_ENABLED` is the kill switch for every scheduled write route. Authentication is checked before the switch and before importing workers. All cron responses prohibit caching and search indexing. `/api/cron/status` remains available when ingestion is paused.

The schedule in `vercel.json` needs a Vercel plan that supports subdaily invocations. As of September 2026, Vercel documents 100 jobs per project on all plans, with Hobby restricted to once-daily jobs. See [Vercel's current limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Deploying the configuration activates the schedules on production; editing the file locally does not run jobs.

## Schedule (UTC)

| Job | Schedule | Work |
| --- | --- | --- |
| Dispatcher | Every 15 minutes | One due, configured source with a maximum 240-second budget |
| Enrichment | At minutes 3, 13, 23, 33, 43, 53 | Small summary/image batches with a maximum 240-second budget |
| Finalization | 00:05, 08:05, 16:05 | Publication gates, event status, series, enrichment enqueueing, catalog counts |
| Image license recheck | Daily at 04:07 | Reverify the 25 oldest checked Commons images |

Times are deliberately offset to reduce simultaneous load. Finalization has its own database lease, so duplicate invocations do not run concurrently. Sources retain their existing database leases. Enrichment uses atomic `FOR UPDATE SKIP LOCKED` claims.

The dispatcher honors hourly/daily/weekly/monthly source cadence, with Launch Library retaining its existing six-hour refresh to respect its free API quota. An incomplete pass is eligible again on the next dispatch tick. It does not wait for the normal weekly or monthly refresh. Never-run sources are handled first; other due sources rotate by their last attempt so one slow feed cannot monopolize dispatch. A paused provider is skipped without consuming database runs.

Vercel delivery is best effort and failed invocations are not automatically retried. The next dispatch reconciles database state and retries eligible work; exponential backoff prevents repeated upstream failures from becoming a tight loop. See [Vercel's delivery and concurrency guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Failure and deadline behavior

- Each successful unit checkpoints its cursor. A failed unit retains the previous checkpoint and enters exponential backoff, from one hour up to 24 hours. Already accepted rows can be safely replayed by the idempotent upsert RPC.
- Budget exhaustion retains the current unit, including when the first unit used the entire budget. Database chunk splitting stops when another bounded RPC would not fit. A deferred unit is retried with a fresh budget.
- A pass marks unseen source records stale only after every unit succeeds. Invalid or rejected rows stop the unit; a later slice cannot accidentally retire events that a failed earlier slice never fetched.
- Adapter HTTP requests bypass caches, honor per-host spacing and provider `Retry-After`, and include body consumption inside the deadline. A long requested retry is deferred instead of retried too early.
- Enrichment previews use a read-only queue query. They do not claim jobs or increment attempts. Untouched jobs from a normal batch are returned immediately and their claim attempts refunded using the original claim timestamp as a concurrency guard.
- Enrichment failures return HTTP 500 with their summary. Normal budget exhaustion is reported with `deferred` and `budget_exhausted`; it is not a provider failure.
- The image recheck runs small daily slices rather than leaving a growing catalog behind a once-monthly batch.

## Observe and recover

Send `Authorization: Bearer <CRON_SECRET>` to `/api/cron/status`. It reports source configuration, last success, next due time, health, resumable passes, recent runs, catalog freshness, and due/failed enrichment counts. Overall health can be `healthy`, `degraded`, `paused`, or `error`. Unconfigured optional providers are `disabled`; they do not produce missing-source alerts. A source that has never completed a pass is visible as `never-synced` until its first full pass finishes.

Investigate `stale`, `backoff`, failed enrichment jobs, or runs left `running` beyond ten minutes. Inspect the machine-readable `ingest_run`, `enrich_run`, `dispatch`, and `finalize` log entries alongside the stored `ingest_runs.errors`. `last_success_at` means a complete, successful source pass, not merely a successful slice.

Use these authenticated routes for focused operations:

- `/api/cron/<source>?dry=1&budget=120000` previews ingestion with no database writes.
- `/api/cron/enrich?dry=1&kind=wikipedia_summary` previews due summary jobs without changing the queue.
- `/api/cron/enrich?dry=1&kind=image&slug=<event-slug>` previews one image candidate.
- `/api/cron/<source>` resumes the stored checkpoint when eligible.
- `/api/cron/<source>?force=1` deliberately resets the source's pass and ignores backoff. Use only after diagnosing the failure.
- `/api/cron/finalize` refreshes the catalog after a manual import.

`?budget=` and environment budgets are clamped below the function timeout. For scheduled ingestion, reserve at least 60 seconds for database work and cleanup; very small diagnostic budgets may correctly return `partial` before a write can start. The CLI uses the same runner: `npm run ingest -- --source=<source> --dry-run`. Supply `REVALIDATE_URL` and `CRON_SECRET` when a normal CLI run should invalidate the deployed site cache.

## Local verification

Run `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Regression tests cover lease checkpoint races, preserved failed units, database deferrals, planner stalls, dry-run queue safety, refunded claims, source fairness, authentication, and finalization cleanup. Tests replace database and provider calls with fakes; they do not trigger production ingestion. The rebuild uses the existing database schema and does not require an operations migration.
