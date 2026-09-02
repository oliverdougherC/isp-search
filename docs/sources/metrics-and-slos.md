# V1 success metrics, SLO hypotheses, and release evidence

Linear: PLA-350. Every target below is a **hypothesis to validate**, not a promise. No metric
label, trace attribute, or analytics dimension may contain an address, unit, coordinates, or any
resolver/provider identifier that maps to a person. Allowed dimensions: `market_id`,
`provider_id`, `adapter_version`, `outcome`, `availability_state`, `resolver`, `search_state`,
`failure_class`, coarse latency buckets.

## Metric definitions

| Metric                                   | Numerator                                          | Denominator                              | Exclusions                           | Dimensions                                     |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| Address resolution success rate          | searches reaching `discovering_candidates`         | searches created                         | invalid input rejected at validation | market, resolver                               |
| Address action-required rate             | searches entering `address_action_required`        | searches created                         | —                                    | reason (ambiguous, unit missing, unit invalid) |
| Candidate-source success rate            | searches with ≥1 candidate                         | searches resolved inside a launch market | unsupported market                   | market                                         |
| Candidate precision (later, with corpus) | candidates confirmed by any provider check         | candidates listed                        | link-only providers                  | market, provider                               |
| Registry freshness                       | days since `last_reviewed`                         | —                                        | —                                    | market                                         |
| Adapter outcome distribution             | attempts per outcome                               | attempts                                 | —                                    | provider, adapter_version, outcome             |
| First-result latency                     | time from `created` to first terminal provider job | per search                               | searches with zero candidates        | market                                         |
| Completion latency                       | time from `created` to `complete`/`expired`        | per search                               | —                                    | market                                         |
| Partial-result rate                      | searches reaching `partial` before `complete`      | searches                                 | —                                    | market                                         |
| Deadline-miss rate                       | provider jobs expired by the global deadline       | provider jobs                            | —                                    | provider                                       |
| Offer normalization completeness (M3)    | offers with every required price component known   | offers                                   | link-only providers                  | provider                                       |
| Circuit-open providers                   | providers with open circuit at sample time         | enabled providers                        | —                                    | provider                                       |
| Raw-data deletion success                | retention job runs deleting all due rows           | retention job runs                       | —                                    | data class                                     |
| Supported-market search share            | searches inside a launch market                    | searches                                 | —                                    | market                                         |
| Official-link click-through              | clicks on official provider links                  | provider cards rendered                  | —                                    | provider, availability_state                   |

## SLO hypotheses (validate in M5)

| SLO                                                           | Hypothesis                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Application shell p95 after origin connection                 | < 1 s                                                       |
| Address resolution + candidate response p95 (warm)            | < 3 s                                                       |
| First verified provider result p95 (when live adapters exist) | < 10 s                                                      |
| Global search deadline                                        | 30–45 s, always returning completed partial results         |
| Web/worker readiness availability                             | 99.5 % monthly for the beta                                 |
| Raw-address deletion                                          | 100 % within ceilings (ADR-007)                             |
| Retry budget                                                  | transient outcomes: 3 attempts with backoff, 2 s → 30 s max |

## Adapter health thresholds and circuit conditions (M3)

Open a provider circuit when, over a rolling 15-minute window with ≥ 20 attempts: block + captcha
rate > 20 %, or parse_error + upstream_changed rate > 10 %, or timeout rate > 30 %, or the canary
fails twice consecutively. A circuit-open provider degrades to link-only immediately; closing
requires a passing canary and a maintainer acknowledgement.

## Launch sample size

Before public beta: ≥ 30 consented-corpus runs per market covering every corpus case; ≥ 200
synthetic searches through the full pipeline in staging.

## Release evidence matrix (consumed by M5)

| Evidence                                                                         | Where produced             |
| -------------------------------------------------------------------------------- | -------------------------- |
| Exact commands and outputs for format, lint, typecheck, unit, integration, build | PR description, CI logs    |
| CI links (checks, database, gitleaks, dependency review, CodeQL)                 | PR                         |
| Migration state (`pnpm db:status`)                                               | PR, deployment log         |
| Live E2E matrix results by opaque corpus ID                                      | staging run log (redacted) |
| Accessibility audit (WCAG 2.2 AA)                                                | M4 report                  |
| Privacy proof: canary tests, bundle scan, log samples                            | CI and staging             |
| Security: threat model checklist, CodeQL, dependency review                      | M5                         |
| Rollback and provider-disable demonstration                                      | runbook run log            |
