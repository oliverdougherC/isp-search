# Test layers

| Layer                       | Where                                                                                             | Network                                  | Database                         | Runs in                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------- | -------------------------------------- |
| Unit and contract           | `*.test.ts` in every package                                                                      | blocked (`tooling/vitest/no-network.ts`) | none                             | `pnpm test`, CI `checks`               |
| Boundary and scanner checks | `tooling/**/*.test.ts`                                                                            | blocked                                  | none                             | `pnpm test`, CI `checks`               |
| Integration                 | `packages/db/src/**/*.integration.test.ts`                                                        | loopback only                            | PostgreSQL (`DATABASE_URL_TEST`) | `pnpm test:integration`, CI `database` |
| Build-output scans          | `tooling/bundle-scan`, `tooling/fixture-scan`                                                     | none                                     | none                             | CI `checks`                            |
| Browser/product E2E         | not yet (M4)                                                                                      | loopback                                 | PostgreSQL                       | —                                      |
| Adapter fixture contracts   | `packages/providers` reference fixtures today; real fixtures in M3                                | blocked                                  | none                             | `pnpm test`                            |
| Live canaries               | not yet (M3); require explicit secrets and `ISP_SEARCH_TEST_NETWORK=true`; never on untrusted PRs | allowed                                  | —                                | manual / protected workflow            |

## Determinism rules

- Deterministic suites cannot open non-loopback sockets. A test that needs the network is a live
  canary and must be explicit about it.
- Clock and randomness: reference adapters take a `now()` function in their context; queue tests
  use per-process schema names to isolate runs.
- Database isolation: integration tests create a throwaway database (migration tests) or a
  throwaway pg-boss schema (queue tests) and drop it afterwards.

## Privacy canaries

`packages/observability/src/test-support.ts` defines recognizable fake values (a street line, a
unit, a secret, a cookie, a bearer token, a JWT, an email, a phone number). Tests inject them into
log messages, bound context, nested objects, error objects, and public error serialization and
assert that none appear in output. CI builds the web app with canary server secrets and scans the
client bundle for them. The fixture scanner's own tests prove it rejects the same canaries.

## Fixtures

See `docs/security/fixture-sanitation.md`. Reference fixtures cover: available, unavailable,
unit required, address ambiguous, timeout (deadline-driven), upstream changed (stale fingerprint),
malformed (invalid JSON).

## What "green" means

`pnpm verify` and `pnpm test:integration` both pass locally, and every CI job (`checks`,
`database`, `gitleaks`, `dependency-review`, CodeQL) is green on the pull request.
