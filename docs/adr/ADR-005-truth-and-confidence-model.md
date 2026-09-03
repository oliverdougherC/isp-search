# ADR-005: Truth and confidence model

- **Status:** accepted
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-351 (confirms the model in the planning document "Product, Truth Model, and Architecture")
- **Review trigger:** a new evidence class is introduced (for example a licensed location-level
  source under ADR-003 Route A); a provider adapter returns an outcome not in the vocabulary; a
  user-facing state is proposed that is not listed here.

## Context

The product's value is that it never overstates what it knows. Regional or stale evidence must
never be presented as address-level verification, and a failure to verify must never become
"unavailable". The planning documents define the vocabulary; this ADR confirms it and binds the
implementation to it.

## Decision

1. **User-facing availability states** are exactly: `verified_available`, `verified_unavailable`,
   `reported_available`, `likely_available`, `unknown`. Implemented as `AvailabilityState` in
   `packages/domain/src/availability.ts`.
2. **Adapter execution outcomes** are exactly: `available`, `unavailable`, `address_ambiguous`,
   `unit_required`, `unsupported_market`, `captcha`, `blocked`, `rate_limited`, `timeout`,
   `upstream_changed`, `parse_error`, `invalid_response`, `unknown`. Implemented as
   `AdapterOutcome`.
3. **One centralized mapping** (`mapOutcomeToAvailability`) converts outcomes into states. Adapters
   cannot invent confidence semantics. Invariants, each covered by a test:
   - only `unavailable` yields `verified_unavailable`;
   - only `available` yields `verified_available`;
   - every other outcome yields `unknown`;
   - candidate evidence without provider qualification yields at most `reported_available`
     (licensed location-level source) or `likely_available` (area-level, label, generic page) and
     never a verified state (`mapCandidateEvidenceToAvailability`).
4. **Evidence priority** (`EVIDENCE_PRIORITY`): provider qualification (1), provider label (2),
   licensed location-level data (3), area-level reported (4), official generic page (5). Higher
   priority never erases disagreement; contradictions are retained and displayed.
5. **Negative-evidence rule:** absence is not unavailability. Under ADR-003 Route C there is no
   negative evidence in V1 at all.
6. **Retry classification** (`classifyRetry`): explicit results and user actions are never retried;
   `timeout` and `rate_limited` are retried within a bounded budget; `captcha`, `blocked`,
   `upstream_changed`, `parse_error`, `invalid_response` open a maintenance signal and are not
   retried.
7. **Search and provider-job states** are as declared in `packages/domain/src/search-state.ts`;
   `partial` and `complete` describe orchestration, not availability.
8. Every displayed fact carries source, retrieval time, adapter/parser version, and a confidence
   state. `unknown` is a valid product result and is labelled "This is not a no".

## Alternatives considered

- A numeric confidence score. Rejected: it invites false precision and hides which evidence class
  a number came from.
- Letting adapters return UI states directly. Rejected: it fragments the truth model across
  providers.
- Treating an FCC-reported provider as "available". Rejected by the FCC's own definition of
  availability and by the discrepancy risks recorded in the planning documents.

## Evidence and official sources

Planning documents in Linear; FCC availability definition
(<https://help.bdc.fcc.gov/hc/en-us/articles/13532984820379-What-s-on-the-National-Broadband-Map>,
checked 2026-09-02). Tests: `packages/domain/src/availability.test.ts`,
`packages/providers/src/reference/adapter.test.ts`.

## Consequences

- M2 domain work (PLA-360) extends but must not weaken these enums and mappings.
- Implemented by PLA-360 (2026-09-03): `deriveProviderAvailability` in
  `packages/domain/src/truth.ts` composes the two mappings into the single runtime derivation —
  explicit provider outcomes verify; every other outcome falls back to candidate evidence, capped
  at `reported_available`/`likely_available`; no evidence yields `unknown`. Provider-job
  transitions and `computeSearchPhase` (partial/complete are orchestration facts) live in
  `packages/domain/src/search-state.ts`. The non-negotiable invariants are pinned by
  `packages/domain/src/truth.test.ts`.
- UI copy in `packages/ui` is derived from the state vocabulary (`AVAILABILITY_COPY`) and is
  never color-only.
- Any future source that claims negative evidence must document its contract before
  `verified_unavailable` may be produced from it.

## Unresolved risks

- Discrepancy display rules (what to show when a label and a qualification disagree) are defined in
  M3/M4 work and must keep this model's ordering.
