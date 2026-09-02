# ISP Search — Address Resolver Decision Matrix

Prepared: 2026-09-02. All facts below were read from official vendor documentation, pricing, or terms pages on 2026-09-02 unless otherwise stated. Nothing was executed against any API; no real residential address appears in this document. Anything not confirmed on an official page is marked **UNVERIFIED**.

Scope: choose the ADDRESS RESOLVER (validation / normalization / geocoding) that sits between the user's typed address (+ optional unit) and the ISP availability checks. The resolver must (a) produce USPS-standard components ISPs accept, (b) tell us when a unit is missing or wrong (multi-dwelling units are where ISP availability differs most), (c) be legally storable for the time the user's session/result lives, and (d) be affordable at 1k–100k requests/month.

---

## 0. Executive summary

| Rank | Candidate                                                       | Verdict for V1                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Smarty US Street Address API** (+ US Autocomplete Pro for UX) | **Primary resolver.** CASS-certified, explicit `dpv_match_code` Y/N/S/D and `enhanced_match` `missing-secondary` / `unknown-secondary` signals, USPS-shaped components, `record_type`, RDI, Puerto Rico urbanization, and — crucially — perpetual right to retain Output Data. Autocomplete drills into individual unit lists. Weakest points: coordinates are ZIP-9-level unless the Rooftop add-on is bought; sub-tier pricing beyond the base tier not captured on the public page. |
| 2    | **Google Address Validation API**                               | Strong runner-up / fallback. Best-documented unit semantics (`CONFIRM_ADD_SUBPREMISES`, `missingComponentTypes: subpremise`, `dpvConfirmation` D/S with CASS on). Disqualifier for primary: **30-day caching cap** on every returned field including standardized address and lat/lng, and a session-based Enterprise SKU ($25/1k) if you want Autocomplete to be free.                                                                                                                |
| 3    | **US Census Geocoder**                                          | **Free corroboration / fallback only.** Ignores unit numbers by design, interpolated street-segment coordinates, no SLA, no documented rate limits, known load-dependent match inconsistency. Excellent for a second opinion on coordinates, county/tract, and as a zero-cost "does this street+number range exist" check.                                                                                                                                                             |
| —    | Mapbox Geocoding v6                                             | Not recommended as resolver. Temporary geocodes may not be stored at all; Permanent geocodes ($5/1k, no free tier) may only be an "ancillary" feature of the app. `secondary_address` support exists (US only) but is extrapolated, not USPS-confirmed.                                                                                                                                                                                                                                |
| —    | USPS Addresses API v3                                           | **Not usable**: T&Cs restrict use to facilitating USPS shipping/mailing transactions and prohibit building address databases.                                                                                                                                                                                                                                                                                                                                                          |
| —    | Lob / Melissa / HERE / Radar                                    | Viable alternates (Lob and Melissa are CASS-certified with explicit unit codes) but none beats Smarty on storage rights + unit signals + price at our volumes. HERE pricing could not be verified on an official page; Radar has no free tier and validation is enterprise-only.                                                                                                                                                                                                       |

Cost at 10k resolves/month (details in §9): Census $0; Smarty ≈ $46/mo for 1k/mo tier, 10k/mo tier **UNVERIFIED** (page lists tiers but not prices); Google AV Pro ≈ $85; Google AV Enterprise-session ≈ $225 (with free Autocomplete); Mapbox Permanent $50 (+ storage restrictions); Lob Startup ≈ $250; Melissa PAYG ≈ $400.

---

## 1. US Census Geocoder

