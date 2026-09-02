# Architecture overview

ISP Search is a pnpm/Turborepo monorepo with two deployable applications and six internal
packages. The design goal is truthfulness over apparent completeness: every displayed fact carries
its source, retrieval time, and confidence, and `unknown` is a valid result.

## Runtime topology

```text
browser ──HTTP──▶ apps/web (Next.js 16, App Router)
                    │  POST /api/searches (M2)   GET /api/health, /api/ready
                    │  creates search + enqueues jobs in ONE transaction
                    ▼
                PostgreSQL 18 ◀──── pg-boss queue (schema `pgboss`)
                    ▲                        │
                    │ results, evidence      │ fetch/complete/fail
                    │                        ▼
                apps/worker (Node 24, long-running; Playwright confined here)
                    GET /health, /ready ; SIGTERM → graceful drain
```

- **No provider automation inside request handlers.** The web app only creates work and reads
  results; the worker talks to external systems.
- **PostgreSQL is the only stateful service in V1.** The job queue is pg-boss (ADR-006); Redis is
  not installed.
- **Polling-first API.** The client polls an opaque search resource (M2); streaming is deferred.

## Packages and boundaries

| Package                     | Role                                                                                                                                                  | May import                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `@isp-search/domain`        | pure vocabulary: availability states, adapter outcomes, search states, structured address, synthetic conventions, HMAC identity (server-only subpath) | `zod`, `node:crypto` only                                     |
| `@isp-search/config`        | typed environment schemas (`.` public, `./server` server-only)                                                                                        | `zod`                                                         |
| `@isp-search/observability` | PII-safe logger, redaction, correlation IDs, safe errors                                                                                              | `pino`                                                        |
| `@isp-search/db`            | Drizzle schema, migrations, health/readiness, seed, pg-boss wrapper (server-only)                                                                     | domain, config, observability, `pg`, `drizzle-orm`, `pg-boss` |
| `@isp-search/providers`     | adapter contract, registry, reference adapters, synthetic fixtures                                                                                    | domain, `zod` (never db)                                      |
| `@isp-search/ui`            | accessible React components                                                                                                                           | domain, `react`                                               |
| `@isp-search/web`           | Next.js UI and API                                                                                                                                    | config, db, domain, observability, ui (never worker)          |
| `@isp-search/worker`        | job processing, health surface, browser policy                                                                                                        | everything server-side, `playwright`                          |
| `@isp-search/tooling`       | repository checks                                                                                                                                     | domain, observability, `eslint`                               |

Boundaries are enforced three ways: ESLint `no-restricted-imports` rules per path (with
`tooling/boundaries` tests proving each rule fires), package `exports` with a `browser` condition
that maps server-only entries to a throwing module, and a post-build scan of the client bundle for
canary secrets. Web client code lives under `_client/` directories or `*.client.tsx` files so the
lint rule can target it.

`packages/observability` exists as a separate package because the logger and redaction are needed
by `db`, `web`, `worker`, and `tooling`; placing them in `domain` would pull `pino` into browser
code, and placing them in `config` would conflate configuration with output.

## Build and type system

- TypeScript 5.9 strict with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`; project references with `tsc -b` per package
  emitting `dist/` with declaration maps. Each package has `tsconfig.json` (build, excludes tests)
  and `tsconfig.test.json` (typecheck and lint, includes tests and config files).
- Turborepo tasks: `build` depends on `^build`; `typecheck`, `lint`, and `test` depend on
  `^build` so consumers see real declaration files. Strict env mode: tasks only see declared
  variables.
- ESLint 9 flat config with typescript-eslint strict-type-checked and stylistic-type-checked,
  `eslint-plugin-import-x` ordering, Next.js and react-hooks plugins in the web app. (ESLint 10 is
  not yet supported by `eslint-plugin-react`, which Next's config depends on.)
- Vitest 4 per package; deterministic suites load `tooling/vitest/no-network.ts`, which makes
  every non-loopback socket connection throw unless `ISP_SEARCH_TEST_NETWORK=true`.

## Data flow invariants

1. Address enters via `POST`; the response is an opaque search ID (M2).
2. The resolver (ADR-002) normalizes the street and preserves the unit as an application-owned
   field; an unresolved address never reaches a provider.
3. Candidate discovery (ADR-003) returns providers plus evidence class and scope from the versioned
   launch registry; area-level evidence is never "verified".
4. Jobs are enqueued transactionally with idempotency keys; failure classes map to bounded retry
   budgets (ADR-006).
5. Adapter outcomes are mapped centrally to user-facing states (ADR-005).
6. Raw addresses expire under ADR-007; logs, errors, metrics, and bundles are redacted or scanned.

## What is not built yet

Search API and orchestration (M2), real provider adapters and label parsing (M3), product UX (M4),
deployment topology and ADR-008 (M5). The home page says so.
