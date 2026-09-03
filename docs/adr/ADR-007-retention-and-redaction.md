# ADR-007: Address, evidence, fixture, and observability retention and redaction

- **Status:** accepted
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-349, PLA-351
- **Review trigger:** a new data category is stored (screenshots, HAR, raw HTML); a legal or
  vendor term imposes a shorter ceiling; a deletion test fails; the HMAC key is rotated.

## Context

An exact residential address is sensitive even when it is public elsewhere. The system needs the
raw address only long enough to run provider jobs, and it needs sanitized evidence long enough to
explain a result. Everything else must be minimized, redacted, or excluded by construction. The
consented live test-address corpus (PLA-349) does not exist yet; its handling policy is defined
here and in [`docs/sources/test-address-corpus-policy.md`](../sources/test-address-corpus-policy.md).

## Decision

### Ceilings (maximums, not targets)

| Data                                         | Where                                   | Ceiling                                                              | Notes                                                                                  |
| -------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Raw address and unit (encrypted at rest)     | search record, server only              | delete when all jobs terminate; **hard maximum 24 h**                | never in URLs, logs, traces, metric labels, analytics, errors, client payloads         |
| Job payloads                                 | pg-boss `job` table                     | global search deadline plus retry window; history deleted after 24 h | payloads carry opaque identifiers only (ADR-006)                                       |
| Raw provider HTML/JSON containing an address | disabled by default                     | if enabled for debugging: encrypted, **hard maximum 24 h**           | `DEBUG_CAPTURE_ENABLED` gate, `DEBUG_CAPTURE_TTL_HOURS` ≤ 24 enforced by config schema |
| Screenshots / HAR / video                    | off by default                          | explicit debug mode only, encrypted, **hard maximum 24 h**           | never committed; `.gitignore` blocks common names                                      |
| Normalized address-specific offers and cache | keyed by HMAC identity                  | initially **7 days**                                                 | key is `v<version>:<hmac>`; rotation retires old entries                               |
| Redacted operational logs                    | log sink                                | initially **14 days**                                                | produced only through `@isp-search/observability`                                      |
| Aggregate non-PII metrics                    | metrics store                           | long-lived                                                           | dimensions limited to coarse market, provider, adapter version, outcome                |
| Sanitized fixtures                           | Git                                     | permanent                                                            | only after the fixture sanitation checklist and scanner pass                           |
| Consented live corpus                        | managed secret store outside Git/Linear | until consent is withdrawn; reviewed quarterly                       | opaque fixture IDs only in code, CI, and logs                                          |

### Address identity

Cache identity is a **versioned keyed HMAC-SHA256** over a canonicalized address including the
unit (`deriveAddressIdentity` in `packages/domain/src/address-identity.ts`), keyed by
`ADDRESS_HMAC_SECRET` (≥ 32 characters) with `ADDRESS_HMAC_KEY_VERSION` in the output. A plaintext
or unsalted hash is not a privacy mechanism because the address space is enumerable. Rotation
procedure: set a new secret and increment the version; old identities expire with their cache
entries; both versions may be computed during a bounded overlap window if needed.

### Redaction

All logging goes through `createLogger`, which redacts by key (address, street, unit, apt, zip,
cookie, set-cookie, token, secret, authorization, session, raw, payload, body, query,
coordinates, email, phone, and joined forms) and by value (street addresses with optional
city/state/ZIP, bearer tokens, JWTs, cookie headers, URL query strings, emails, phone numbers,
canary markers), including child bindings and error stacks. Public API errors collapse to a typed
code and safe metadata (`toSafeError`). These properties are enforced by canary tests that inject
recognizable fake addresses and secrets and assert they never appear in log output, serialized
errors, fixtures, or built client bundles.

### Fixtures

Committed fixtures are synthetic by construction: reserved street tokens, region `ZZ`, ZIP
prefix `000` (`packages/domain/src/synthetic.ts`). The scanner in `tooling/fixture-scan` rejects
real-looking addresses, units, coordinates, emails, phone numbers, cookie headers, provider
session fields, bearer tokens, JWTs, cloud keys, and HAR structures. See
[`docs/security/fixture-sanitation.md`](../security/fixture-sanitation.md).

### Deletion proof

M2 (PLA-362) implements the retention jobs; M5 (PLA-399) proves deletion end to end. Until then,
no raw address is persisted by any code path in this repository.

## Alternatives considered

- Plaintext SHA-256 of the address as cache key: rejected, trivially reversible by enumeration.
- Keeping raw provider responses for 30 days for debugging: rejected; the sanitized evidence hash
  and fingerprint are sufficient for explanation, and a 24 h encrypted debug window is enough for
  incident work.
- Storing search history per user: out of scope for V1 (no accounts).

## Evidence and official sources

OWASP Logging Cheat Sheet
(<https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>); vendor retention
terms recorded in ADR-002 (Google 30-day cap, Smarty perpetual Output Data); planning document
"Data Sources, Compliance, and Adapter Policy" (provisional ceilings, adopted here).

## Consequences

- Config schemas enforce the debug-capture ceiling and secret length at startup.
- Every new stored field must be classified against this table in its PR.
- Analytics (M4) may only use coarse geography.

## Unresolved risks

- Encryption-at-rest key management for the short-lived raw address is decided with the
  deployment topology (ADR-008, M5).
- Vendor-imposed expiries (Google) require the resolver output's `permitted_until` to be honoured
  by the cache; implemented in M2.
