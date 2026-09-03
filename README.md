# ISP Search

Address-level US internet provider discovery and price comparison with explicit provenance and
privacy-safe search. This repository is the **engineering foundation** for a public beta. It is
public from the first commit so that every decision, test, and privacy control is reviewable.

> **Status: foundation (M1).** There is no live address search, no real provider integration,
> and no nationwide coverage claim. What exists is listed below; nothing else should be assumed.

## What exists today

| Area                                                                                                                      | State                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Domain vocabulary (availability states, adapter outcomes, search states, address contract)                                | Implemented and tested in `packages/domain`                                       |
| Versioned keyed-HMAC address identity for future cache keys                                                               | Implemented and tested (`@isp-search/domain/address-identity`)                    |
| Typed environment schemas with fail-fast startup validation                                                               | Implemented in `packages/config`                                                  |
| Structured PII-safe logging, redaction, opaque correlation IDs, safe errors                                               | Implemented and canary-tested in `packages/observability`                         |
| PostgreSQL schema, explicit Drizzle migrations, health and readiness checks, seed                                         | Implemented in `packages/db`                                                      |
| PostgreSQL-backed job queue (pg-boss): transactional enqueue, idempotency, bounded retries, dead-letter, crash redelivery | Implemented and proven by integration tests in `packages/db`; decision in ADR-006 |
| Provider adapter contract, registry with kill switch, deterministic reference adapters                                    | Implemented in `packages/providers`; **no live provider adapters**                |
| Next.js web shell with `/api/health` and `/api/ready`                                                                     | Implemented in `apps/web`                                                         |
| Long-running worker with health/readiness HTTP surface and graceful shutdown                                              | Implemented in `apps/worker`                                                      |
| Network-disabled deterministic tests, fixture PII/secret scanner, client-bundle canary scan, import-boundary tests        | Implemented in `tooling/`                                                         |

Planning, milestones, and issues live in the Linear project
[ISP Search](https://linear.app/platinum-labs/project/isp-search-f03fc61c15a2). Architecture
decisions live in [`docs/adr`](docs/adr/README.md). The M0 feasibility result is
[`docs/sources/m0-go-no-go.md`](docs/sources/m0-go-no-go.md): **go with constrained launch** (bounded
launch markets, no live provider adapter approved yet, resolver selected, consented corpus pending).

## Requirements

- Node.js **24.20.0** (pinned in `.node-version`; pnpm downloads it automatically via `devEngines`)
- pnpm **11.25.0** (pinned in `package.json#packageManager`; Corepack or a global pnpm ≥ 11.25 will switch to it)
- Docker with Compose v2 (local PostgreSQL 18)

## Quick start

```bash
git clone https://github.com/oliverdougherC/isp-search.git
cd isp-search
pnpm install            # also downloads the pinned Node 24.20.0 into the workspace
pnpm env:init           # writes .env from .env.example with a generated HMAC secret
pnpm db:up              # starts PostgreSQL 18 in Docker (host port 55432) and waits for it
pnpm db:migrate         # applies the committed SQL migrations (never implicit)
pnpm build              # builds every package (tsc project references + next build)
pnpm db:seed            # inserts the synthetic reference providers
pnpm db:status          # readiness: connectivity + migrations applied
pnpm dev                # web on http://localhost:3000, worker health on http://localhost:3100
```

Health and readiness:

| Endpoint                               | Meaning                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `GET http://localhost:3000/api/health` | web process is up                                              |
| `GET http://localhost:3000/api/ready`  | web can reach PostgreSQL and all migrations are applied        |
| `GET http://localhost:3100/health`     | worker process is up                                           |
| `GET http://localhost:3100/ready`      | worker can reach PostgreSQL, migrations applied, queue started |
| `pnpm worker:health`                   | one-shot worker readiness probe (exit code 0 = ready)          |

## Verification

| Command                 | What it does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `pnpm format:check`     | Prettier over the whole repository                                                     |
| `pnpm lint`             | ESLint 9 with typed rules and package boundary rules                                   |
| `pnpm typecheck`        | `tsc --noEmit` per package, including tests                                            |
| `pnpm test`             | deterministic unit and contract tests; outbound network is disabled                    |
| `pnpm test:integration` | tests that need PostgreSQL (`DATABASE_URL_TEST` from `.env`)                           |
| `pnpm db:check`         | Drizzle migration consistency check                                                    |
| `pnpm build`            | production build of every package and the web app                                      |
| `pnpm scan:fixtures`    | rejects real-looking addresses, units, cookies, tokens, and session fields in fixtures |
| `pnpm verify`           | format check, lint, typecheck, test, and build in sequence                             |

See [`docs/local-development.md`](docs/local-development.md) and [`docs/testing.md`](docs/testing.md).

## Repository layout

```text
apps/web            Next.js App Router UI and search API surface
apps/worker         long-running Node worker (the only package allowed to depend on Playwright)
packages/domain     pure domain schemas, states, invariants; no I/O
packages/config     typed environment schemas, split by runtime; server-only subpath
packages/observability  PII-safe logger, redaction, correlation IDs, safe errors
packages/db         Drizzle schema, migrations, health/readiness, seed, pg-boss queue wrapper
packages/providers  adapter contract, registry, reference adapters, synthetic fixtures
packages/ui         accessible shared React components
tooling             repository checks (network guard, fixture scanner, bundle scanner, boundaries)
docs                architecture, ADRs, sources, security policies, runbooks
```

## Privacy and security invariants

- No raw address or unit in application-controlled URLs, ordinary logs, traces, metric labels,
  analytics, public API errors, committed fixtures, snapshots, screenshots, or seed data.
- Address cache identity is a **versioned keyed HMAC**, never a plaintext or unsalted hash.
- Provider content is untrusted input. No CAPTCHA bypass, proxy rotation, fingerprint evasion,
  or automation of authenticated customer accounts, ever.
- Committed fixtures are synthetic by construction and scanned automatically.

The full list is in [`docs/security/security-privacy-invariants.md`](docs/security/security-privacy-invariants.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
