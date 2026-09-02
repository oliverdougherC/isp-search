# Round 1 handoff: M0 feasibility gate and M1 repository foundation

- **Date:** 2026-09-02
- **Linear:** PLA-359 (epic PLA-339); M0 epic PLA-338
- **Repository:** https://github.com/oliverdougherC/isp-search
- **Bootstrap commit on `main`:** `abded6dc3618f4c7546cef193b19ebf6cd431b05`
- **Validated tip (this branch, before this document was added):** `90a893e4c91f2ad57f6fae37e10011149f54efc3`

## Pull requests (all draft, stacked, none merged)

| PR                                                        | Branch                                     | Base   | Linear                            |
| --------------------------------------------------------- | ------------------------------------------ | ------ | --------------------------------- |
| [#1](https://github.com/oliverdougherC/isp-search/pull/1) | `feat/pla-355-queue-proof`                 | `main` | PLA-355, PLA-354, PLA-353 (fixes) |
| [#2](https://github.com/oliverdougherC/isp-search/pull/2) | `ci/pla-357-ci-governance`                 | #1     | PLA-357                           |
| [#3](https://github.com/oliverdougherC/isp-search/pull/3) | `docs/pla-344-351-m0-decisions`            | #2     | PLA-344 to PLA-351                |
| [#4](https://github.com/oliverdougherC/isp-search/pull/4) | `docs/pla-359-foundation-docs-and-handoff` | #3     | PLA-353, 354, 356, 358, 359       |

PR #1 has no workflow of its own (workflows arrive in #2); its commits are exercised by the CI runs
on #2, #3, and #4.

## CI evidence (final commits, 2026-09-02)

All six jobs green on #2 (`6cd09ad`), #3 (`5ba34bc`), and #4 (`90a893e`): format/lint/typecheck/unit
tests/build/scans, migrations and integration tests, gitleaks full history, dependency review, CodeQL
(two checks). The first runs exposed two defects, both fixed in the stack and re-run: `db:seed`
ran before a build, and boundary probe files were invisible to typescript-eslint when created after
its program was built on Linux.

## M0 result

`go with constrained launch` (see `docs/sources/m0-go-no-go.md`). Selected: Route C launch registry
(proposed markets Seattle–Tacoma–Bellevue and Raleigh–Cary, pending maintainer confirmation), Smarty
resolver with Census corroboration, all eleven providers `link_only`, retention ceilings per ADR-007.
Blocked: live provider adapters (ADR-004 amendment after qualified legal review or partner
agreement), consented test corpus (PLA-349, maintainer action), Route A/B licensing.

## Fresh-clone validation transcript (README only, clean directory, final tip)

```text
### fresh clone (run 3, final tip) 2026-09-02T23:27:51Z
HEAD=90a893e4c91f2ad57f6fae37e10011149f54efc3
### pnpm install
Done in 4s using pnpm v11.25.0
### pnpm env:init
$ node scripts/init-env.mjs
Wrote .env with a generated ADDRESS_HMAC_SECRET (file mode 600).
### pnpm db:up
 Container isp-search-postgres Healthy
### pnpm db:migrate
Using 'pg' driver for database querying
### pnpm build
 Tasks:    9 successful, 9 total
### pnpm db:seed
{"level":"info","name":"db-cli","count":4,"msg":"seeded reference providers"}
### pnpm db:status
{"level":"info","name":"db-cli","status":"ready","checks":{"connectivity":{"status":"ok","latencyMs":30},"migrations":{"status":"ok","applied":1,"expected":1}},"msg":"database readiness"}
### pnpm format:check
All matched files use Prettier code style!
### pnpm lint
 Tasks:    15 successful, 15 total
### pnpm typecheck
 Tasks:    15 successful, 15 total
### pnpm test
@isp-search/web:test:       Tests  1 passed (1)
@isp-search/observability:test:       Tests  12 passed (12)
@isp-search/config:test:       Tests  7 passed (7)
@isp-search/domain:test:       Tests  19 passed (19)
@isp-search/worker:test:       Tests  5 passed (5)
@isp-search/providers:test:       Tests  17 passed (17)
@isp-search/ui:test:       Tests  2 passed (2)
@isp-search/db:test:       Tests  3 passed (3)
@isp-search/tooling:test:       Tests  10 passed (10)
 Tasks:    15 successful, 15 total
### pnpm db:check
Everything's fine 🐶🔥
### pnpm test:integration
@isp-search/db:test:integration:  Test Files  2 passed (2)
@isp-search/db:test:integration:       Tests  9 passed (9)
 Tasks:    10 successful, 10 total
### pnpm scan:fixtures
fixture scan: clean (/private/tmp/claude-501/-Users-ofhd-Developer-isp-search/f4eaedd5-4250-426c-9faf-a8662c91bfe3/scratchpad/fresh-clone3/isp-search)
### pnpm scan:secrets
exit=0
### bundle scan for the local HMAC secret and dev DB password
bundle scan: scanned 10 client files, 0 hit(s)
### pnpm worker:health
{"level":"info","app_env":"development","name":"worker","status":"ready","checks":{"connectivity":{"status":"ok","latencyMs":29},"migrations":{"status":"ok","applied":1,"expected":1}},"msg":"worker he
### worker start + probes + SIGTERM
worker /health=200
worker /ready=200
"msg":"shutdown complete"
### web standalone (PORT=3200 because 3000 is taken by another local app) + probes
web /api/health=200
web /api/ready=200
web /=200
### gitleaks full history
4:29PM INF no leaks found
### tracked-file name scan (har, dumps, cookies, sessions, profiles, screenshots, env)
none
### history scan for raw addresses/cookies/sessions/bearer tokens (added lines, all commits)
+      `Set-Cookie: ${CANARIES.cookie}`,
(end history scan)
### done 2026-09-02T23:29:13Z
```

Notes on the transcript: the web server was started on port 3200 because port 3000 on the
validation machine is used by an unrelated local application; the shipped default remains 3000.
The local PostgreSQL host port is 55432 because the machine already runs a PostgreSQL on 5432.
The bundle scan searched the built client files for the freshly generated HMAC secret and the
development database password; CI additionally builds with canary secrets and scans for those.
The single history-scan hit is the redaction test that constructs a `Set-Cookie` header from a
canary value.

## Sensitive-data proof

- gitleaks over the full history: no leaks (CI job and local run).
- No tracked file matches HAR, dump, cookie, session, storage-state, profile, screenshot, image,
  or `.env` name patterns.
- `pnpm scan:fixtures` clean; `pnpm scan:secrets` exit 0; client bundle canary scan 0 hits.
- Every address in the repository is synthetic by construction (`packages/domain/src/synthetic.ts`);
  the research matrices contain only corporate contact emails and one corporate support number.

## Known limitations

- Nothing is merged; the maintainer reviews and merges the stack in order (#1 → #4).
- Branch protection rulesets were not configured through the API; see PLA-357 comment.
- Docker image builds (`apps/web/Dockerfile`, `apps/worker/Dockerfile`) are not built in CI.
- Linear temporary labels (`__*`, `test-create-project-placeholder`, `ISP Search — Version 1`,
  `ISP Search — Version 1 (Project Marker)`, `ISP Search V1 Foundation`) could not be deleted: the
  Linear connector exposes no label deletion and no authenticated browser session was available.

## Recommended Round 2 order

1. PLA-360 domain schemas, invariants, state machines (extend `packages/domain`).
2. PLA-361 PostgreSQL schema and migrations.
3. PLA-362 privacy-safe search sessions, HMAC cache keys, retention jobs.
4. PLA-366 provider directory and aliases (seed the launch registry providers).
5. PLA-365 `CandidateDiscovery` over `docs/sources/launch-matrix.json` + BDC area summaries.
6. PLA-363 `AddressResolver` (Smarty adapter behind the contract; live calls gated on PLA-349).
7. PLA-364 unit/subpremise and address-action handling.
8. PLA-367 orchestration on the proven queue; PLA-368 search API and polling; PLA-369 provenance
   and caching; PLA-370 reference adapters wired end to end; PLA-371 local E2E and M2 handoff.
9. In parallel, maintainer actions: confirm markets (ADR-001), commission legal review (ADR-004,
   ADR-003, ADR-002), create the corpus (PLA-349), request Smarty quotes.
