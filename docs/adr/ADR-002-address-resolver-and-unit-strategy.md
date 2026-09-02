# ADR-002: Address resolver and unit strategy

- **Status:** accepted (vendor contract signature pending; see unresolved risks)
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-345
- **Review trigger:** Smarty tier pricing or terms change; a live test against the consented corpus
  (PLA-349) fails the unit cases; Google Maps Platform retention terms change; volume exceeds 100k
  resolves per month.

## Context

A street geocode is not a deliverable, provider-recognized address. Apartment/unit data is lost by
generic geocoders, and providers key eligibility on the exact unit. The application needs one
stable `AddressResolver` contract that preserves the user-entered unit even when a vendor omits or
rewrites it, exposes ambiguity and missing-unit conditions as user actions, and carries the
vendor's storage restrictions so retention can be enforced. The evaluation matrix, per-vendor test
matrices, cost projection, and full sources are in
[`docs/sources/address-resolver-matrix.md`](../sources/address-resolver-matrix.md).

Live vendor tests were **not** run in this round: no consented test-address corpus exists yet
(PLA-349), and Google's Service Specific Terms state that submitting artificially created US
addresses to Address Validation causes USPS validation to be cut off. The matrices are therefore
documentation-based. Live validation is a recorded blocker, not a silent assumption.

## Decision

1. **Primary resolver: Smarty US Street Address API** (`match=invalid`, `candidates=5`) with
   **Smarty US Autocomplete Pro** for entry UX.
   - CASS-certified; explicit unit signals (`dpv_match_code` `D`/`S`, footnotes `N1`/`CC`/`C1`,
     `enhanced_match` `missing-secondary` / `unknown-secondary`); USPS-shaped parsed components
     including ZIP+4 and Puerto Rico urbanization; per-building unit enumeration in Autocomplete.
   - Output Data may be retained perpetually under Smarty's terms (rooftop coordinates, if
     purchased, are subscription-bound).
   - Published SLA (99.98%, ≤500 ms). Server-side secret key; referer-bound embedded key only for
     autocomplete.
2. **US Census Geocoder: free corroboration and last-resort fallback only.** Called server-side
   with the unit-stripped standardized line for coordinates, county, and tract; `No_Match` is a
   soft flag, never a rejection; Census output is never presented as "verified".
3. **Backup validator (phase 2, optional): Google Address Validation with CASS**, session-terminated
   Enterprise SKU, only for addresses Smarty cannot confirm. Anything from Google expires after 30
   days unless replaced by user-confirmed data.
4. **Excluded:** USPS Addresses API v3 (terms restrict use to USPS shipping/mailing and forbid
   building address databases); Mapbox Geocoding (temporary geocodes cannot be stored; permanent
   geocodes only for "ancillary" features).
5. **Unit strategy:** `unit` is an application-owned field on `StructuredAddress`
   (`packages/domain/src/address.ts`). It is captured separately from the street line, preserved
   verbatim from user input, and included in the HMAC identity so two units in one building never
   share a cache identity. If a resolver omits or rewrites the unit, the application's value wins
   and the resolver's opinion is recorded as `validated_unit_unconfirmed` or
   `validated_unit_missing`.
6. **User actions:** `ambiguous` → the user must pick one candidate; `validated_unit_missing` →
   the user is prompted for a unit (with Smarty's enumerated units when available); `not_found` and
   `invalid_input` → corrected input; `unsupported` (non-US, PO Box, unsupported territory) →
   explained refusal. An unresolved address is never sent to a provider.

## Alternatives considered

- **Google Address Validation as primary.** Best-documented unit semantics, but every returned
  field including the standardized address is capped at 30 days of retention, and the
  cost-optimal path requires Autocomplete session accounting. Kept as backup.
- **Census-only.** Free but ignores units by design, interpolates coordinates, and has no SLA.
- **Lob / Melissa.** CASS-certified with explicit unit codes; Lob is the natural migration target
  (cheapest CASS option at 100k/month, no storage cap) but does not beat Smarty on unit
  enumeration.
- **Mapbox, HERE, Radar.** Storage restrictions, unverifiable pricing, or enterprise-only
  validation.

## Evidence and official sources

Documentation for every vendor was fetched on 2026-09-02; the URL list is in section 12 of the
matrix. Key facts: Smarty terms grant perpetual retention of Output Data; Google Maps Platform
Service Specific Terms cap Address Validation retention at 30 days; USPS API T&Cs restrict use to
mailing; Mapbox ToS §2.7 restricts storing geocodes.

## Consequences

- M2 (PLA-363) implements `SmartyAddressResolver` behind the application-owned contract defined in
  section 11 of the matrix and a `CensusGeocoder` corroborator. Vendor response shapes stay inside
  the adapter package.
- The resolver output carries `source_restrictions` and `permitted_until` so a later Google
  adapter can enforce expiry without domain changes.
- Estimated cost at 10k resolves/month is under $100 for Smarty's base tiers; the 120K/yr and
  1M/yr tiers must be quoted before launch.
- The consented corpus (PLA-349) is required before any live resolver test; synthetic addresses
  must never be sent to Google's CASS path.

## Unresolved risks

- Smarty upper-tier prices and Enhanced Data Privacy terms are unverified on public pages; obtain
  a written quote before signing. Owner: maintainer.
- Google Maps Platform Terms §3.2.2(b)(ii) ("will not provide to Google any End User's personally
  identifiable information") needs qualified review before Google is used even as backup.
- No live unit/ambiguity test has been run. Blocked on PLA-349.
