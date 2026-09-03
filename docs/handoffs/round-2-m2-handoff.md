# Round 2 handoff: M2 search core

- **Date:** 2026-09-03
- **Linear:** PLA-371 (epic PLA-340); Round 2 base recorded in the project update of 2026-09-03
- **Round 2 base `main`:** `f6f3035cc0315841cc34493d7bde3151a57ef613` (Round 1 stack merged #1→#4,
  fresh-clone validated, CI green)
- **Repository:** https://github.com/oliverdougherC/isp-search

## Pull requests (all draft, stacked on `main`, none merged)

| PR                                                          | Branch                                 | Linear                      |
| ----------------------------------------------------------- | -------------------------------------- | --------------------------- |
| [#6](https://github.com/oliverdougherC/isp-search/pull/6)   | `feat/pla-360-361-domain-and-db`       | PLA-360, PLA-361            |
| [#7](https://github.com/oliverdougherC/isp-search/pull/7)   | `feat/pla-362-privacy-retention`       | PLA-362                     |
| [#8](https://github.com/oliverdougherC/isp-search/pull/8)   | `feat/pla-366-365-directory-discovery` | PLA-365, PLA-366            |
| [#9](https://github.com/oliverdougherC/isp-search/pull/9)   | `feat/pla-363-364-resolver-actions`    | PLA-363, PLA-364            |
| [#10](https://github.com/oliverdougherC/isp-search/pull/10) | `feat/pla-367-orchestration`           | PLA-367 (completes PLA-364) |
| [#11](https://github.com/oliverdougherC/isp-search/pull/11) | `feat/pla-368-search-api`              | PLA-368                     |
| [#12](https://github.com/oliverdougherC/isp-search/pull/12) | `feat/pla-369-provenance-cache`        | PLA-369                     |
| [#13](https://github.com/oliverdougherC/isp-search/pull/13) | `feat/pla-370-reference-adapters-ui`   | PLA-370                     |
| [#14](https://github.com/oliverdougherC/isp-search/pull/14) | `docs/pla-371-e2e-handoff`             | PLA-371 (this document)     |

## What M2 delivers

A user can, locally and deterministically: submit an address through the product UI or API;
have it represented through the application address contract (ADR-002); resolve ambiguity and
unit questions; receive supported-market candidates from the versioned launch registry
(ADR-003 Route C); watch parallel provider qualification jobs execute through deterministic
reference adapters; see partial results as providers finish; receive verified-available,
verified-unavailable, likely/reported, unknown, action-required, timeout, blocked, and
malformed-source states with ADR-005 truth semantics enforced centrally; see normalized
plans/offers/pricing/provenance from reference data (unknown values stay unknown, never zero);
and have every privacy and retention invariant enforced (opaque 256-bit ids, POST-only intake,
versioned HMAC identity, AES-256-GCM raw material with early deletion and hard ceilings,
count-only deletion audit).

**Still true after this round:** no live provider adapter exists or is approved (ADR-004); no
live resolver call occurred (Smarty is config-gated off; PLA-349 corpus pending); the active
launch registry is the synthetic development market; the proposed Seattle–Tacoma–Bellevue and
Raleigh–Cary markets remain `proposed` and are structurally prevented from importing as
approved.

## Search-state and reference-adapter matrix

| Provider (synthetic registry) | Scenario                                | Job state at completion | User-facing availability (basis)                   |
| ----------------------------- | --------------------------------------- | ----------------------- | -------------------------------------------------- |
| reference-available           | verified available, 3 offers            | succeeded               | verified_available (provider_qualification)        |
| reference-unavailable         | explicit unavailable                    | succeeded               | verified_unavailable (provider_qualification)      |
| reference-link-only           | candidate only, no adapter              | — (no job)              | likely_available (candidate_evidence)              |
| reference-ambiguous           | address ambiguous → user choice         | succeeded after resume  | verified_available after resume; likely if expired |
| reference-unit-required       | unit required → user choice             | succeeded after resume  | verified_available after resume                    |
| reference-timeout             | timeout ×(budget+1)                     | degraded                | likely_available (evidence); never unavailable     |
| reference-rate-limited        | rate limited then retry success         | succeeded               | verified_available                                 |
| reference-blocked             | blocked (WAF-style)                     | degraded                | likely_available; official link                    |
| reference-malformed           | parse_error                             | degraded                | likely_available; maintenance signal               |
| reference-conflicting         | explicit unavailable vs likely evidence | succeeded               | verified_unavailable; evidence retained/shown      |
| reference-slow                | finishes ~3 s after peers               | succeeded               | verified_available (progressive visibility)        |
| reference-late                | finishes after global deadline          | expired                 | likely_available; late result discarded            |

Pricing matrix exercised by reference offers: fiber/cable/fixed-wireless; advertised and
typical speed bases; symmetric and asymmetric; introductory pricing with month ranges; known
and unknown post-promotion price; recurring and one-time fees; conditional discounts with the
conditions surfaced; included vs optional equipment; data cap and no cap; contract + early
termination fee and no contract; Broadband Facts label present and missing; unknown
taxes/variable fees.

## Fresh-clone E2E gate (PLA-371)

- **Executed:** 2026-09-03, fresh clone at `d251ffd1336a5b938e0cbcdbb1e20f9cf4a53cb3` (tip of
  PR #13; this document and two hardening fixes from the gate's findings are the only later
  commits). Local overrides for the run: `PORT=3300`, `WORKER_HEALTH_PORT=3101`,
  `SEARCH_DEADLINE_SECONDS=25`, `SEARCH_TTL_MINUTES=2` (this machine's 3000/3100 are taken;
  short deadline/TTL make the late-result and expiry scenarios observable in minutes).

| #   | Gate item                                          | Result                                                                                                                                                          |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Documented dependency install                      | PASS — `pnpm install` 2.8 s (pnpm 11.25.0, pinned Node 24 toolchain)                                                                                            |
| 2   | PostgreSQL starts, migrations apply                | PASS — 4 migrations applied to empty db; `db:status` ready; `db:generate` no-op                                                                                 |
| 3   | Web and worker become ready                        | PASS — worker `/health` + `/ready` ~2 s; web `/api/ready` ok                                                                                                    |
| 4   | Deterministic search created                       | PASS — 201, opaque 43-char id, state `qualifying`                                                                                                               |
| 5   | Ambiguity and unit actions                         | PASS — provide_unit (epoch 0→1; replay → 409), select_candidate, correct_input, and both provider-level questions resumed to `succeeded`/`resumed_after_action` |
| 6   | Candidates from the registry abstraction           | PASS — 12 providers, market `synthetic-zz` (`dev-2026.09.0`, development_only), BDC vintage + completeness statement present                                    |
| 7   | Provider jobs run in parallel                      | PASS — snapshots show queued/running/succeeded coexisting under concurrency 4                                                                                   |
| 8   | Full reference outcome matrix                      | PASS (see note 2)                                                                                                                                               |
| 9   | Polling exposes progressive state                  | PASS — multiple `partial` snapshots; finished providers stayed visible through actions                                                                          |
| 10  | Normalized offers and provenance render            | PASS — 3 offers with components, unknowns as unknown, full provenance                                                                                           |
| 11  | One provider failure hides nothing                 | PASS — blocked/malformed degraded beside verified results                                                                                                       |
| 12  | Global deadline yields truthful partial completion | PASS — `complete` exactly at `deadlineAt`; late delivery logged `late_discard`                                                                                  |
| 13  | Raw-address retention/expiry behaves as designed   | PASS — material row 0 at completion; 404 for unknown/malformed ids; 410 at TTL; leak canary 0 after sweep; no duplicate job rows                                |
| 14  | All deterministic tests pass                       | PASS — integration 80/80                                                                                                                                        |
| 15  | Format/lint/typecheck/build pass                   | PASS — `pnpm verify` 20 s (144 unit tests), build 10.7 s                                                                                                        |
| 16  | Fixture, secret, bundle, PII scans pass            | PASS — fixtures clean, secretlint clean, bundle scan 11 files 0 hits, gitleaks no leaks                                                                         |
| 17  | CI on the final draft PR stack                     | PASS — all six checks green on PRs #6–#14                                                                                                                       |

Rate-limit proof: a burst of 15 submissions returned exactly 10×201 then 5×429
(`rate_limited`, retryable). Log privacy: `grep -c 'Synthetic Way\|Fixtureville'` over worker
and web logs = 0; log lines carry identifiers and typed outcomes only.

Transcript notes (full transcript retained by the gate run):

1. `pnpm scan:bundle` without arguments prints usage and exits 2 — the script expects canary
   arguments (CI supplies them). Run locally as CI does, it scanned 11 client files with 0 hits.
2. Under the shortened 25 s deadline, `reference-timeout` and `reference-rate-limited` ended
   `expired` rather than `degraded`/`succeeded`: their retry backoff outlasted the deadline, so
   the sweep expired them while queued — the correct deadline semantics. Under the default 40 s
   deadline the same scenarios settle as `degraded` (timeout budget exhausted) and `succeeded`
   (retry success), as proven by the worker integration suite.
3. Qualification-cache reuse: re-submitting the same address settled the positive providers
   instantly (`qualification_cache_reuse`) with the original observation time; negative and
   failure outcomes are deliberately not reused in M2.
4. The display tier of an expired search is wiped by the 5-minute scheduled sweep; between
   expiry and the sweep the API already serves 410 and the column canary reads nonzero until
   the sweep runs (structural, per ADR-007 tiers).
5. Two hardening defects found and fixed in this PR: `scripts/with-env.mjs` now forwards
   SIGTERM/SIGINT/SIGHUP to its child (previously a supervisor signalling the wrapper orphaned
   the worker), and the shared pg pool now handles idle-client errors so a database restart
   degrades readiness instead of crashing the process.

## Validation totals

| Layer                       | Count        | Where                                                                                                                                          |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/contract (`pnpm test`) | 144          | 27 files, 11 packages — domain 60, providers 18, discovery 12, observability 12, tooling 10, resolver 9, db 8, config 7, worker 5, ui 2, web 1 |
| Integration (PostgreSQL)    | 80           | db 55 (migrations, queue, schema constraints, retention, actions, registry, caches), worker 14 (orchestration), web 11 (API contract)          |
| Product E2E                 | 10 scenarios | fresh-clone gate above (S1–S10) + manual browser verification of the UI flows                                                                  |
| **Total automated**         | **224**      | plus CI: gitleaks, secretlint, fixture scan, bundle canary scan, dependency review, CodeQL                                                     |

## Privacy/PII audit

- Canary tests (observability, retention, API): raw address and unit never appear in logs,
  serialized errors, API URLs, queue payloads, metric-style fields, or expired database rows;
  the only intentional exposure is the `displayAddress` field served to the id-holder before
  expiry.
- Worker logs from the live E2E run contain zero address content (grep-proven).
- `pnpm scan:fixtures`, `pnpm scan:secrets`, client-bundle canary scan, and gitleaks (full
  tree) are clean. One gitleaks false positive (`offerKey` fixture slugs) was allowlisted with
  a line-targeted regex.
- Raw-address lifecycle: deleted at all-jobs-settled, at unsupported-market completion, and by
  the ceiling sweep under crashed workers; display tier wiped at search expiry; deletion audit
  stores counts and opaque ids only.

## Candidate registry behavior and market configuration

- Active registry (development): `dev-2026.09.0`, synthetic market `synthetic-zz`,
  `development_only`, 12 reference providers.
- Imported inactive for directory review: `2026.09.0-proposed` (Seattle–Tacoma–Bellevue CBSA
  42660, Raleigh–Cary CBSA 39580) — status `proposed`; schema refinements reject a synthetic
  market outside a development registry and an approved market inside a non-approved registry.
  Activating a real matrix is `importRegistry(..., { activate: true })` after maintainer
  confirmation — a data change, no domain/API contract change.
- Unsupported markets return the boundary disclosure and the FCC map home link; no address
  ever enters a URL.

## Live-call statement

No live resolver call and no live provider call occurred in Round 2. The Smarty adapter
refuses to run while `SMARTY_ENABLED=false` (default) or unconfigured, and its HTTP mapping is
deliberately unwritten until the consented corpus (PLA-349) and credentials/terms exist.
Reference adapters refuse non-synthetic addresses, and the reference tier resolves to an empty
adapter set in production unless `ALLOW_REFERENCE_ADAPTERS=true` is set deliberately.

## Remaining blockers (unchanged from M0, maintainer-owned)

1. **PLA-344 / PLA-349:** consented live test-address corpus (secret store + consent records);
   ten-location storefront comparison for the candidate-source decision.
2. **Launch markets:** confirm or replace the proposed markets (ADR-001).
3. **Live adapters (PLA-376–378):** blocked until ADR-004 is amended after qualified legal
   review or a partner agreement (first candidates: Ziply Fiber, Brightspeed).
4. **Resolver contract:** Smarty quote/credentials and Google-terms review (ADR-002).
5. Route A/B licensing questions (ADR-003) for any future exact candidate source.

## Recommended Round 3 (M3) issue order

1. PLA-372 — finalize the ProviderAdapter SDK and centralized outcome mapping (the reference
   SDK is proven; formalize what real adapters must add: fixture contracts, fingerprints).
2. PLA-375 — Broadband Facts label discovery and HTML-first parsing from the public static
   assets (Brightspeed CSV, T-Mobile HTML/XLSX) — permitted today, network-gated in CI.
3. PLA-373 — lossless plan/offer/pricing normalization (extends the M2 offer model).
4. PLA-374 — explainable effective-cost calculations.
5. PLA-380 — provider fixture contracts, parser fingerprints, upstream-change detection.
6. PLA-379 — optional machine-readable label ingestion (watch PLA-382 for the FCC 26-48
   effective date).
7. PLA-381 — live canaries, health scoring, automatic circuit breakers (schema hooks exist).
8. PLA-376/377/378 — only after the maintainer unblocks ADR-004; until then keep every real
   provider link-only.

Prerequisites for the first live adapter: PLA-349 corpus provisioned; ADR-004 amended for the
chosen provider; conservative rate limits and kill switch verified (both already exist in the
orchestrator); sanitized fixture checklist applied to the first captures.
