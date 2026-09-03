# ADR-003: Candidate-discovery source and licensing/terms basis

- **Status:** accepted
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-344
- **Review trigger:** a commercial Fabric/TrueVerra license or a CostQuest API data-use agreement is
  obtained; FCC publishes an address-capable public API; BDC vintage changes (twice yearly);
  BroadbandMap.com publishes vintage and retention terms.

## Context

The product must turn an address into a defensible set of candidate providers. The full decision
matrix with per-option precision, coverage, negative-evidence semantics, cadence, rights,
attribution, authentication, stability, cost, failure behaviour, and open legal questions is in
[`docs/sources/candidate-discovery-matrix.md`](../sources/candidate-discovery-matrix.md).

Findings that constrain the decision (all from official sources fetched 2026-09-02):

1. The FCC's documented Public Data API (Swagger v1.2.0) is a file catalog and download interface.
   It has no address, lat/lon, or `location_id` lookup.
2. BDC fixed-availability downloads are keyed to Fabric `location_id`. The FCC states that
   resolving an ID to an address, coordinates, or building attributes requires Fabric access.
3. No-cost Tier 4 Fabric licenses are limited to BDC challenge/crowdsource generation or
   non-commercial research. A public consumer comparison product is outside both. CostQuest owns
   the Fabric attributes; commercial access is via TrueVerra with unverified public-display rights.
4. The interactive map's backend endpoints are undocumented and not licensed for this use. Using
   them would also route around the Fabric license.
5. Commercial feeds exist but are not cleared: BroadbandMap.com is H3-hex precision with
   ephemeral-use-only terms and unstated vintage; CostQuest's match/locate/coverage APIs are the
   right shape but pricing tables are unpublished and consumer-display rights unverified.

## Decision

- **Exact nationwide address-level candidate discovery is not supportable today on a lawful
  production basis.** The product will not claim it.
- **V1 launches under Route C: a versioned, bounded launch-market registry** of plausible providers
  per named market, assembled from official provider footprint statements (recorded in the
  provider matrix) and public-domain BDC area summaries, with:
  - area-level BDC evidence (Provider Summary by Geography Type, current vintage: data as of
    December 31, 2025, download page last updated 2026-08-18) shown as _candidate_ evidence with
    vintage and the FCC's requested attribution ("Source data: FCC Broadband Data Collection");
  - a deep link to the FCC National Broadband Map **home page** (the user types their address
    there; the address is never placed in a URL by this application);
  - explicit copy: candidates only, no negative evidence, the provider confirms serviceability;
  - `last_reviewed` per registry entry and a refresh calendar tied to BDC releases.
- **Undocumented FCC map endpoints are prohibited** in production code. The adapter registry and
  `CandidateDiscovery` interface must not gain such a source without amending this ADR.
- Route A (licensed Fabric + BDC join) and Route B (commercial feed) remain the graduation paths;
  their entry criteria are recorded in the matrix's recommendation section.

## Alternatives considered

- **Route A now.** Blocked by license scope; free tiers do not permit this use and commercial
  public-display rights are unverified.
- **Route B now.** Blocked by unverified terms, unpublished pricing, and (for BroadbandMap.com)
  hex-level precision.
- **Route D (broad adapter fan-out).** Not a completeness solution; increases provider traffic and
  block risk; unusable while every provider is link-only (ADR-004).
- **Undocumented map endpoints.** Rejected on licensing and stability grounds regardless of
  technical ease.

## Evidence and official sources

Sections 1–7 and the sources list of the matrix. The FCC map contents, Fabric licensing, Public
Data API specification, BDC download page, CostQuest/TrueVerra pages, and BroadbandMap.com terms
were all fetched on 2026-09-02; two Box-hosted FCC spec PDFs could not be text-extracted and are
marked UNVERIFIED in the matrix.

## Consequences

- ADR-001 constrains the launch to named markets and the completeness wording follows.
- M2 (PLA-365) implements `RegistryCandidateDiscovery` reading a versioned JSON registry
  (`docs/sources/launch-matrix.json`) plus an `AreaEvidence` loader for BDC summary files.
- No negative evidence exists in V1: a provider absent from the registry is `unknown`, never
  `verified_unavailable`.
- A recurring review (see runbooks) re-checks the BDC vintage, the registry, and the graduation
  criteria.

## Unresolved risks

- Commercial Fabric/TrueVerra license scope for public display, derivative data, and term must be
  reviewed by qualified counsel before Route A. Owner: maintainer.
- CostQuest API data-use terms and price sheet are unverified. Owner: maintainer.
- Whether FCC User Registration credentials may be used server-side in a product is an open terms
  question (only relevant if the Public Data API is used for bulk downloads).
- Nominative use of provider names and consumer-protection accuracy disclosures for the registry
  need a policy review before public launch.
