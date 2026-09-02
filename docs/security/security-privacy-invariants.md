# Security and privacy invariants

These invariants are enforced by code, tests, or CI. A change that weakens one requires an ADR.

## Data handling

1. No raw address or unit appears in application-controlled URLs, ordinary logs, traces, metric
   labels, analytics, public API errors, committed fixtures, snapshots, screenshots, or database
   seed data. Enforced by `@isp-search/observability` redaction, canary tests, the fixture
   scanner, and the client-bundle scan.
2. Addresses are submitted by `POST` and referenced afterwards only by an opaque search ID.
3. Address cache identity is a versioned keyed HMAC (`ADDRESS_HMAC_SECRET`, ≥ 32 chars). Never a
   plaintext or unsalted hash.
4. The raw address is retained encrypted only until provider jobs terminate, hard maximum 24 h
   (ADR-007). Debug capture of payloads, screenshots, HAR, or video is opt-in and TTL-bounded
   (≤ 24 h) by the config schema.
5. Job queue payloads contain identifiers only (ADR-006).

## Configuration and secrets

6. Every process validates its environment at startup and fails with an actionable error before
   doing work (`packages/config`). Error messages never echo values.
7. Server-only modules are unreachable from client bundles: `browser` export conditions map them to
   a module that throws, `assertServerRuntime` guards execution, ESLint forbids the imports from
   client code, and CI scans built client bundles for canary secrets.
8. `.env` is git-ignored; `.env.example` contains no real value. Secret scanning runs locally
   (secretlint) and in CI (gitleaks over full history, GitHub secret scanning with push protection).

## External integrations

9. No CAPTCHA solving or bypass, proxy rotation, fingerprint spoofing, rate-limit or WAF evasion,
   or automation of authenticated customer accounts. Blocks degrade to typed outcomes and an
   official link.
10. Live provider adapters are gated by ADR-004; the adapter registry rejects live tiers unless
    explicitly allowed and every provider can be downgraded to link-only by configuration.
11. Provider content is untrusted input. Outbound destinations will be allowlisted (M2) and
    redirects validated before being shown.
12. Playwright is confined to `apps/worker`; browser contexts are isolated, never persist cookies
    or storage state, and never record unless debug capture is enabled.
13. No LLM in the availability, offer, pricing, or truth path.

## Supply chain and CI

14. Node and pnpm are pinned; dependency lifecycle scripts run only for an explicit allowlist
    (`allowBuilds`).
15. GitHub Actions run with `contents: read` by default; jobs request additional permissions
    explicitly. No production or provider secret exists in CI.
16. Dependency review, CodeQL, gitleaks, secretlint, and the fixture scanner run on every pull
    request. Dependabot opens pull requests but never merges.
17. Nothing merges automatically. Draft PRs require green CI and maintainer review.
