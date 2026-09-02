# ADR-001: V1 launch boundary and completeness claim

- **Status:** accepted (market list marked _proposed_ until the maintainer confirms consented test
  addresses can be sourced there)
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-348
- **Review trigger:** ADR-003 graduates to Route A or B; any provider moves above `link_only` in
  ADR-004; a BDC vintage change; a market is added or removed.

## Context

ADR-003 establishes that exact nationwide candidate discovery has no lawful production basis
today. ADR-004 records that every evaluated provider is currently `link_only`. ADR-002 selects a
resolver but no consented live corpus exists yet (PLA-349). The launch boundary must therefore be
honest about three things: which areas are covered, which providers are checked and how, and what
"complete" does not mean.

## Decision

### Boundary

1. **V1 public beta is bounded to named launch markets** (Route C). A market is a Core Based
   Statistical Area (CBSA) or county list recorded in
   [`docs/sources/launch-matrix.json`](../sources/launch-matrix.json) with a `registry_version`,
   `bdc_vintage`, `last_reviewed`, and a provider list where every entry carries its evidence
   (official footprint page and/or BDC area summary), its adapter tier, and its official fallback
   URL.
2. **Proposed first markets** (pending maintainer confirmation that consented test addresses can be
   obtained there; the criteria below decide, not these names):
   - Seattle–Tacoma–Bellevue, WA (CBSA 42660): Ziply Fiber (WA, official), GFiber Webpass
     (Seattle, official), T-Mobile Home Internet (nationwide capacity-based, official), Xfinity
     and CenturyLink/Quantum Fiber (footprint pages not verifiable on 2026-09-02; area evidence
     required before listing).
   - Raleigh–Cary, NC (CBSA 39580): GFiber (NC, official), Brightspeed (NC, official), Spectrum
     (45-state footprint, official), AT&T Fiber (state list UNVERIFIED; area evidence required),
     T-Mobile Home Internet.
3. **Market selection criteria:** at least three providers with official footprint evidence; at
   least one provider with public Broadband Facts label material; feasibility of a consented test
   corpus covering single-family, MDU with unit, and MDU without unit; BDC area summary available
   for the current vintage.
4. **Providers actively checked vs link-only:** in the first beta **no provider is actively
   checked** by automation. Every provider is link-only with candidate evidence until ADR-004 is
   amended. The UI therefore never shows `verified_available` or `verified_unavailable` in the
   first beta; it shows `likely_available` (registry + area evidence) or `unknown`.
5. **Fixed wireless and satellite:** T-Mobile Home Internet (and Verizon 5G Home where in a
   market) may be listed as candidates with the explicit caveat that eligibility is capacity-based
   per address and changes over time. Satellite is not listed in V1.
6. **Unsupported addresses:** a resolved address outside every launch market yields search state
   `unsupported_market` (M2) with copy explaining the boundary and a deep link to the FCC map home
   page. No provider is guessed. Edge-of-market addresses are decided by the resolver's county
   and CBSA, not by ZIP prefix.
7. **Freshness and review cadence:** registry entries are reviewed quarterly and at every BDC
   release; `last_reviewed` is displayed.
8. **Expansion criteria:** a new market requires the criteria in (3) plus a passing consented
   test run; a new provider tier requires ADR-004 amendment.

### Exact user-facing completeness language

> ISP Search checks a fixed list of providers for each supported area. It does not check every
> internet provider, and a provider missing from your results may still serve your address. We
> only mark a provider as **verified** when the provider's own address check confirmed it; in this
> beta no provider is verified automatically, so results are marked **likely** (from public
> area-level data and the provider's published service area) or **unknown**. Nothing here means a
> provider is unavailable. Provider list last reviewed: {registry.last_reviewed}. For the FCC's
> full list of reported providers, use the FCC National Broadband Map.

Prohibited phrases anywhere in the product: "all ISPs", "every provider", "complete list",
"nationwide coverage".

## Alternatives considered

- Nationwide launch with weakened evidence: rejected, it would require presenting area-level or
  undocumented-endpoint data as address-level.
- Single-market launch: acceptable fallback if consented addresses cannot be sourced for two.
- Waiting for two approved live adapters before any public beta: rejected as a blocker to
  learning; the candidate-plus-official-link beta is honest and useful, and ADR-004's review
  trigger reopens this ADR when adapters are approved.

## Evidence and official sources

Provider footprints and label pages in
[`docs/sources/provider-feasibility-matrix.md`](../sources/provider-feasibility-matrix.md)
(fetched 2026-09-02); BDC vintage and area summaries in
[`docs/sources/candidate-discovery-matrix.md`](../sources/candidate-discovery-matrix.md).

## Consequences

- M2 implements `RegistryCandidateDiscovery` over `launch-matrix.json` and the
  `unsupported_market` state.
- M4 methodology and supported-market pages render the language above verbatim.
- The M3 "adapter gate" (two live adapters) is **not satisfiable** under current ADR-004; the
  Round 2 plan must treat it as gated, not assumed.

## Unresolved risks

- Consented test-address sourcing for the proposed markets is unconfirmed (PLA-349).
- Several footprint facts are UNVERIFIED on official pages because the pages block automated
  fetches; they must be confirmed in a browser or from BDC area summaries before listing.
- Nominative use of provider names and any state consumer-protection disclosure requirements need
  a policy review before public launch.
