# ADR-006: PostgreSQL-backed job queue (pg-boss)

- **Status:** accepted
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-355
- **Review trigger:** sustained throughput above what a single PostgreSQL can absorb for job
  polling; a requirement for cross-region workers; pg-boss loses maintenance; an at-least-once
  redelivery bug surfaces in production.

## Context

The search core needs one job per (search, provider, adapter version), created in the same
transaction as the search record, with bounded retries by failure class, a global deadline,
dead-letter inspection without PII, crash recovery, and graceful shutdown. The project rule is
"PostgreSQL first": no Redis or external broker unless PostgreSQL is shown to be insufficient.

## Decision

Use **pg-boss 12.29.0** through the `JobQueue` wrapper in `packages/db/src/queue/index.ts`.
Redis is **not** installed.

Proof cases executed against PostgreSQL 18 by
`packages/db/src/queue/queue.integration.test.ts` (run with `pnpm test:integration`):

| Contract requirement                            | How it is met                                                                                                                                                                                                                                                                                                                                                               | Test                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Transactional enqueue with the search row       | `send(..., { db: { executeSql } })` bound to the caller's `pg` client; rollback leaves no job, commit leaves one                                                                                                                                                                                                                                                            | "enqueues inside the caller transaction"                            |
| Idempotency per search/provider/adapter version | queue policy `exclusive` + `singletonKey = searchId:providerId:adapterVersion`; a duplicate send returns `null` while the key is queued or active                                                                                                                                                                                                                           | "is idempotent per search/provider/adapter version"                 |
| Bounded retries with backoff, by failure class  | queue `retryLimit`, `retryDelay`, `retryBackoff`, `retryDelayMax` bound every job uniformly; `retryLimitForOutcome` maps `classifyRetry` to per-outcome budgets (unit-tested) but is wired into the runtime by M2 orchestration (PLA-367), which completes jobs with typed outcomes instead of failing them — until then a job a worker fails retries regardless of outcome | "retries a failed job with backoff and dead-letters it" + unit test |
| Dead-letter inspection without PII              | `deadLetter` queue receives exhausted jobs; payload is identifiers only (`QualificationJobData` never carries an address)                                                                                                                                                                                                                                                   | same                                                                |
| Worker crash / at-least-once                    | `expireInSeconds` + supervision (`superviseIntervalSeconds`, `monitorIntervalSeconds`) fail a stuck active job into `retry` for another worker                                                                                                                                                                                                                              | "re-delivers an active job whose worker crashed"                    |
| Graceful shutdown                               | `stop({ graceful: true, timeout, close: true })`; worker drains on SIGTERM/SIGINT with a hard grace period                                                                                                                                                                                                                                                                  | `apps/worker/src/main.ts`, verified manually (see PLA-355 comment)  |
| Global deadline / late results                  | `deadlineAt` in the payload; the reference adapter returns `timeout` past it; M2 orchestration discards late work                                                                                                                                                                                                                                                           | reference adapter test; orchestration in PLA-367                    |
| Scheduled expiry/retention                      | `retention-sweep` singleton queue registered; jobs defined in M2 (PLA-362)                                                                                                                                                                                                                                                                                                  | —                                                                   |

Important finding: with pg-boss's default `standard` policy, `singletonKey` alone does **not**
deduplicate; it only debounces inside a `singletonSeconds` slot. The `exclusive` policy provides
"at most one queued-or-active job per key", which is the idempotency this project needs. This is
encoded in the wrapper and documented here so nobody re-introduces `standard`.

Operational tables live in the `pgboss` schema (configurable via `JOB_QUEUE_SCHEMA`) and are
created and migrated by pg-boss itself on `start()`; application migrations never touch them.
Job history is deleted after 24 hours for the qualification queue and 7 days for the dead-letter
queue.

## Alternatives considered

- **Redis + BullMQ.** Mature, but adds a second stateful system, a second failure domain, and
  breaks transactional enqueue with the search row. Rejected for V1.
- **Graphile Worker.** Also PostgreSQL-backed and transactional; fewer built-in policies
  (singleton/exclusive keys, dead-letter) than pg-boss 12. Viable fallback if pg-boss is dropped.
- **Hand-rolled `SELECT ... FOR UPDATE SKIP LOCKED` table.** Full control but re-implements retry,
  expiry, and supervision that pg-boss already provides and tests.

## Evidence and official sources

pg-boss documentation (<https://pgboss.io/api/constructor>, `/api/queues`, `/api/jobs`,
`/api/workers>`, fetched 2026-09-02), the package's type definitions and `plans.js` unique indexes
(inspected locally to confirm policy semantics), and the integration test output recorded in the
PLA-355 Linear comment.

## Consequences

- `apps/web` enqueues through `JobQueue.enqueueQualification` inside the search transaction (M2).
- `apps/worker` runs `boss.work` with `localConcurrency = WORKER_CONCURRENCY` and provider-level
  limits added in M2/M3.
- Job payloads are identifiers only; the raw address is loaded by the worker from the encrypted,
  TTL-bound search record (ADR-007), never carried in the queue.
- The queue's `retryCount` is incremented on fetch, not on `fail`; tests assert state transitions
  rather than counters.

## Unresolved risks

- Supervision intervals default to 60 s; a crashed worker's job is redelivered roughly one
  supervision interval after `expireInSeconds`. M2 must set `expireInSeconds` per adapter deadline
  and tune supervision for the global search deadline.
- pg-boss is maintained by a single maintainer; a fork or migration to Graphile Worker is the
  documented fallback.