**Sources:** Geocoding Services API reference (https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html, fetched 2026-09-02); Census Geocoder User Guide PDF (https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_User_Guide.pdf, fetched 2026-09-02, "May 2026" edition per search snippet); Census Geocoder FAQ PDF (https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_FAQ.pdf, fetched 2026-09-02); Census Geocoder technical documentation page (https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html, fetched 2026-09-02); Census Bureau Data API ToS (https://www.census.gov/data/developers/about/terms-of-service.html, fetched 2026-09-02).

**Inputs.** Four single-record search types: `onelineaddress`, `address` (street/city/state/zip), `addressPR` (street, urbanization, city, municipio, state, zip — Puerto Rico), `coordinates` (reverse, geographies only). Required params: `benchmark` and return type (`locations` or `geographies`). Batch: CSV/TXT/DAT/XLS/XLSX up to 10,000 records per submission. JSON and JSONP output.

**Benchmarks / vintages.** Benchmark format `Public_AR_<SpatialBenchmark>` with `Current`, `ACS####`, `Census####` (e.g., `Public_AR_Current`, numeric id 4). Vintage format `<GeographyVintage>_<SpatialBenchmark>`; vintage benchmark must match. "Current" evolves with the underlying data. Benchmark = date a snapshot of MAF/TIGER was taken (FAQ).

**Outputs.** `matchedAddress` (standardized string), `coordinates` (x=lon, y=lat), `tigerLine.tigerLineId` + `side` (L/R), `addressComponents` with `fromAddress`, `toAddress`, `preQualifier`, `preDirection`, `preType`, `streetName`, `suffixType`, `suffixDirection`, `suffixQualifier`, `city`, `state`, `zip`. With `geographies`: GEOID, STATE, COUNTY, TRACT, BLKGRP, centroid/internal point, area fields, NAME.

**Units / subpremise.** User Guide §1.1.1: "if a unit number is included, the geocoding results will not be affected. Geocoding results from the Census Geocoder are based on a basic street address." No secondary component is returned. So: no unit validation, no "unit missing" signal, ever.

**Match types.** Match indicator: `Match`, `Tie`, `No_Match`; match type: `Exact` or `Non_Exact` (User Guide Table 9). No numeric confidence score is documented.

**Coordinate method.** "interpolated, or approximated, based on the physical location that the address geocoded on the TIGER address ranges" — i.e., address-range interpolation along a street segment, never rooftop/parcel.

**Reliability notes (official).** FAQ lists no-geocode causes: non-residential/commercial address, "Housing unit may have been recently constructed and is not in our database yet", local addressing authority changes not yet reflected, missing address-range information, demolished units, and Title 13 disclosure suppression in sparsely populated areas. FAQ also documents a **known load-dependent inconsistency**: the same batch can return different Match/No_Match/Tie counts on repeated runs ("a known issue with the geocoder's address matching related to processing load").

**Rate limits, SLA, terms, cost.** No rate limit, SLA, or terms-of-use text is published on the geocoder pages; the Census Data API ToS (api.census.gov) does not mention the geocoder. Cost: none (free public service). Attribution: the Data API ToS requires "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau" — whether that applies to the geocoder is **UNVERIFIED**; using similar wording is harmless.

**Key model.** No key. Any client can call it, so a browser call is technically possible; we should still proxy server-side to control retries and avoid exposing user addresses to a third origin from the browser.

### Census test matrix

| Case                                     | What the documentation says                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal single-family                     | Matched to a TIGER address range; returns standardized `matchedAddress`, parsed components, interpolated point, side of street.                                                                          |
| Apartment with valid unit                | Unit ignored; result identical to the building address. No secondary component returned.                                                                                                                 |
| Apartment with missing/invalid unit      | No signal. Cannot distinguish.                                                                                                                                                                           |
| Ambiguous address                        | `Tie` match indicator when multiple ranges tie; no candidate list documented for single-line API (**UNVERIFIED** whether multiple `addressMatches` can be returned).                                     |
| Aliases / directionals / suffix variants | `Exact` vs `Non_Exact` match type; `matchedAddress` is the TIGER-standardized form.                                                                                                                      |
| Rural route / PO Box                     | Not documented. Inference: street-range matching cannot locate a PO Box or RR box; expect `No_Match`. **UNVERIFIED**.                                                                                    |
| New construction                         | FAQ: may be `No_Match` ("recently constructed and is not in our database yet").                                                                                                                          |
| Invalid/unsupported input                | `No_Match`; US, PR, and Island Areas only.                                                                                                                                                               |
| Coordinate precision                     | Interpolated along address range (street-segment level); never rooftop or parcel.                                                                                                                        |
| Puerto Rico                              | Supported via `addressPR` (urbanization + municipio) and PR batch layout; `onelineaddress` does not support urbanization/municipio.                                                                      |
| USPS-standard components                 | Partial: pre/suffix direction, pre/suffix type, street name, city, state, 5-digit ZIP. **No** primary number as a separate field (only from/to range), **no** secondary designator/number, **no** ZIP+4. |
| Storage / caching restrictions           | None published.                                                                                                                                                                                          |
| Privacy terms                            | None published for the geocoder; Title 13 suppression is applied on the Census side.                                                                                                                     |
| Cost 1k / 10k / 100k                     | $0 / $0 / $0.                                                                                                                                                                                            |
| Latency / uptime SLA                     | None published. FAQ documents load-related inconsistency.                                                                                                                                                |
| Key exposure                             | No key; call server-side anyway.                                                                                                                                                                         |

---

## 2. Google Address Validation API

**Sources:** Overview (https://developers.google.com/maps/documentation/address-validation/overview); Understand the response (https://developers.google.com/maps/documentation/address-validation/understand-response); Handle US addresses (https://developers.google.com/maps/documentation/address-validation/handle-us-address); Build validation logic (https://developers.google.com/maps/documentation/address-validation/build-validation-logic); REST reference validateAddress (https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress); Coverage (https://developers.google.com/maps/documentation/address-validation/coverage); Usage and billing (https://developers.google.com/maps/documentation/address-validation/usage-and-billing); FAQ (https://developers.google.com/maps/documentation/address-validation/faq); Policies (https://developers.google.com/maps/documentation/address-validation/policies); Pricing list (https://developers.google.com/maps/billing-and-pricing/pricing); SKU details (https://developers.google.com/maps/billing-and-pricing/sku-details); Maps Service Specific Terms (https://cloud.google.com/maps-platform/terms/maps-service-terms, "Last modified June 10, 2026"); Google Maps Platform Terms (https://cloud.google.com/maps-platform/terms, "Last modified August 26, 2026"); Maps Platform SLA (https://cloud.google.com/maps-platform/terms/sla, last modified January 27, 2025); API security best practices (https://developers.google.com/maps/api-security-best-practices). All fetched 2026-09-02.

**Capabilities.** Validates, standardizes, and geocodes; returns `verdict`, `address` (formatted + `postalAddress` + per-component `confirmationLevel`), `geocode` (location, plusCode, bounds, placeId, placeTypes), `metadata` (business / poBox / residential), and `uspsData` (US/PR). Optional USPS **CASS** via `enableUspsCass: true` ("not enabled by default and is only supported for the 'US' and 'PR' regions"; PR requests need `regionCode: PR` or `administrativeArea: Puerto Rico`). The FAQ states the API "is a CASS Certified service". Coverage table shows full coverage plus residential/commercial metadata for both US and PR.

**Verdict granularity.** `Granularity` enum: `SUB_PREMISE` ("Below-building level result, such as an apartment"), `PREMISE`, `PREMISE_PROXIMITY`, `BLOCK`, `ROUTE`, `OTHER` ("not deliverable"). Verdict fields: `inputGranularity`, `validationGranularity`, `geocodeGranularity`, `addressComplete`, `hasUnconfirmedComponents`, `hasInferredComponents`, `hasReplacedComponents`, `hasSpellCorrectedComponents`, `possibleNextAction`.

**Unit / subpremise signals (the strongest of any vendor).**

- `possibleNextAction`: `FIX`, `CONFIRM`, `ACCEPT`, and **`CONFIRM_ADD_SUBPREMISES`** ("Might be missing subpremises; review/add unit number (US only)").
- `missingComponentTypes` containing `subpremise` → the build-logic guide maps this to CONFIRM_ADD_SUBPREMISES.
- Per-component `confirmationLevel`: `CONFIRMED`, `UNCONFIRMED_BUT_PLAUSIBLE`, `UNCONFIRMED_AND_SUSPICIOUS`; `unresolvedTokens` for junk.
- `uspsData.dpvConfirmation`: `Y` "fully deliverable by USPS, including the sub-premise"; `D` sub-premise missing (→ add subpremise); `S` sub-premise provided but not confirmed (→ confirm); `N` primary not recognized; empty → not DPV confirmed. Also `dpvFootnote` codes (AA, A1, BB, CC, C1, N1, M1, M3, P1, P3, F1, G1, U1, PB, RR, R1, R7, IA, TA), `dpvCmra`, `dpvVacant`, `dpvNoStat` + reason codes (incl. "Secondary Required"), `dpvDrop`, `dpvThrowback`, `dpvNonDeliveryDays`, `dpvDoorNotAccessible`, `dpvEnhancedDeliveryCode` (Y/N/S/D/R), `addressRecordType` (F/G/H/P/R/S), `suitelinkFootnote`, `cassProcessed`, `poBoxOnlyPostalCode`, `pmbDesignator/pmbNumber`, `standardizedAddress` {firstAddressLine, cityStateZipAddressLine, city, state, zipCode, zipCodeExtension}.
- Doc caveat: `uspsData` "is not guaranteed to be fully populated for every address" — combine with verdict.

**Artificially-created addresses.** SST §B.1.2: for US/PR, if Customer submits artificially-created addresses Google will stop USPS-backed validation for the Customer and report Customer's name/address, the input, and aggregated usage to USPS. Practical consequence: never send synthetic/test addresses through production; use Google's demo or non-CASS sandboxing. (This is also why this report contains no test calls.)

**Pricing (Global price list, March 2025 model, fetched 2026-09-02).** Free usage caps per SKU per month: Essentials 10,000 / Pro 5,000 / Enterprise 1,000. Then tiered per 1,000 (Cap–100k / 100k–500k / 500k–1M / 1M–5M / 5M+):

- **Address Validation Pro** (SKU A2E0-53FF-0BE3): free 5,000; **$17.00** / $13.60 / $10.20 / $5.10 / $1.28. Trigger: any `ValidateAddress` call. Feedback calls (`provideValidationFeedback`) are free.
- **Address Validation Enterprise** (10F3-119A-C6EC): free 1,000; **$25.00** / $20.00 / $15.00 / $7.50 / $2.28. Trigger: "Autocomplete (New) session that terminates in a ValidateAddress" call.
- CASS: the SKU pages do **not** say `enableUspsCass` changes the SKU — CASS pricing impact **UNVERIFIED** (no separate CASS SKU appears on the price list).
- Rate limit: default 6,000 QPM for validation methods (+6,000 QPM feedback).

**Caching / storage (SST §B.1.3, Table 1.3.2 — the deciding constraint).**

- `formattedAddress`, `postalAddress`, `addressComponent.componentName`, USPS `standardizedAddress`: **30 consecutive calendar days**, after which Customer must (a) delete, or (b) "replace it with End User data provided through End User confirmation or correction". Permitted purpose: "Downstream transactions" (re-using for that End User's account so they don't retype).
- `confirmationLevel`, `inferred`, `spellCorrected`, `replaced`, `unexpected`: 30 days, same delete-or-replace rule; purpose "Correction Requests".
- `location` latitude/longitude: 30 days, then **must delete** (no replace option).
- Place IDs: cacheable indefinitely (general SST §A.3 and AV policies page).
- Main Terms §3.2.3: "No Scraping" (no pre-fetch/index/store/reshare of Google Maps Content) and "No Caching … except as expressly permitted under the Maps Service Specific Terms".

Design consequence: the app may keep a Google-derived standardized address only if it is re-cast as the _user's confirmed_ address (the "replace with End User data" branch). Coordinates must be purged at 30 days. This is workable for a session-scoped product but forces an expiry field on every stored resolver output.

**Attribution / app terms.** Policies page: results shown without a Google map need Google attribution (logo or "Google Maps" text, Roboto ≥12sp, same container). App must have public Terms of Use and Privacy Policy referencing Google's ToS and Privacy Policy (Main Terms §3.2.2(a)).

**Privacy / data processing.** Main Terms §3.2.2(b)(ii): "Customer will not provide to Google (1) any End User's personally identifiable information; or (2) any European End User's Personal Data". Addresses entered by users are arguably PII in some jurisdictions; Google's own docs treat address validation as a normal use, but the clause should be reviewed by counsel. No subprocessor list or Data Processing Addendum is referenced from the Maps Platform Terms text we read — **UNVERIFIED** whether the Google Cloud DPA covers Maps Platform.

**SLA.** Maps Platform SLA: 99.9% Monthly Uptime SLO per Covered Service; credits 10% (99.0–<99.9%), 25% (95.0–<99.0%), 50% (<95%); Customer must request. Whether Address Validation is a "Covered Service" is not enumerated in the extracted text — **UNVERIFIED**. Latency: not documented.

**Key model.** Security best-practices: Address Validation API and Places API (New) web service keys are server-side only (IP restrictions); "Web service API keys are not expected to be publicly exposed". Browser use goes through a proxy or the JS/native SDKs.

### Google Address Validation test matrix

| Case                                    | What the documentation says                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal single-family                    | `validationGranularity: PREMISE`, `addressComplete: true`, `possibleNextAction: ACCEPT`; with CASS, `dpvConfirmation: Y`, `addressRecordType: S`.                                                                                                                                                                                                                     |
| Apartment with valid unit               | `validationGranularity: SUB_PREMISE`; `dpvConfirmation: Y` ("including the sub-premise"); `addressRecordType: H`.                                                                                                                                                                                                                                                     |
| Apartment, unit missing                 | `missingComponentTypes: [subpremise]`, `possibleNextAction: CONFIRM_ADD_SUBPREMISES`, `dpvConfirmation: D`.                                                                                                                                                                                                                                                           |
| Apartment, unit invalid                 | subpremise component `UNCONFIRMED_*`, `dpvConfirmation: S` ("Sub-premise provided but not confirmed"), `possibleNextAction: CONFIRM`; `dpvFootnote` CC/C1 semantics.                                                                                                                                                                                                  |
| Ambiguous address                       | Single best result; ambiguity surfaces as `hasReplacedComponents`, `UNCONFIRMED_AND_SUSPICIOUS`, `unresolvedTokens`, or `validationGranularity: ROUTE/OTHER` → FIX/CONFIRM. No candidate list.                                                                                                                                                                        |
| Aliases / directional / suffix variants | `hasReplacedComponents`, `hasSpellCorrectedComponents`, `hasInferredComponents` flags with the standardized `postalAddress`; CASS `standardizedAddress` in USPS abbreviations.                                                                                                                                                                                        |
| Rural route / PO Box                    | `metadata.poBox`, `addressRecordType: P` or `R`, `poBoxOnlyPostalCode`; `dpvNoStat`, `dpvThrowback` (delivered to PO Box), carrier route.                                                                                                                                                                                                                             |
| New construction                        | `dpvNoStat` reason codes / `UNCONFIRMED_BUT_PLAUSIBLE` ("street number within valid range"); not explicitly documented as a case.                                                                                                                                                                                                                                     |
| Invalid / unsupported input             | `validationGranularity: OTHER`, `possibleNextAction: FIX`, `unresolvedTokens`. Non-US handled by same API (coverage page).                                                                                                                                                                                                                                            |
| Coordinate precision                    | `geocodeGranularity` (PREMISE / PREMISE_PROXIMITY / ROUTE …) plus `placeTypes`; separate from validation granularity.                                                                                                                                                                                                                                                 |
| Puerto Rico                             | Full coverage; CASS requires `regionCode: PR`.                                                                                                                                                                                                                                                                                                                        |
| USPS-standard components                | Yes with CASS: `standardizedAddress` lines + `zipCode`/`zipCodeExtension`, plus `addressComponents` typed `street_number`, `route`, `subpremise`, `locality`, `administrative_area_level_1`, `postal_code`, `postal_code_suffix`. Note: USPS-style pre/post-directional and suffix are only inside `firstAddressLine` text, not separate fields — the app must parse. |
| Storage / caching                       | 30-day cap on all address fields (delete or replace with user-confirmed data); lat/lng must be deleted at 30 days; place ID indefinite.                                                                                                                                                                                                                               |
| Privacy terms                           | App ToS/Privacy must reference Google's; Customer must not send Google End-User PII (counsel review).                                                                                                                                                                                                                                                                 |
| Cost 1k / 10k / 100k per month          | Pro: $0 / $85 / $1,615. Enterprise (Autocomplete-session-terminated): $0 / $225 / $2,475.                                                                                                                                                                                                                                                                             |
| Latency / uptime                        | 99.9% SLO (coverage of AV **UNVERIFIED**); latency undocumented; 6,000 QPM.                                                                                                                                                                                                                                                                                           |
| Key exposure                            | Server-side only (IP-restricted key or proxy).                                                                                                                                                                                                                                                                                                                        |

---

## 3. Google Places API — Autocomplete (New)

**Sources:** Autocomplete (New) (https://developers.google.com/maps/documentation/places/web-service/place-autocomplete); Session pricing (https://developers.google.com/maps/documentation/places/web-service/session-pricing); Places policies (https://developers.google.com/maps/documentation/places/web-service/policies); Pricing list and SKU details (above); SST §B.14 "Places API (Legacy and New)". Fetched 2026-09-02.

**Endpoint / request.** `POST https://places.googleapis.com/v1/places:autocomplete` with `input`, optional `sessionToken`, `includedRegionCodes` (≤15), `locationBias` / `locationRestriction`, `includedPrimaryTypes` (≤5), `includeQueryPredictions`. Response: `suggestions[].placePrediction` (placeId, `structuredFormat`) or `queryPrediction`.

**Subpremise.** The Autocomplete (New) doc states it performs poorly for "subpremise addresses, such as addresses for specific units or apartments" and recommends falling back to the Geocoding API for such queries. So Autocomplete gives the building; the unit must be captured in a separate field and validated by Address Validation.

**Sessions and pricing.** A session starts with the first Autocomplete request carrying a session token and is terminated by a Place Details (New) or **Address Validation** request using the same token.

- Terminated by Address Validation (or Place Details Pro/Enterprise): all Autocomplete requests in the session are free (Autocomplete Session Usage SKU, "Unlimited" free); the Address Validation call bills at **Enterprise** ($25/1k after 1,000 free).
- Terminated by Place Details Essentials ($5/1k after 10,000 free): the first 12 Autocomplete requests bill at Autocomplete Requests ($2.83/1k after 10,000 free); requests 13+ are free.
- Abandoned session or no token: per-request Autocomplete Requests pricing (4EF4-B17C-B31A): free 10,000; $2.83 / $2.27 / $1.70 / $0.85 / $0.21 per 1k by tier.
- Place Details Essentials (6E05-E1C3-8D85) covers `addressComponents`, `formattedAddress`, `location`, `postalAddress` etc.

**Storage.** SST §B.14.3: lat/lng from Places API cacheable ≤30 consecutive days then delete. Place IDs indefinitely (§A.3, policies). Everything else falls under the general no-caching rule. Policies: Places results shown on a map must be on a Google map; without a map, show "Google Maps" attribution; app must have ToS/Privacy referencing Google's.

**Key model.** Places API (New) web service → server-side keys only; for browser autocomplete use the Maps JavaScript API Places library (referrer-restricted key) or a server proxy.

### Autocomplete (New) test matrix (UX layer only — not a resolver)

| Case                 | Documentation                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Single-family        | Returns `street_address`/`premise` predictions with place ID.                                                                             |
| Apartment with unit  | "performs poorly" for subpremise; capture unit separately.                                                                                |
| Missing/invalid unit | No signal; not its job.                                                                                                                   |
| Ambiguous            | Multiple predictions; user picks.                                                                                                         |
| Aliases/directionals | Prediction text is Google-formatted, not USPS-standard.                                                                                   |
| Rural / PO Box       | PO Boxes are not Places; **UNVERIFIED**.                                                                                                  |
| New construction     | **UNVERIFIED**.                                                                                                                           |
| Invalid input        | Empty suggestions.                                                                                                                        |
| Coordinates          | Only via Place Details (Essentials) → 30-day cache limit.                                                                                 |
| Puerto Rico          | `includedRegionCodes: ["us","pr"]` supported (region codes list) — PR quality **UNVERIFIED**.                                             |
| USPS components      | No; use Address Validation for that.                                                                                                      |
| Storage              | Place ID indefinite; lat/lng 30 days; text predictions not cacheable.                                                                     |
| Privacy              | Same as Address Validation.                                                                                                               |
| Cost                 | Free when session ends in Address Validation (then AV bills Enterprise). Otherwise 10 keystrokes/address ≈ $0.028/address after free cap. |
| SLA / key            | 99.9% SLO; server key for web service, referrer key for JS library.                                                                       |

---

## 4. Smarty — US Street Address API (+ US Autocomplete Pro, US Rooftop Geocoding)

**Sources:** US Street Address API reference (https://www.smarty.com/docs/cloud/us-street-api); US Autocomplete Pro reference (https://www.smarty.com/docs/cloud/us-autocomplete-pro-api); Authentication (https://www.smarty.com/docs/cloud/authentication); Pricing (https://www.smarty.com/pricing, https://www.smarty.com/pricing/us-address-verification, https://www.smarty.com/pricing/us-address-autocomplete, https://www.smarty.com/pricing/us-rooftop-geocoding); Subscription Agreement / ToS (https://www.smarty.com/legal/terms-of-service); SLA (https://www.smarty.com/legal/service-level-agreement); Privacy Policy (https://www.smarty.com/legal/privacy-policy). Fetched 2026-09-02. (The rate-limiting doc URL https://www.smarty.com/docs/cloud/rate-limiting returned 404.)

**Inputs.** `street` (≤50; freeform ≤100), `street2`, `secondary` (≤32), `city`, `state`, `zipcode`, `lastline`, `addressee`, `urbanization` (PR), `input_id`, `candidates` (1–10, default 1), `match` = `strict` (default; empty array if invalid) | `invalid` (always return detail; check `dpv_match_code`) | `enhanced` ("more aggressive matching" incl. ~20M non-USPS addresses; requires Core or Rooftop license).

**Outputs.** `delivery_line_1/2`, `last_line`; `components`: `primary_number`, `street_predirection`, `street_name`, `street_suffix`, `street_postdirection`, `secondary_designator`, `secondary_number`, `extra_secondary_designator/number`, `pmb_designator/number` (not verified by Smarty), `city_name`, `default_city_name`, `state_abbreviation`, `zipcode`, `plus4_code`, `delivery_point`, `urbanization`. `metadata`: `record_type` F/G/H/P/R/S, `zip_type`, county FIPS/name, `latitude/longitude`, `precision` (Unknown, Zip5…Zip9, and Street/Parcel/Rooftop with Rooftop subscription), `rdi` Residential/Commercial, `building_default_indicator`, `congressional_district`, time zone. `analysis`: `dpv_match_code` Y/N/S/D, `dpv_footnotes` (AA, A1, BB, CC, C1, F1, G1, M1, M3, N1, PB, P1, P3, RR, R1, R7, TA, U1), `footnotes` (A#…, incl. **H# "Missing secondary number"**, **S# "Unrecognized secondary address"**), `enhanced_match` (`none`, `postal-match`, `non-postal-match`, **`missing-secondary`**, **`unknown-secondary`**, `ignored-input`), `lacslink_code/indicator`, `suitelink_match`, `no_stat`, `active` (deprecated).

**Autocomplete Pro.** `search` (≤32 chars), `selected`, include/exclude city/state/ZIP filters, `prefer_geolocation`. Returns "fully verified USPS addresses": `street_line`, `secondary`, `city`, `state`, `zipcode`, `entries`, `source` (`postal` | `other`). When `entries > 1` the UI shows e.g. "Apt (N entries)"; resubmitting with `selected` returns up to 100 individual unit-level addresses. Embedded (browser) key with Referer allow-list supported; rate-limited per source.

**Pricing (public page, 2026-09-02).**

- US Address Verification: free trial 42 days / 1,000 lookups, no card. Professional from **$552/year for 12,000 lookups/year** (~$46/mo, ~$0.046/lookup); tiers 60K, 120K, 300K, 600K, 1M, 2M per year listed but their prices are not in the page text we captured — **UNVERIFIED**. No overage: exhausted plans return HTTP 402 until renewal. "Up to 25,000 address lookups / second."
- US Autocomplete Pro: separate product; Professional from **$21/month for 5K lookups/month** (tiers to 850K/mo; prices **UNVERIFIED** beyond base). One lookup = one query; "Users entering an address typically consume around ten lookups."
- US Rooftop Geocoding: separate add-on delivered through the US Street API; Professional from **$125/month** (1K–85K/mo tiers; prices beyond base **UNVERIFIED**). Pricing page: rooftop data "can only be stored as long as you have an active US Rooftop geocoding subscription".

**Storage / terms.** Subscription Agreement: "Subscriber may retain and use Data Products and Output Data on a perpetual basis following the end of the Subscription Term." Prohibited: distributing Output Data, reselling/white-labeling, using the service to compile address databases or mailing lists. Optional **Enhanced Data Privacy**: input data "is processed solely in transient memory … not stored or retained"; otherwise Smarty may retain Operational Data and use derived data for analytics/product development. Privacy Policy does not state a retention period for API request logs (**gap**; ask for EDP terms).

**SLA.** US Street Address API 99.98% availability, ≤500 ms response; Autocomplete 99.00%, ≤100 ms; credits = (target − actual) × monthly fee, claim within 30 days; SLA excludes free-tier services.

**Key model.** Secret `auth-id`/`auth-token` server-side only; embedded `key` for browser (GET only, host/referer bound, rate-limited, blocked from public-cloud IPs unless allow-listed).

### Smarty test matrix

| Case                           | Documentation                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal single-family           | `dpv_match_code: Y`, `record_type: S`, footnote AA/BB, full components, ZIP+4, RDI.                                                                                                                        |
| Apartment with valid unit      | `dpv_match_code: Y`, `record_type: H`, `secondary_designator/number` populated; `suitelink_match` if SuiteLink corrected.                                                                                  |
| Apartment, unit missing        | `dpv_match_code: D`, `dpv_footnotes` N1 ("missing secondary information required for delivery"), `footnotes` H#, `enhanced_match: missing-secondary` (with `match=enhanced`).                              |
| Apartment, unit invalid        | `dpv_match_code: S` (confirmed ignoring secondary), `dpv_footnotes` CC/C1, `footnotes` S#, `enhanced_match: unknown-secondary`.                                                                            |
| Ambiguous address              | `candidates` up to 10; each carries `candidate_index`; multiple returned when input matches several addresses.                                                                                             |
| Aliases / directional / suffix | `footnotes` L#/M#/N#/B# etc. describe corrections; standardized components returned. `default_city_name` for alias cities.                                                                                 |
| Rural route / PO Box           | `record_type: R` / `P`; `zip_type: POBox`; `dpv_footnotes` R7 (valid, no street delivery).                                                                                                                 |
| New construction               | `match=enhanced` → `non-postal-match` for addresses outside USPS data; `no_stat` for not-yet-active delivery points.                                                                                       |
| Invalid / unsupported          | `strict` → empty array; `invalid` → detail with `dpv_match_code: N` / M1 / M3.                                                                                                                             |
| Coordinate precision           | `metadata.precision`: Zip5…Zip9 by default; Street/Parcel/Rooftop require Rooftop subscription.                                                                                                            |
| Puerto Rico                    | `urbanization` input/output component.                                                                                                                                                                     |
| USPS-standard components       | **Yes, fully**: primary number, predirection, street name, suffix, postdirection, secondary designator + number, extra secondary, city, state, ZIP, plus4, delivery point.                                 |
| Storage / caching              | Perpetual retention of Output Data (except Rooftop coordinates while subscribed). No distribution.                                                                                                         |
| Privacy                        | EDP option for zero-retention; standard plan retains operational data.                                                                                                                                     |
| Cost 1k / 10k / 100k per month | Verification: ~$46/mo (12K/yr plan) / **UNVERIFIED tier price** (120K/yr) / **UNVERIFIED** (1.2M/yr → 1M or 2M tier). Autocomplete: from $21/mo (5K lookups ≈ 500 addresses). Rooftop add-on from $125/mo. |
| Latency / uptime               | 99.98% and ≤500 ms (SLA). 429 on limit; "up to 25,000 lookups/second".                                                                                                                                     |
| Key exposure                   | Embedded referer-bound key OK for Autocomplete; secret key server-side for Street API.                                                                                                                     |

---

## 5. USPS Addresses API v3 (3.3.1)

**Sources:** Addresses 3.0 portal page (https://developers.usps.com/addressesv3); OpenAPI spec 3.3.1 (https://developers.usps.com/sites/default/files/apidoc_specs/addresses-v3r2_0.yaml); Tech Sheet PDF updated 2026-08-13 (https://postalpro.usps.com/Addresses_API_Tech_Sheet); Terms and Conditions updated 1/22/2026 (https://developers.usps.com/terms-and-conditions); FAQ (https://developers.usps.com/faq). Fetched 2026-09-02.

**Capabilities.** `GET /addresses/v3/address` (standardize), `/city-state`, `/zipcode`. Inputs: `firm`, `streetAddress` (required; may embed secondary), `secondaryAddress`, `city`, `state` (2-char, incl. PR/VI/GU), `ZIPCode`, `ZIPPlus4`, `urbanization` (PR). Output: `address` {streetAddress, secondaryAddress, city, state, ZIPCode, ZIPPlus4, urbanization}, `additionalInfo` {deliveryPoint, carrierRoute, `DPVConfirmation` Y/D/S/N, `DPVEnhancedConfirmation` Y/D/S/R/N, DPVFootnotes, DPVCMRA, DPVDrop, DPVVacant, DPVEducational, centralDeliveryPoint, business/usage codes, NoStat reasons…}, `corrections[]` (code 32 = "Default address … more information is needed (such as an apartment, suite, or box number)"; code 22 = multiple addresses found, no default), `matches[]` (code 31 = single exact match), `warnings[]`. 429 with `Retry-After`; error examples include "Multiple Addresses Found", "Invalid Delivery Address", "Insufficient Address Data". OAuth 2.0 (client credentials) via developers.usps.com/oauth.

**Commercial model (Tech Sheet, effective 2026-08-01).** Requires a signed Addresses API license (DocuSign) and a funded Enterprise Payment Account. Fees: 1–2,000 events $10 flat; 2,001–10,000 $4.50/1k; 10,001–50,000 $4.25/1k; >50,000 $4.00/1k; single tier applies to whole month. Uses CASS-certified software; daily data updates; webhooks.

**Terms — disqualifying.** T&Cs: "User agrees to only use the USPS Web site, APIs, and USPS data to facilitate USPS shipping or mailing transactions unless specifically allowed otherwise"; prohibited to "use the Services or data for the purpose of creating an address list", to create a database from the data for third-party use, datamining/scraping; USPS may throttle credentials on suspicion of address-list creation; on demand User must delete credentials "and any data from the Services, including derivatives thereof". Daily request limits exist but are unspecified.

**Conclusion.** An ISP-availability consumer product is not a USPS shipping/mailing transaction. Unless USPS grants a written exception in the license agreement, the Addresses API cannot be used. Treat as **not permitted**.

### USPS test matrix (for completeness)

| Case                 | Documentation                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Single-family        | DPVConfirmation Y; match code 31.                                                                           |
| Apartment valid unit | DPVConfirmation Y (primary + secondary confirmed).                                                          |
| Unit missing         | DPVConfirmation **D**; correction code **32** ("more information is needed such as an apartment").          |
| Unit invalid         | DPVConfirmation **S** (secondary present but not confirmed); DPVEnhancedConfirmation D if dropped.          |
| Ambiguous            | Correction code 22 / "Multiple Addresses Found" error.                                                      |
| Aliases/directionals | Standardized per Pub 28 abbreviations.                                                                      |
| Rural / PO Box       | Supported; DPVEnhancedConfirmation `R` = confirmed but USPS does not deliver; carrierRoute R777/R779 notes. |
| New construction     | NoStat reason codes ("new addresses" per tech sheet).                                                       |
| Invalid              | "Invalid Delivery Address" / DPVConfirmation N.                                                             |
| Coordinates          | **None** (no geocoding).                                                                                    |
| Puerto Rico          | `urbanization` supported.                                                                                   |
| USPS components      | Lines only (`streetAddress`, `secondaryAddress`), not parsed pre/post-directional fields.                   |
| Storage              | Must delete on USPS demand; no database creation.                                                           |
| Privacy              | USPS ToS; usage monitoring.                                                                                 |
| Cost 1k / 10k / 100k | $10 / $45 / $400 — but **use not permitted** for this product.                                              |
| SLA / key            | None published; OAuth server-side.                                                                          |

---

## 6. Mapbox Geocoding API v6 (+ Search Box / Address Autofill)

**Sources:** Geocoding v6 reference (https://docs.mapbox.com/api/search/geocoding/); Pricing (https://www.mapbox.com/pricing); Terms of Service (https://www.mapbox.com/legal/tos); Product Terms PDF "Last Updated: July 21, 2026" (linked from https://www.mapbox.com/legal/product-terms); Attribution guide (https://docs.mapbox.com/help/getting-started/attribution/). Fetched 2026-09-02. (SLA page https://www.mapbox.com/legal/service-level-agreement returned 404 — SLA **UNVERIFIED**.)

**Capabilities.** `GET /search/geocode/v6/forward` with `q` or **structured input** (`address_line1` or `address_number`+`street`, `place`, `region`, `postcode`, `locality`, `neighborhood`, `country`). Feature types include `address` and **`secondary_address`** ("sub-unit, suite, or lot within a single parent address … currently available in the US only"). Secondary matching is on by default: known units are matched first, and unmatched identifiers are **extrapolated** with the parent address's coordinates (`match_code` = `plausible`). `accuracy` for address features: `rooftop`, `parcel`, `point`, `interpolated`, `approximate` (ZIP-9 centroid), `intersection`. **Smart Address Match** `match_code` per component (`matched`, `unmatched`, `not_applicable`, `inferred`, `plausible`) and `confidence` (`exact`, `high`, `medium`, `low`) — best with structured input and `autocomplete=false`. `context.address` / `context.secondary_address` sub-objects with `mapbox_id`, `address_number`, `street_name`. Default rate limit 1,000 requests/minute; batch ≤50 queries, each billed. `permanent=true` requires a card/enterprise contract.

**Pricing.** Temporary Geocoding: 100,000 free/month, then $0.75 / $0.60 / $0.45 per 1k (100k–500k / 500k–1M / 1M+). Permanent Geocoding: **no free tier**, $5.00/1k (1–500k), $4.00/1k (500k+); "only available for your own personal or business use, and cannot be used for distribution or sublicense". Search Box API sessions: 500 free, then $3.00/1k sessions (introductory).

**Storage / terms (Product Terms 2026-07).** §1.9 default: shall not "export, download, cache or store Licensed Map Content or other results". §2.7.2 **Temporary Geocodes: "Customer shall not export, store, or cache Temporary Geocodes"**; may display them (other than lat/lng) and position on a map. §2.7.1(b): shall not display latitudes/longitudes directly to End Users. §2.7.3 Permanent Geocodes may be stored, but "only for Customer's own internal business use"; use in the Licensed Application only if (i) it is not "a primary or significant feature" but "ancillary or incidental", (ii) a separate API request per End User account, (iii) no redistribution, (iv) no lat/lng shown to end users. §2.7.1(i): no building a general database of addresses. Mapbox Feature IDs may be stored (§2.7.6). The "30-day cache" idea applies to **Mapping API content on an End User's device** (§2.8.1), **not** to geocoding — the "30 days" rumor for geocoding is incorrect. Attribution: without a map, "Powered by Mapbox" with link; with a map, logo + "© Mapbox © OpenStreetMap".

**Conclusion.** For a product whose core feature _is_ resolving the user's address, Temporary geocodes cannot be stored at all (not even for the session cache/DB), and Permanent geocodes are contractually limited to ancillary features. Not suitable as the primary resolver.

### Mapbox test matrix

| Case                 | Documentation                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-family        | `feature_type: address`, `accuracy: rooftop/parcel/point/interpolated`, `match_code.confidence: exact`.                                        |
| Apartment valid unit | `feature_type: secondary_address` when the unit is known.                                                                                      |
| Unit missing         | No "unit required" signal documented.                                                                                                          |
| Unit invalid         | Unknown units are **extrapolated** (`match_code: plausible`) — i.e., silently accepted at parent coordinates.                                  |
| Ambiguous            | Multiple features ranked; `confidence` drops to high/medium/low.                                                                               |
| Aliases/directionals | `match_code.street: matched/unmatched`; not USPS-standardized.                                                                                 |
| Rural / PO Box       | Not documented; **UNVERIFIED** (PO Boxes are not geographic features).                                                                         |
| New construction     | `interpolated`/`plausible` address_number.                                                                                                     |
| Invalid              | Empty features or area-level fallback.                                                                                                         |
| Coordinates          | Explicit `accuracy` tiers incl. rooftop and parcel.                                                                                            |
| Puerto Rico          | Not documented on the reference page — **UNVERIFIED**.                                                                                         |
| USPS components      | Partial: `address_number`, `street_name`, `postcode`, place/region; no pre/post-directional, suffix, or secondary designator fields; no ZIP+4. |
| Storage              | Temporary: none. Permanent: internal use / ancillary only; no lat/lng display.                                                                 |
| Privacy              | ToS + Privacy FAQ; not evaluated in depth.                                                                                                     |
| Cost 1k / 10k / 100k | Temporary $0/$0/$0 (unstorable). Permanent $5 / $50 / $500.                                                                                    |
| SLA                  | **UNVERIFIED** (page 404). 1,000 rpm.                                                                                                          |
| Key                  | Public tokens are URL-restrictable; secret tokens server-side (**UNVERIFIED** detail — not fetched).                                           |

---

## 7. Brief evaluations

### 7.1 Lob Address Verification

**Sources:** https://www.lob.com/pricing; https://docs.lob.com/ (US Verifications); https://www.lob.com/legal/terms; https://www.lob.com/legal/privacy. Fetched 2026-09-02.
CASS-certified US verification with input `primary_line`, `secondary_line`, `urbanization`, `city`, `state`, `zip_code` (or one-line `address`). `deliverability` enum is the clearest unit vocabulary on the market: `deliverable`, `deliverable_unnecessary_unit`, `deliverable_incorrect_unit`, `deliverable_missing_unit`, `undeliverable`; plus `deliverability_analysis` (`dpv_confirmation` Y/S/D/N, `dpv_cmra`, `dpv_vacant`, `dpv_active`, `dpv_footnotes`, `suite_return_code`, `lacs_*`, `ews_match`), USPS-shaped `components` (primary_number, street_predirection, street_name, street_suffix, street_postdirection, secondary_designator, secondary_number, pmb, city, state, zip_code, zip_code_plus_4, zip_code_type, record_type, carrier_route, latitude/longitude) and `lob_confidence_score`. Pricing: Developer $0.05/verification (none included); Startup $25/mo incl. 1,000 then $0.025; Growth $450/mo incl. 50,000 then $0.009; Enterprise custom. Terms contain no explicit result-caching restriction and no address-database prohibition; Lob "has no obligation to retain any Customer Data" and may use subcontractors. Cost 1k/10k/100k ≈ $25 / $250 / $900. Coordinate precision statement not found (**UNVERIFIED**). Solid alternate to Smarty if we want per-request pricing instead of annual tiers.

### 7.2 Melissa (Global/US Address Verification)

**Sources:** https://www.melissa.com/pricing (fetched via curl 2026-09-02; the site blocks the standard fetcher); result codes https://docs.melissa.com/cloud-api/global-address-verification/result-codes.html (curl, 2026-09-02).
US Address Verification is "CASS & DPV Certified". Pricing: PAYG "$40 / 10,000 credits", **10 credits per US address** (= $0.04/address); subscription from $5,145/yr for 1,000,000 records; unlimited from $16,000; developer program tops up to 1,000 free credits/month after a one-time $4.97 KYC fee (≈100 US verifications/month). Global Address Verification has a free 250 records/month starter. Unit handling via result codes: `AV25` "verified to the SubPremise (Suite) or PO Box Level"; `AV24` premise level; `AS23` extraneous sub-premise info (unit entered but building has no secondaries; supersedes deprecated `AE17`); `AE12/AE13` box number invalid/missing; `AE14` PMB missing; `AE02` unknown street; `AC01…AC22` change codes. A dedicated "unit missing" code was not found on the page — **UNVERIFIED**. Geocode status codes GS01 (street/ZIP+4 level) … rooftop tiers. Storage terms not reviewed (**UNVERIFIED**). Cost 1k/10k/100k ≈ $40 / $400 / $4,000 PAYG (or ~$429/mo on the 1M/yr subscription). Pricier than Smarty/Lob at our volumes.

### 7.3 HERE Geocoding & Search v7

**Sources:** https://docs.here.com/geocoding-and-search/reference/get_geocode (fetched 2026-09-02). Official pricing page (https://www.here.com/get-started/pricing) renders client-side; no figures were retrievable → pricing **UNVERIFIED** (secondary sources cite ~30,000 free transactions/month and ≈$0.88/1k thereafter; not relied upon).
Result types: `houseNumber`, `street`, `locality`, `postalCodePoint`, `place`, `intersection`, `addressBlock`, `administrativeArea`. `houseNumberType`: `PA` (point address), `interpolated`, `MPA` (micro point address, restricted). Address object includes `houseNumber`, `street`, **`building`**, **`unit`**, `district`, `city`, `county`, `state`, `stateCode`, `postalCode`, `countryCode`, `label`; `scoring.queryScore` / `fieldScore`. Structured `qq` query supports `houseNumber`, `street`, `city`, `postalCode`, `state`. No DPV/CASS, no "unit missing" signal, no USPS ZIP+4. Good geocoder, not a validator.

### 7.4 Radar

**Sources:** https://radar.com/pricing; https://docs.radar.com/api ("Validate an address"). Fetched 2026-09-02.
`GET /v1/addresses/validate` with `countryCode`, `stateCode`, `city`, `postalCode`, `number`, `street`, **`unit`**, or `addressLabel`. `verificationStatus`: `verified`, `partially verified`, `ambiguous`, `unverified`; `metadata.recordType` S/P/R/H/F/G; US-only `analysis` may return **`unit:missing`** or **`unit:invalid`**. Forward geocode `confidence`: `exact`, `interpolated`, `fallback`. Rate limit 25 rps. Coverage: "only available for US and Canada addresses for enterprise customers". Pricing: "Radar does not currently offer a free tier"; annual agreements with monthly quotas; Core Maps (geocoding, autocomplete) from $0.50/1k calls; **Premium Maps (Address Validation) from $2.00/1k calls**. Cost 1k/10k/100k ≈ $2 / $20 / $200 nominal, but only under an annual enterprise contract. CASS status not stated (**UNVERIFIED**).

---

## 8. Comparative matrix (resolver-relevant rows)

| Criterion                          | Census                                | Google AV (+CASS)                                         | Google Autocomplete (New)              | Smarty US Street (+Autocomplete Pro)            | USPS v3                    | Mapbox v6                                  | Lob                                                | Melissa                 | HERE            | Radar                 |
| ---------------------------------- | ------------------------------------- | --------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- | -------------------------- | ------------------------------------------ | -------------------------------------------------- | ----------------------- | --------------- | --------------------- |
| CASS / DPV                         | No                                    | Yes (opt-in)                                              | No                                     | Yes                                             | Yes                        | No                                         | Yes                                                | Yes                     | No              | UNVERIFIED            |
| "Unit missing" signal              | No                                    | `CONFIRM_ADD_SUBPREMISES`, `missingComponentTypes`, DPV D | No                                     | DPV D, N1, H#, `missing-secondary`              | DPV D, corr. 32            | No                                         | `deliverable_missing_unit`                         | UNVERIFIED              | No              | `unit:missing`        |
| "Unit invalid" signal              | No                                    | DPV S, unconfirmed subpremise                             | No                                     | DPV S, CC/C1, S#, `unknown-secondary`           | DPV S                      | Extrapolates silently                      | `deliverable_incorrect_unit`                       | AS23                    | No              | `unit:invalid`        |
| Unit enumeration for UX            | No                                    | No                                                        | No                                     | Yes (Autocomplete Pro `entries` + `selected`)   | No                         | Partial (`secondary_address`)              | No                                                 | No                      | No              | No                    |
| USPS parsed components incl. ZIP+4 | Partial (no primary #, no unit, ZIP5) | Lines + typed components; parse needed                    | No                                     | Full                                            | Lines only                 | Partial                                    | Full                                               | Yes (UNVERIFIED detail) | No              | UNVERIFIED            |
| Coordinates                        | Interpolated                          | Premise/proximity                                         | Via Place Details                      | ZIP9 default; rooftop add-on                    | None                       | Rooftop/parcel/interp.                     | Yes (precision UNVERIFIED)                         | GS codes                | PA/interpolated | exact/interp.         |
| Puerto Rico                        | Yes (`addressPR`)                     | Yes (CASS w/ `PR`)                                        | UNVERIFIED                             | Yes (urbanization)                              | Yes                        | UNVERIFIED                                 | Yes (urbanization)                                 | UNVERIFIED              | UNVERIFIED      | UNVERIFIED            |
| Storage of results                 | Unrestricted                          | 30 days (or replace with user-confirmed)                  | Place ID only                          | Perpetual (rooftop coords while subscribed)     | Delete on demand; no DB    | Temporary: none; Permanent: ancillary only | No explicit limit                                  | UNVERIFIED              | UNVERIFIED      | UNVERIFIED            |
| Product use permitted              | Yes                                   | Yes                                                       | Yes                                    | Yes                                             | **No** (USPS mailing only) | Constrained                                | Yes                                                | Yes                     | Yes             | Yes                   |
| Free tier / month                  | Unlimited                             | 5,000 (Pro) / 1,000 (Ent.)                                | 10,000 req                             | 42-day 1,000 trial                              | None                       | 100k temporary                             | None                                               | ~100 addr               | UNVERIFIED      | None                  |
| Price at 10k/mo                    | $0                                    | $85 / $225                                                | ~$0 w/ AV session                      | UNVERIFIED tier (base ≈$46/mo for 1k/mo)        | $45 (n/a)                  | $50 permanent                              | $250                                               | $400                    | UNVERIFIED      | $20 (annual contract) |
| Uptime SLA                         | None                                  | 99.9% SLO                                                 | 99.9% SLO                              | 99.98%, ≤500 ms                                 | None                       | UNVERIFIED                                 | UNVERIFIED                                         | UNVERIFIED              | UNVERIFIED      | UNVERIFIED            |
| Rate limit                         | Undocumented                          | 6,000 QPM                                                 | Undocumented                           | 25k/s claimed                                   | Daily, unspecified         | 1,000 rpm                                  | UNVERIFIED                                         | UNVERIFIED              | 429 only        | 25 rps                |
| Browser key                        | n/a                                   | Server only                                               | JS lib key OK; web service server only | Embedded key (Autocomplete); secret server-side | Server (OAuth)             | Public token URL-restricted                | Publishable key for autocomplete only (UNVERIFIED) | UNVERIFIED              | UNVERIFIED      | Publishable           |

---

## 9. Cost projection (list prices, 2026-09-02)

Assumptions: one resolver call per submitted address; autocomplete ≈10 keystroke requests per address; no negotiated discounts.

| Volume / month | Smarty (Verification + Autocomplete Pro)                                           | Google AV Pro + per-request Autocomplete                                                             | Google AV Enterprise session (Autocomplete free) | Lob                          | Melissa PAYG                       | Mapbox Permanent | Census |
| -------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------- | ---------------------------------- | ---------------- | ------ |
| 1k             | ~$46 (12K/yr plan) + $21 (5K lookups ≈ 500 addr; next tier UNVERIFIED) ≈ **$67+**  | $0 (under 5k / 10k caps)                                                                             | $0 (under 1k cap)                                | $25                          | $40 (or free 100)                  | $5               | $0     |
| 10k            | Verification 120K/yr tier **UNVERIFIED**; Autocomplete 125K/mo tier **UNVERIFIED** | AV 5k×$17 = $85; Autocomplete 100k req: 90k×$2.83 = $254.70 → **≈$340**                              | 9k×$25 = **$225**                                | $25 + 9k×$0.025 = **$250**   | **$400**                           | **$50**          | $0     |
| 100k           | Verification 1.2M/yr → 2M tier **UNVERIFIED**; Autocomplete 1.0M/mo → custom       | AV 95k×$17 = $1,615; Autocomplete 1M req: 90k×2.83 + 400k×2.27 + 500k×1.70 = $2,012.70 → **≈$3,628** | 99k×$25 = **$2,475**                             | $450 + 50k×$0.009 = **$900** | **$4,000** (or ~$429/mo 1M/yr sub) | **$500**         | $0     |

Observations:

- Google's cheapest correct path is the **Enterprise session** (Autocomplete free, AV $25/1k) — roughly 30% cheaper than Pro + per-request Autocomplete at 100k. Free caps make Google effectively free below ~1k–5k/month.
- Smarty's public page only prices the base tier; we must request the 120K/yr and 1M–2M/yr quotes before committing. Its annual-tier model (no overage; HTTP 402 when exhausted) requires monitoring and auto-renew.
- Lob is the cheapest CASS-certified per-request option at 100k ($900) and has no storage restriction, making it the natural **second source / migration target** if Smarty's tier pricing disappoints.

---

## 10. Recommendation

### Primary resolver for V1: Smarty US Street Address API (with `match=invalid`, `candidates=5`), plus Smarty US Autocomplete Pro for entry UX

Why:

1. **Unit semantics ISPs need**: `dpv_match_code` D/S, `dpv_footnotes` N1/CC/C1, `footnotes` H#/S#, `enhanced_match` missing-/unknown-secondary, `record_type: H`, and Autocomplete Pro's per-building unit enumeration (`entries` → `selected`) let us prompt "pick your apartment" before we hit ISP checks.
2. **Provider-ready output**: full USPS parsed components (predirectional, suffix, postdirectional, secondary designator/number, ZIP+4, delivery point, urbanization) with no re-parsing.
3. **Storage rights**: perpetual retention of Output Data; the app can persist a resolved address record without an expiry timer. Only rooftop coordinates (if purchased) carry a subscription-bound restriction.
4. **Operational**: published SLA (99.98%, ≤500 ms), referer-bound embedded key for browser autocomplete, secret key server-side, Enhanced Data Privacy option if we want zero-retention on Smarty's side.
   Caveats: default coordinates are ZIP-9 level (fine for ISP checks, which key on address not lat/lng); buy Rooftop only if a map feature needs it. Confirm tier pricing (60K–2M/yr) and EDP terms in writing before launch.

### Role of the US Census Geocoder: free corroboration + last-resort fallback

- **Corroboration**: after Smarty returns `Y/S/D`, call Census `address` (or `addressPR`) server-side with the _standardized street line_ (unit stripped, since Census ignores it) to obtain interpolated coordinates, county, tract, and TIGER match type at $0. Use `Match`/`Exact` as a confidence booster and `No_Match` as a soft flag (new construction, rural gaps, Title 13 suppression) — never as a rejection.
- **Fallback**: if Smarty is down or the plan is exhausted (402), degrade to Census for street-level existence checking and mark the result `validation_state: partial`, `unit_state: unknown`, and prompt the user to confirm the unit manually. Do not present Census output as "verified".
- Never call Census from the browser (avoid leaking user addresses to a third origin and to keep retry/backoff server-side); expect load-related inconsistency and put a short timeout + single retry around it.

### Secondary/backup validator (optional, phase 2): Google Address Validation with CASS, session-terminated

Use only for addresses Smarty cannot confirm (`N` or empty) to get a second CASS opinion and `possibleNextAction`. Store nothing from Google beyond 30 days except the place ID; treat its standardized address as a _suggestion_ the user must confirm (which converts it to End User data under SST §B.1.3.2). If Google is later preferred as primary, the Enterprise-session path is the cost-optimal configuration and the resolver contract below already carries the required `expires_at`.

### Lock-in / migration consequences

- Smarty → Lob or Melissa: low effort; all three emit USPS/DPV vocabulary (Y/N/S/D, record types, footnotes) and parsed components. Keep `raw_vendor_response` out of the domain model so a swap only touches the adapter.
- Smarty → Google: contract must add 30-day expiry handling and Google attribution/ToS clauses; unit enumeration UX is lost (Google Autocomplete does not enumerate units).
- Anything → Mapbox: not viable without an enterprise contract that lifts §2.7.2/2.7.3.
- USPS v3: unavailable regardless of migration path.
- Census is vendor-neutral glue and never needs migrating.

---

## 11. Application-owned `AddressResolver` output contract (v1)

Design rules: (1) the user's typed unit is preserved verbatim even if the vendor drops or rewrites it; (2) coordinates are optional and carry a source + permitted-until stamp; (3) every stored vendor-derived field has `source_restrictions` so a Google/Mapbox adapter can enforce expiry; (4) the "display" address is safe to show and never includes the user's raw free text unless validation failed.

```jsonc
{
  "resolver": { "name": "smarty-us-street", "version": "2026-09-02", "vendor_request_id": "opaque" },
  "resolved_at": "2026-09-02T00:00:00Z",

  "input_echo": {
    "raw_line1": "string (user text, stored only for correction UX; never sent to ISPs)",
    "raw_unit": "string|null   // ALWAYS retained exactly as typed",
    "raw_city": "string|null",
    "raw_state": "string|null",
    "raw_zip": "string|null",
  },

  "validation": {
    "state": "verified | verified_unit_missing | verified_unit_unconfirmed | partial | ambiguous | unverified | invalid",
    "dpv_code": "Y | N | S | D | null",
    "record_type": "S | H | P | R | F | G | null",
    "rdi": "residential | commercial | unknown",
    "vacant": "bool|null",
    "no_stat": "bool|null",
    "changes": ["zip_corrected", "city_corrected", "street_spelling", "abbreviation", "..."],
    "vendor_codes": ["N1", "H#", "missing-secondary"],
    "corroboration": { "census_match": "Match|Tie|No_Match|null", "census_match_type": "Exact|Non_Exact|null" },
  },

  "unit": {
    "state": "confirmed | missing_required | unrecognized | not_applicable | unknown",
    "user_supplied": "string|null   // == input_echo.raw_unit",
    "standardized": { "designator": "APT|STE|UNIT|...|null", "number": "string|null" },
    "candidates": [{ "designator": "APT", "number": "string" }], // from Autocomplete Pro `selected`, optional
  },

  "display_address": {
    "line1": "string",
    "line2": "string|null",
    "last_line": "string",
    "safe_to_show": true, // false when state is unverified/invalid (show input_echo instead, labeled)
  },

  "provider_address": {
    // USPS Pub 28 shaped; what ISP adapters consume
    "primary_number": "string",
    "predirectional": "string|null",
    "street_name": "string",
    "suffix": "string|null",
    "postdirectional": "string|null",
    "secondary_designator": "string|null",
    "secondary_number": "string|null",
    "extra_secondary_designator": "string|null",
    "extra_secondary_number": "string|null",
    "pmb": "string|null",
    "urbanization": "string|null",
    "city": "string",
    "state": "string",
    "zip5": "string",
    "plus4": "string|null",
    "delivery_point": "string|null",
    "carrier_route": "string|null",
    "one_line": "string   // rendered from the fields above, unit from `unit` block",
    "components_source": "vendor | user_confirmed",
  },

  "geo": {
    // omitted entirely when not permitted or unavailable
    "lat": 0.0,
    "lon": 0.0,
    "precision": "rooftop | parcel | street_interpolated | zip9 | zip7 | zip5 | unknown",
    "source": "smarty | census | google | none",
    "permitted_until": "ISO-8601|null   // null = no expiry (Census, Smarty non-rooftop); 30d for Google; subscription-bound for Smarty rooftop",
  },

  "ambiguity": {
    "candidates": [{ "provider_address": {}, "display_address": {}, "score_hint": "string|null" }],
    "actions": ["ADD_UNIT | CONFIRM_UNIT | CHOOSE_CANDIDATE | FIX_STREET | FIX_ZIP | CONFIRM_CORRECTIONS | NONE"],
  },

  "source_restrictions": {
    "vendor": "smarty | google | lob | census | ...",
    "retain_until": "ISO-8601|null",
    "must_replace_with_user_confirmation": false, // true for Google address fields
    "attribution_required": "none | google_maps | mapbox | census_notice",
    "redistribution_allowed": false,
  },
}
```

State machine for `validation.state` (Smarty adapter): `Y` → `verified`; `D` → `verified_unit_missing` (+ action ADD_UNIT); `S` → `verified_unit_unconfirmed` (+ CONFIRM_UNIT, with `unit.user_supplied` preserved); >1 candidate → `ambiguous` (+ CHOOSE_CANDIDATE); `N` with Census `Match` → `partial`; `N` and Census `No_Match` → `unverified`; empty/garbage → `invalid`. Google adapter maps `possibleNextAction` ACCEPT/CONFIRM_ADD_SUBPREMISES/CONFIRM/FIX onto the same states and sets `retain_until = now+30d`, `must_replace_with_user_confirmation = true`.

---

## 12. Sources (all fetched 2026-09-02)

US Census

- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
- https://geocoding.geo.census.gov/geocoder/
- https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html
- https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_User_Guide.pdf
- https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_FAQ.pdf
- https://www.census.gov/data/developers/about/terms-of-service.html

Google

- https://developers.google.com/maps/documentation/address-validation/overview
- https://developers.google.com/maps/documentation/address-validation/understand-response
- https://developers.google.com/maps/documentation/address-validation/handle-us-address
- https://developers.google.com/maps/documentation/address-validation/build-validation-logic
- https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress
- https://developers.google.com/maps/documentation/address-validation/coverage
- https://developers.google.com/maps/documentation/address-validation/usage-and-billing
- https://developers.google.com/maps/documentation/address-validation/faq
- https://developers.google.com/maps/documentation/address-validation/policies
- https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
- https://developers.google.com/maps/documentation/places/web-service/session-pricing
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/billing-and-pricing/sku-details
- https://developers.google.com/maps/api-security-best-practices
- https://cloud.google.com/maps-platform/terms (Last modified August 26, 2026)
- https://cloud.google.com/maps-platform/terms/maps-service-terms (Last modified June 10, 2026)
- https://cloud.google.com/maps-platform/terms/sla (Last modified January 27, 2025)

Smarty

- https://www.smarty.com/docs/cloud/us-street-api
- https://www.smarty.com/docs/cloud/us-autocomplete-pro-api
- https://www.smarty.com/docs/cloud/authentication
- https://www.smarty.com/pricing
- https://www.smarty.com/pricing/us-address-verification
- https://www.smarty.com/pricing/us-address-autocomplete
- https://www.smarty.com/pricing/us-rooftop-geocoding
- https://www.smarty.com/legal/terms-of-service
- https://www.smarty.com/legal/service-level-agreement
- https://www.smarty.com/legal/privacy-policy

USPS

- https://developers.usps.com/addressesv3
- https://developers.usps.com/sites/default/files/apidoc_specs/addresses-v3r2_0.yaml (OpenAPI 3.3.1)
- https://postalpro.usps.com/Addresses_API_Tech_Sheet (PDF updated August 13, 2026)
- https://developers.usps.com/terms-and-conditions (Updated 1/22/2026)
- https://developers.usps.com/faq

Mapbox

- https://docs.mapbox.com/api/search/geocoding/
- https://www.mapbox.com/pricing
- https://www.mapbox.com/legal/tos
- https://www.mapbox.com/legal/product-terms → Product Terms PDF (Last Updated July 21, 2026)
- https://docs.mapbox.com/help/getting-started/attribution/

Others

- Lob: https://www.lob.com/pricing ; https://docs.lob.com/ ; https://www.lob.com/legal/terms ; https://www.lob.com/legal/privacy
- Melissa: https://www.melissa.com/pricing ; https://docs.melissa.com/cloud-api/global-address-verification/result-codes.html
- HERE: https://docs.here.com/geocoding-and-search/reference/get_geocode (pricing page not machine-readable → UNVERIFIED)
- Radar: https://radar.com/pricing ; https://docs.radar.com/api

Items marked UNVERIFIED in the text were not confirmable on an official page during this session and should be confirmed with the vendor before contract signature: Smarty tier prices above the base tier and EDP terms; Google CASS SKU impact and AV inclusion in the SLA; Mapbox SLA and PR coverage; Lob coordinate precision; Melissa unit-missing code and storage terms; HERE pricing; Radar CASS status.
