# Provider qualification feasibility and terms matrix

Research snapshot: 2026-09-02. Method: official public pages, terms, privacy policies, robots.txt, help-center articles, and passive fetch observations only. **No address was submitted to any provider, no endpoint was reverse engineered, no CAPTCHA, WAF, or rate limit was bypassed, and nothing was logged in to.** Blocks (403, timeouts) are recorded as evidence.

This document is the evidence artifact for PLA-346 and PLA-347 and the basis for ADR-004. Verdict vocabulary: `approve`, `approve_with_limits`, `link_only`, `reject`.

---

# Part A — Xfinity, AT&T, Spectrum, Verizon

**Providers:** Xfinity (Comcast), AT&T Internet / AT&T Fiber, Spectrum (Charter), Verizon Fios + Verizon Home Internet (5G Home / LTE Home)
**Research date:** 2026-09-02 (all fetches performed this date unless noted)
**Method:** Read-only review of providers' official public pages (availability pages, website terms, privacy policies, robots.txt, partner/affiliate pages, Broadband Facts pages) via WebFetch/WebSearch, plus passive `HEAD` requests (no body, no form data) to record CDN/WAF response headers. **No address was entered into any form. No XHR/JSON endpoint was called or inspected. No CAPTCHA was solved. No login. No proxies.** Where a page blocked or timed out, that is recorded as evidence.

**Legend:** `UNKNOWN` = not discoverable from official public pages during this review. `UNVERIFIED` = reported by a non-official or secondary source, or by a search-result snippet, and not confirmed on an official page.

**Overall posture:** All four providers publish website terms that either explicitly prohibit automated access/scraping (Xfinity, AT&T, Verizon) or could not be retrieved at all (Spectrum), and all four sit behind Akamai bot-management. None publishes a consumer-facing serviceability API. **Recommended verdict for all four: `link_only`** pending qualified legal review and/or a written partner agreement.

---

## 1. Xfinity (Comcast)

### 1.1 Identity

| Item                        | Finding                                                                                                                                                                                                                                                                                                                                           | Source (fetched 2026-09-02)                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Legal entity for web terms  | **Comcast Cable Communications, LLC** (named in the Web Services Terms of Service and Visitor Agreement)                                                                                                                                                                                                                                          | https://www.xfinity.com/terms/web ; https://www.xfinity.com/corporate/legal/visitoragreement                               |
| Parent                      | Comcast Corporation (NASDAQ: CMCSA)                                                                                                                                                                                                                                                                                                               | https://www.sec.gov/Archives/edgar/data/1166691/000095010326000079/dp239108_ex9901.htm                                     |
| Brand aliases               | Xfinity; NOW (prepaid brand referenced in the affiliate program: "Xfinity or NOW products"); Comcast                                                                                                                                                                                                                                              | https://www.xfinity.com/hub/affiliate-program/working-with-xfinity                                                         |
| 2025–2026 corporate change  | Comcast completed the **Versant Media Group** separation "effective as of 11:59 p.m. Eastern Time on January 2, 2026" (cable networks spun out). Xfinity stays with Comcast: "We deliver world-class broadband, wireless, and video through Xfinity, Comcast Business, and Sky". No effect on the Xfinity brand or the entity behind xfinity.com. | SEC 8-K Ex. 99.1 dated 2026-01-05 (URL above)                                                                              |
| Footprint (official, dated) | "58 million homes and businesses in 39 states and the District of Columbia" — **April 2019** Comcast press release; current official count UNKNOWN (newer official pages were blocked). Third-party sites cite 39–41 states (UNVERIFIED).                                                                                                         | https://corporate.comcast.com/press/releases/comcast-now-nations-largest-provider-of-gigabit-internet (via search snippet) |

### 1.2 Service & qualification URLs

| Purpose                                    | URL                                                                                                                       | Status observed 2026-09-02                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Internet service / check-availability page | https://www.xfinity.com/learn/internet-service                                                                            | **HTTP 403** (WebFetch, twice; and `curl -I`)                                            |
| Offers page                                | https://www.xfinity.com/learn/offers                                                                                      | **HTTP 403**                                                                             |
| Homepage                                   | https://www.xfinity.com/                                                                                                  | **HTTP 403** (WebFetch and `curl -I`)                                                    |
| Locations index                            | https://www.xfinity.com/locations                                                                                         | HTTP 404                                                                                 |
| Moving / check new address                 | https://www.xfinity.com/learn/moving                                                                                      | 200 (fetched)                                                                            |
| Serviceability support article             | https://www.xfinity.com/support/articles/determining-serviceability                                                       | 200 but **body empty** (`content-length: 0`; only `<title>` recovered) — client-rendered |
| Deep-link order/shop URL                   | UNKNOWN. robots.txt disallows `/shop/`, `/buy/`, `/Checkout/`, `/lp/`, `/localize/`, `/localization/`, `/learn/tenant/*`. | https://www.xfinity.com/robots.txt                                                       |
| ZIP-only query parameter support           | UNKNOWN (shop pages not retrievable)                                                                                      | —                                                                                        |
| **Official fallback URL for users**        | https://www.xfinity.com/learn/internet-service (primary) ; https://www.xfinity.com/learn/moving (existing customers)      | —                                                                                        |

### 1.3 Markets & technologies

- Cable/HFC (DOCSIS) is Comcast's core access technology; the official product pages that would state this were 403 during this review, so technology mix is **UNVERIFIED from official pages on this date**. No fiber-to-the-home consumer brand, DSL, or satellite offering observed.

### 1.4 Availability form inputs & outcomes (public descriptions only)

| Item                                  | Finding                                                                                                                                                                      | Source                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs                                | UNKNOWN (form page blocked). Moving page: "We'll let you know if Xfinity is available at your new address — and you can schedule a move up to 30 days in advance."           | https://www.xfinity.com/learn/moving                                                                                                                                            |
| Unit-required outcome                 | Official Xfinity Community Forum (Comcast-operated) thread quotes the tool: "Looks like there's multiple units in your building. Please select your apartment number"        | https://forums.xfinity.com/conversations/customer-service/moving-to-new-address-but-cant-select-unit-number/60e35ba10861702d9ce0a4cb (thread dated 2021-07-05)                  |
| Unavailable outcome                   | Forum thread quotes: "Unfortunately, Xfinity service is not available at this address"                                                                                       | https://forums.xfinity.com/conversations/customer-service/unfortunately-xfinity-service-is-not-available-at-this-address-...-615e8bf9dc872674e0fc6155 (thread dated 2021-10-07) |
| Address-not-found / new-build         | Forum staff replies direct users to DM the serviceability team with full address incl. unit (UNVERIFIED wording; from search snippets of forum threads)                      | forums.xfinity.com search results                                                                                                                                               |
| Address-specific plans/prices in flow | Broadband labels page says "Enter an address to get started", implying address-specific label/plan output. Whether the shop flow shows address-specific pricing: UNVERIFIED. | https://www.xfinity.com/broadband-labels                                                                                                                                        |

### 1.5 Broadband Facts labels

- Landing page: https://www.xfinity.com/broadband-labels (200). It is **address-gated** ("Enter an address to get started"); **no index of labels, no machine-readable files, no per-plan links** observed. Disclosure page: https://www.xfinity.com/policies/internet-broadband-disclosures (from search; not fetched).
- Labels linked from plan cards: UNKNOWN (plan pages blocked).

### 1.6 Transport / partner programs

- **Xfinity Affiliate Program** (official): https://www.xfinity.com/hub/affiliate-program and https://www.xfinity.com/hub/affiliate-program/working-with-xfinity. Runs on **CJ (Commission Junction)**; partners get "Branded assets to promote Xfinity products online" and a tracking "cookie window". **No API, data feed, or availability widget is mentioned.** Application is via CJ sign-up; approval is manual ("A member of our Xfinity Affiliate Program team will be in touch").
- No public serviceability/qualification API or developer program found. **Public docs show only the consumer browser flow.**

### 1.7 Cookies, CAPTCHA, WAF, rate limits (observed)

- `HEAD https://www.xfinity.com/` and `/learn/internet-service` → **403** with no `server` header, `x-ak-cn: US` header (Akamai edge indicator), and an `xpgn` cookie. `HEAD /support/articles/determining-serviceability` → 200 setting `_abck` and `bm_sz` cookies (**Akamai Bot Manager**). CSP header on that page lists `retail360-location-api-prod.codebig2.net` and `maps.googleapis.com` among `connect-src`, consistent with a client-rendered app (header observation only; nothing was called).
- CAPTCHA: not observed (pages returned 403 outright rather than a challenge). Rate limits/timeouts: UNKNOWN.
- Interpretation: the shopping surface actively refuses non-browser user agents.

### 1.8 Fixture / parser-test feasibility

- Support and shop pages are client-rendered (empty body on the support article). Availability result markup could not be observed. A sanitized fixture would have to be hand-captured from a real browser session, and no official documentation describes result-state markup. **Feasibility: low.**

### 1.9 Terms, privacy, robots

| Document                              | URL                                                                                                                                            | Date                     | Quotes (≤25 words)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xfinity Web Services Terms of Service | https://www.xfinity.com/terms/web                                                                                                              | Effective Feb 13, 2024   | "You will not access or attempt to access the Web Services through any automated means, including scripts or web crawlers, except through APIs…" ; "You may only use the Web Services for personal, residential, and non-commercial purposes, unless we make an exception in writing." ; "You will not systematically retrieve data or content from the Web Services to create a collection, compilation, database, or directory…" |
| Comcast Visitor Agreement             | https://www.xfinity.com/corporate/legal/visitoragreement                                                                                       | Effective Feb 13, 2024   | "…license to view the Content and use this Site for personal, non-commercial purposes." ; "We do not permit framing or inline linking to our Site or any part of it."                                                                                                                                                                                                                                                              |
| Privacy Policy                        | https://www.xfinity.com/privacy/policy (**403** to WebFetch); PDF copy https://assets.xfinity.com/assets/dotcom/privacy-center/PP_04232026.pdf | Effective April 23, 2026 | Address-collection clause not extractable from PDF in this pass (UNKNOWN).                                                                                                                                                                                                                                                                                                                                                         |
| robots.txt                            | https://www.xfinity.com/robots.txt (reviewed 2026-09-02)                                                                                       | —                        | `Disallow: /shop/`, `/buy/`, `/Checkout/`, `/lp/`, `/localize/`, `/localization/`, `/search`, `/learn/tenant/*`. `/learn/internet-service` **not** disallowed. www.comcast.com/robots.txt: `Disallow:` (empty; allow-all).                                                                                                                                                                                                         |

### 1.10 Verdict: **link_only**

Rationale: Web Services ToS expressly bars automated access "except through APIs or other interfaces specifically provided", restricts use to "personal, residential, and non-commercial purposes", and the shop surface returns 403 to non-browser clients. The only official partner channel (CJ affiliate) provides links/assets, not an integration. **Legal review questions:** (a) whether a CJ affiliate agreement could be extended in writing to cover an availability-check integration; (b) whether deep-linking with a ZIP parameter (if one exists) is permitted under the Visitor Agreement's anti-framing/inline-linking clause.

---

## 2. AT&T Internet / AT&T Fiber / AT&T Internet Air

### 2.1 Identity

| Item                       | Finding                                                                                                                                                                                                                                                                                                                                                           | Source                                                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal entity for web terms | "AT&T Inc. and subsidiaries/affiliates" (Web Services Terms of Use)                                                                                                                                                                                                                                                                                               | https://www.att.com/legal/terms.attWebsiteTermsOfUse.html                                                                                                                                                                                          |
| Brand aliases              | AT&T Internet, AT&T Fiber, AT&T Internet Air (5G fixed wireless), legacy U-verse; affiliates named in privacy notice search snippet: Gigapower, Cricket, **Quantum Fiber** (UNVERIFIED—page 403)                                                                                                                                                                  | https://about.att.com/privacy/privacy-notice.html (403)                                                                                                                                                                                            |
| 2025–2026 corporate change | AT&T completed acquisition of Lumen's Mass Markets fiber business (Quantum Fiber) — press release dated **Feb 2, 2026**; "AT&T Fiber … will be available to millions more people"; adds 4M+ locations in 11 states (Denver, Seattle, Salt Lake City cited). Reports that assets sit in a subsidiary ("Forged Fiber") are UNVERIFIED (not in the PR text fetched). | https://www.prnewswire.com/news-releases/americas-best-and-largest-network-just-got-larger-att-completes-acquisition-of-lumens-mass-markets-fiber-business-302676205.html ; https://about.att.com/story/2026/att-lumen-deal-close.html (timed out) |
| Footprint                  | Fiber "21 states" — third-party (UNVERIFIED). Internet Air: "Not available in all areas."                                                                                                                                                                                                                                                                         | https://www.att.com/internet/access/internet-air-available/                                                                                                                                                                                        |

### 2.2 Service & qualification URLs

| Purpose                            | URL                                                                                               | Status 2026-09-02                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Check availability (official)**  | https://www.att.com/internet/availability/                                                        | 200                                                                                                                    |
| Internet Air availability          | https://www.att.com/internet/access/internet-air-available/                                       | 200                                                                                                                    |
| Support how-to                     | https://www.att.com/support/article/u-verse-high-speed-internet/KM1009644/                        | 200 — "Go to the Check availability page. Enter your home address. Review the options and choose a plan to check out." |
| Lead/callback form (ZIP + contact) | https://www.att.com/cfd/internet/form/                                                            | 200; asks ZIP, name, email, phone (no street/unit); robots disallows `/cfd/`                                           |
| Shop/order deep link               | https://www.att.com/buy/broadband (robots-disallowed; as a consumer deep-link target: UNVERIFIED) | not fetched                                                                                                            |
| ZIP-only query parameter           | UNKNOWN                                                                                           | —                                                                                                                      |
| **Official fallback URL**          | https://www.att.com/internet/availability/                                                        | —                                                                                                                      |

### 2.3 Markets & technologies (official page text)

- **AT&T Fiber** (FTTH). **Internet Air** = fixed wireless: "Get fast, reliable home internet over the 5G wireless network"; "LTE coverage may be used depending on signal availability at your address"; "5G coverage not available everywhere". Legacy copper/DSL "AT&T Internet": not mentioned on the availability page (UNVERIFIED whether still sold).

### 2.4 Availability form inputs & outcomes

| Item                          | Finding                                                                                                                                                                                                                                      | Source                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Inputs                        | "Enter your home or business address"; a status string "Checking availability" and a validation string "This is a business address" are present in page text. Apt/unit field: UNKNOWN. ZIP: UNKNOWN (likely part of address; not confirmed). | https://www.att.com/internet/availability/                                                   |
| Available                     | Internet Air pre-approval copy: "Great news, home internet is available at your address! See if your household qualifies for this special pricing."                                                                                          | https://www.att.com/internet/access/internet-air-available/                                  |
| Unavailable                   | "Not available in all areas." ; ToS: "AT&T Internet Services are not available in all areas and may not be available at certain speed tiers (or at all) at your location…"                                                                   | Internet Air page; https://www.att.com/legal/terms.HSIAAttTermsofService.html (Jan 14, 2019) |
| Unit-required / MDU           | ToS: "provision of your Service may be subject to other terms and conditions imposed by the owner and/or manager of the MTU (e.g. a landlord or home owner's association)." UI unit-selection wording: UNKNOWN.                              | same ToS                                                                                     |
| Address-specific plans/prices | Support article: after address entry "Review the options and choose a plan to check out" → plans shown per address; pricing specifics UNVERIFIED.                                                                                            | KM1009644                                                                                    |

### 2.5 Broadband Facts labels

- Index/download page: https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/ — "Download Broadband Facts for any of our current AT&T plans." (formats not stated on page text; machine-readable per title).
- Address-gated label viewer: https://www.att.com/dapbbfacts — "Enter your address to get started" with wireless/wireline choice.
- Explainer: https://www.att.com/support/article/my-account/000100570/ . Individual label URL pattern observed in search index: `https://www.att.com/labels/shared/nutrition/<id>`. https://www.att.com/broadbandlabels/ → 404.
- Labels linked from plan cards: UNKNOWN.

### 2.6 Transport / partner programs

- **Authorized Dealer**: https://www.att.com/newdealer/contactus/ — a "Contact Us" form only; no program terms, tooling, or API described publicly.
- **Business** channel programs (Partner Exchange, Alliance Channel, VAR): https://www.business.att.com/industries/partner-solutions.html — business-customer oriented; not consumer serviceability.
- Third-party master distributors (DSI "SARA Plus", RS&I) advertise dealer order tools — **UNVERIFIED and not official**.
- **Public docs show only the consumer browser flow** for residential qualification.

### 2.7 Cookies, CAPTCHA, WAF (observed)

- `HEAD https://www.att.com/` and `/internet/availability/` → 200, setting `_abck` and `bm_sz` (**Akamai Bot Manager**). robots.txt also blocks session-ID parameters and `/apis/maps/v2/locator/...`.
- WebFetch: `/legal/terms.websiteTermsOfUse.html` returned "legal document … does not exist" (wrong slug); `about.att.com/privacy/` and `/privacy/privacy-notice.html` → **403**; `about.att.com/story/...` timed out. Main att.com pages were retrievable.
- CAPTCHA: not observed. Rate limits: UNKNOWN.

### 2.8 Fixture feasibility

- Availability page ships server-rendered marketing copy plus dynamic status strings; the result view is dynamic. A sanitized shell fixture is plausible; result-state fixtures would need browser capture. **Feasibility: medium-low.**

### 2.9 Terms, privacy, robots

| Document                       | URL                                                                                                                  | Date                                                   | Quotes (≤25 words)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT&T Web Services Terms of Use | https://www.att.com/legal/terms.attWebsiteTermsOfUse.html                                                            | "Last Updated: January 2020"                           | §14.13: "Uses any robot, spider, or other such programmatic or automatic device … to obtain information from the Site" ; §14.22: "Systematically collects and uses any Content including the use of any data mining, or similar data gathering and extraction methods" ; §14.20: "Reproduces, duplicates, copies, sells, trades, resells or exploits for any commercial purposes, any portion of the Sites or Content" ; §6: "…right to access the Sites, the Content and the Software for your personal non-commercial use only" ; §14.24 (framing) ; §14.25: "Attempts to derive the source code for the computer systems and other technology that operate our Site" |
| AT&T Internet Terms of Service | https://www.att.com/legal/terms.HSIAAttTermsofService.html                                                           | Jan 14, 2019                                           | see §2.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Privacy Notice                 | https://about.att.com/privacy/privacy-notice.html (**403**)                                                          | Search snippet: last updated May 27, 2026 (UNVERIFIED) | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| robots.txt                     | https://www.att.com/robots.txt (reviewed 2026-09-02; edit markers through "06.24.26", footer "Last Update 5.1.2024") | —                                                      | `Disallow: /buy/broadband`, `/buy/cart`, `/buy/bundles`, `/cfd/`, `/acctmgmt/*`, `/apis/maps/v2/locator/search/query.json`; `User-agent: DotBot / dotbot → Disallow: /`. No line matching `availability` observed → `/internet/availability/` appears **allowed**.                                                                                                                                                                                                                                                                                                                                                                                                      |

### 2.10 Verdict: **link_only**

Rationale: ToS §14.13/§14.22 prohibit robots/spiders and systematic collection; §6 limits use to personal non-commercial; the site runs Akamai Bot Manager. The dealer program is contact-form only with no public integration tier. **Legal review questions:** (a) whether an Authorized Dealer/Solution Provider agreement offers a sanctioned serviceability tool and on what terms; (b) whether deep-linking to `/internet/availability/` with pre-filled ZIP (if supported) is permitted.

---

## 3. Spectrum (Charter Communications)

### 3.1 Identity

| Item                       | Finding                                                                                                                                                                                                                                                                                                                                                                         | Source                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal entities             | Parent: **Charter Communications, Inc.** (NASDAQ: CHTR). Operating: **Charter Communications Operating, LLC** (Cox residential cable was "contributed … to Charter Communications Operating, LLC").                                                                                                                                                                             | https://www.sec.gov/Archives/edgar/data/0001091667/000114036126033909/ef20080687_8k.htm (via search snippet)                                                                                                      |
| 2025–2026 corporate change | **Charter–Cox transaction completed Aug 19, 2026** (8-K) / announced Aug 20, 2026 (press). "Within a year, the parent company will be called Cox Communications but will continue to operate as Spectrum across all markets." Expanded Spectrum footprint "covers 45 states." Cox markets to migrate to Spectrum products/pricing by mid-Sept 2026 (UNVERIFIED — news summary). | https://www.kwch.com/2026/08/20/major-merger-involving-cox-communications-finalized/ ; https://corporate.charter.com/newsroom/charter-and-cox-communications-complete-transaction (fetched but content truncated) |
| Brand aliases              | Spectrum (consumer), Cox (transitioning to Spectrum), legacy Time Warner Cable / Bright House; parent to be renamed Cox Communications. **Identity is in flux — re-check before launch.**                                                                                                                                                                                       | same                                                                                                                                                                                                              |
| Footprint                  | 41 states pre-merger (third-party, UNVERIFIED); 45 states post-merger (news). Official page: UNKNOWN (blocked).                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                 |

### 3.2 Service & qualification URLs

| Purpose                                                       | URL                                                                                                                   | Status 2026-09-02                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Check availability (official, per Spectrum resource page)** | https://www.spectrum.com/address/localization                                                                         | WebFetch **timeout**; not retrievable                                |
| Availability landing                                          | https://www.spectrum.com/availability                                                                                 | WebFetch timeout ×2; `curl -I` → **403 `server: AkamaiGHost`**       |
| Internet plans (shop entry)                                   | https://www.spectrum.com/internet                                                                                     | 200 (fetched); "Check availability" links to `/address/localization` |
| Resource article                                              | https://www.spectrum.com/resources/internet-wifi/what-internet-is-available-in-my-area                                | 200                                                                  |
| Buy-flow host (from CSP header only)                          | `*.buyflow.spectrumflow.net` appears in `frame-ancestors` of spectrum.com responses — header observation; not visited | —                                                                    |
| ZIP-only query parameter                                      | UNKNOWN                                                                                                               | —                                                                    |
| **Official fallback URL**                                     | https://www.spectrum.com/address/localization (or https://www.spectrum.com/internet)                                  | —                                                                    |

### 3.3 Markets & technologies (official text)

- HFC: "Spectrum Internet® is powered by fiber and connected to the premises by coaxial lines." Distinguishes "Fiber-Powered" (HFC) from "100% Fiber" ("dedicated fiber infrastructure all the way from the network hub to the premises"). Spectrum Mobile is MVNO (not in scope). No DSL/satellite.

### 3.4 Availability form inputs & outcomes

| Item                          | Finding                                                                                                                                                                     | Source               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Inputs                        | "ZIP Code and street address". Apt/unit field: UNKNOWN. Apartments: availability "can depend" on building wiring, landlord/HOA agreements, pre-existing contracts.          | resource page (§3.2) |
| Available                     | Tool "confirms service availability and shows the speeds available for your specific address" (resource page; plan compare).                                                | same                 |
| Unavailable                   | Residential wording UNKNOWN. A business "not serviceable" page exists: https://www.spectrum.com/business/small-business/company/not-serviceable (from search; not fetched). | search               |
| Unit-required                 | UNKNOWN                                                                                                                                                                     | —                    |
| Address-specific plans/prices | Speeds per address are shown; pricing per address UNVERIFIED.                                                                                                               | resource page        |
| Quote                         | "The most accurate way to find out what Internet providers are in your area is to check availability by address."                                                           | resource page        |

### 3.5 Broadband Facts labels

- Policy/index page: https://spectrum.com/policies/broadband-labels — WebFetch timeout (not retrievable this date). Search snippet: labels "available to download in machine readable format for Residential Internet, Business Internet, Mobile" (UNVERIFIED).
- **Static label host works**: https://labels.bcl.spectrum.com/RESI-SIA4-A-NAT-EN.html — "Spectrum FCC Broadband Label", plan "Internet Assist", "$25.00", 57/11 Mbps, national ("NAT") identifier; plain static HTML. A CSV exists in the search index: https://labels.bcl.spectrum.com/CharterCommunicationsBroadbandLabels_SBMOB.csv (mobile); residential CSV name UNKNOWN.
- Labels linked from plan cards on /internet: **not observed**.

### 3.6 Transport / partner programs

- **Spectrum Channel Partner Program**: https://partners.spectrum.com/ (timeout on fetch). Search snippet: sells to "small, medium, and enterprise-level businesses and multi family communities" with "serviceability tools" — business/MDU oriented (UNVERIFIED).
- Business VAR: https://www.spectrum.com/business/wholesale (from search).
- Residential "Authorized Retailer" program is referenced only on third-party sites (UNVERIFIED, not official).
- **No consumer serviceability API documented. Public docs show only the consumer browser flow.**

### 3.7 Cookies, CAPTCHA, WAF (observed)

- `curl -I` to `/`, `/availability`, `/policies/terms-of-use` → **403, `server: AkamaiGHost`**, with `akavpau_Global` (Akamai Visitor Prioritization) and `akaas_AB-Testing` cookies, `x-response-user-type: prospect`, and `x-akamai-content-targeting` geo header.
- WebFetch: **8 of 11** spectrum.com fetches timed out (robots.txt ×2, /availability ×2, /policies/terms-of-use ×2, /policies/your-privacy-rights ×2, /policies/privacy-policy, /policies/broadband-labels, /policies/spectrum-broadband-disclosure, /address/localization, /policies/terms-of-service); `/internet` and `/resources/...` succeeded. Behaviour is inconsistent and consistent with edge bot-scoring.
- CAPTCHA: not observed. Rate limits: UNKNOWN.

### 3.8 Fixture feasibility

- **Label pages** (labels.bcl.spectrum.com) are static HTML — trivially fixtureable.
- Availability result page: markup never observed; the CSP suggests a separate buy-flow web app. **Feasibility: unknown/low** for availability results, high for labels.

### 3.9 Terms, privacy, robots

| Document                           | URL                                                                                                      | Status                                                                                                                                           | Quotes                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website Terms of Use               | https://www.spectrum.com/policies/terms-of-use                                                           | **UNVERIFIED — never retrieved** (WebFetch timeout ×2; curl 403 AkamaiGHost). Also https://www.spectrum.com/policies/terms-of-service (timeout). | None obtainable from the residential site. Sibling Charter property (Spectrum News) terms say: "By accessing this website in any manner (whether automated or otherwise), you agree to be bound by these Terms of Use" (https://spectrumnews1.com/ca/la/about/terms-of-use — **not the residential site**; indicative only). |
| Residential General T&C of Service | https://www.spectrum.com/policies/residential-general-terms-and-conditions-of-service                    | not fetched (timeouts)                                                                                                                           | —                                                                                                                                                                                                                                                                                                                            |
| Privacy Policy                     | https://www.spectrum.com/policies/your-privacy-rights ; https://www.spectrum.com/policies/privacy-policy | timeout ×3                                                                                                                                       | UNKNOWN                                                                                                                                                                                                                                                                                                                      |
| robots.txt (main/shop host)        | https://www.spectrum.com/robots.txt                                                                      | **timeout ×2 — UNKNOWN**                                                                                                                         | —                                                                                                                                                                                                                                                                                                                            |
| robots.txt (account host)          | https://www.spectrum.net/robots.txt (reviewed 2026-09-02)                                                | 200                                                                                                                                              | `Disallow: /services/internet`, `/services/tv`, `/services/voice`, `/outage-map`, `/contact-us/*`, `/*notprovisioned`; comment "Services aren't allowed for unauth users".                                                                                                                                                   |

### 3.10 Verdict: **link_only**

Rationale: the governing website terms could not be retrieved at all (material terms unclear → bias to link_only), the site actively blocks non-browser clients (AkamaiGHost 403 + visitor prioritization), and the brand/legal entity is mid-transition after the Cox close. Labels are separately hosted as static HTML and can be consumed as public disclosures. **Legal review questions:** (a) obtain and review the actual spectrum.com Terms of Use in a browser; (b) confirm which entity (Charter Communications Operating, LLC vs. renamed Cox Communications) will own spectrum.com terms after the rename; (c) whether the Channel Partner Program has a residential/affiliate tier with a serviceability tool.

---

## 4. Verizon Fios & Verizon Home Internet (5G Home / LTE Home)

### 4.1 Identity

| Item                       | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Source                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Legal entity for web terms | **Verizon Communications, Inc.** (Website Terms of Use)                                                                                                                                                                                                                                                                                                                                                                                                         | https://www.verizon.com/about/terms-conditions/terms-of-use             |
| Brand aliases              | Fios (fiber), Verizon Home Internet, 5G Home Internet, LTE Home Internet, Verizon Wireless, Visible/Total Wireless (mobile; out of scope)                                                                                                                                                                                                                                                                                                                       | https://www.verizon.com/home/internet/faq/                              |
| 2025–2026 corporate change | **Frontier acquisition closed Jan 20, 2026**; operates as "Frontier, a Verizon Company"; "By seamlessly integrating Frontier's lightning fast network with the award-winning Fios we instantly expand our reach" to "approximately 30 million fiber passings". Frontier fiber remains a separate brand for now (UNVERIFIED timing of any Fios re-brand). Not covered in this batch; note that Frontier addresses may qualify via frontier.com, not verizon.com. | https://www.verizon.com/about/news/introducing-frontier-verizon-company |
| LTE Home                   | FAQ: new LTE Home sign-ups are no longer available; existing customers only.                                                                                                                                                                                                                                                                                                                                                                                    | https://www.verizon.com/support/5g-home-faqs/                           |

### 4.2 Service & qualification URLs

| Purpose                                           | URL                                                                                   | Status 2026-09-02                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Availability landing (official)**               | https://www.verizon.com/home/internet/fios-fastest-internet/availability/             | 200                                                                           |
| Address search app (used by Broadband Facts page) | https://www.verizon.com/sales/home/addressSearch.html                                 | 200 but body yields only the token "revieworder" → **client-rendered JS app** |
| 5G Home landing                                   | https://www.verizon.com/5g/home/ ; https://www.verizon.com/5g/learn-5g-home-internet/ | 200                                                                           |
| Legacy availability URL (robots-disallowed)       | `/ForYourHome/ORDERING/CheckAvailability.aspx`                                        | in robots.txt Disallow                                                        |
| Old URL                                           | https://www.verizon.com/home/fios/availability/                                       | 404 ; fios.verizon.com → 301 to https://www.verizon.com/home/                 |
| ZIP-only query parameter                          | UNKNOWN                                                                               | —                                                                             |
| **Official fallback URL**                         | https://www.verizon.com/home/internet/fios-fastest-internet/availability/             | —                                                                             |

### 4.3 Markets & technologies (official text)

- **Fios (FTTH)**: DE, MD, MA, NJ, NY, PA, RI, VA, DC; "over 15 million homes and businesses across our network".
- **5G Home (fixed wireless)**: "Currently available in more than 14,000 cities nationwide as of 2025"; "Not all areas that have 5G Ultra Wideband cellular service currently have access to Verizon 5G Home Internet."
- **LTE Home**: existing customers only.

### 4.4 Availability form inputs & outcomes (official text)

| Item                          | Finding                                                                                                                                                                                                                                   | Source                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Inputs                        | "Enter Your Street Address" ; "See if your address is qualified for 5G Home Internet Service."                                                                                                                                            | https://www.verizon.com/5g/learn-5g-home-internet/ |
| Unit-required (MDU)           | "We noticed you live in an apartment or condo so we'll need a few more details" (floor/unit).                                                                                                                                             | same                                               |
| Unavailable                   | "Verizon Home Internet services are not currently available at this address. Enter your contact information below to be the first to know when it becomes available."                                                                     | same                                               |
| Ambiguous / fallback          | "Although Fios Home Internet and 5G Home Internet are not available for your address, Verizon LTE Home Internet is." ; FAQ: "some addresses on the same block may have coverage while others may not".                                    | same ; 5G Home FAQ                                 |
| Notify-me                     | "If the service you want isn't offered yet at your location, you can enter your address to sign up for updates."                                                                                                                          | https://www.verizon.com/home/internet/faq/         |
| Address-specific plans/prices | FAQ: pricing depends on "which services are offered at your address and which plan best fits your needs"; explicit per-address pricing in-flow UNVERIFIED. Third-party summaries say Fios results include plans and pricing (UNVERIFIED). | FAQ                                                |
| Address-not-found             | UNKNOWN                                                                                                                                                                                                                                   | —                                                  |

### 4.5 Broadband Facts labels

- Landing: https://www.verizon.com/about/broadband-facts — describes labels for "post-paid mobile, prepaid mobile and home and business broadband services"; **no index, no machine-readable files**; the only label link is address-gated via `/sales/home/addressSearch.html` (Florida 55+ label). Note: "Broadband Facts Labels don't include any discounts, offers and perks that may be available to you."
- https://www.verizon.com/broadband-facts/ → generic nav shell (no labels).
- https://www.verizon.com/support/important-plan-information/ links generally to the labels page; **no per-plan label links**.

### 4.6 Transport / partner programs

- Consumer affiliate program: reported to run on **CJ Affiliate** (Fios: ~45-day cookie) — **only third-party affiliate directories found; no verizon.com program page located → UNVERIFIED.**
- Business partner programs: https://www.verizon.com/business/resources/partner-network/verizon-partners/ ; 5G Edge partner portal — enterprise-oriented, not consumer serviceability.
- **No consumer serviceability API documented. Public docs show only the consumer browser flow.**

### 4.7 Cookies, CAPTCHA, WAF (observed)

- `HEAD https://www.verizon.com/` and the availability page → 200 with `akamai-grn` header and `_abck` / `bm_sz` cookies (**Akamai Bot Manager**). The address-search page is a JS app (no server-rendered form). robots.txt lists 26 sitemaps including "LLM content feeds" (per fetch summary) — i.e., Verizon curates what crawlers/LLMs may index.
- CAPTCHA: not observed. Rate limits: UNKNOWN. WebFetch succeeded on all verizon.com pages tried.

### 4.8 Fixture feasibility

- Landing pages are server-rendered and fixtureable; the qualification app (`/sales/home/addressSearch.html`) is a client-rendered SPA whose result markup was not observed. **Feasibility: medium for landing/FAQ text, low for result states.**

### 4.9 Terms, privacy, robots

| Document             | URL                                                                                        | Date                                               | Quotes (≤25 words)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website Terms of Use | https://www.verizon.com/about/terms-conditions/terms-of-use                                | Last updated Nov 21, 2025                          | "You specifically agree not to access (or attempt to access) any of the Resources through any automated script or routine, including 'robots,' 'spiders,'…" ; "use any data mining robots ('bots') … or other data gathering and extraction tools, scripts, applications, or methods on this site" ; "The Sites are intended solely for your private and personal use on your computer. Any other use … for commercial or other purposes is strictly prohibited." ; "reproduces, duplicates, redisplays, frames, makes copies of, or resells the Resources for any purpose" |
| Full Privacy Policy  | https://www.verizon.com/about/privacy/full-privacy-policy                                  | Effective date not shown in fetched text (UNKNOWN) | Collects "your name, address, email, phone numbers where you can be reached"; uses "cookies, pixels, web beacons, tags, scripts, or similar technologies".                                                                                                                                                                                                                                                                                                                                                                                                                  |
| robots.txt           | https://www.verizon.com/robots.txt (file timestamp "January 30 2026"; reviewed 2026-09-02) | —                                                  | `Disallow: /home/ordering/`, `/home/products/`, `/sales/digital/`, `/checkout/`, `/digital/nsa/secure/`, `/ForYourHome/ORDERING/CheckAvailability.aspx`; `User-agent: dotbot → Disallow: /`; `Allow: *.js`, `*.css`. `/home/internet/.../availability/` and `/sales/home/addressSearch.html` **not observed** in Disallow lines.                                                                                                                                                                                                                                            |

### 4.10 Verdict: **link_only**

Rationale: Terms of Use flatly prohibit automated access and any commercial use of the site; qualification runs in a client-rendered SPA behind Akamai Bot Manager; no official consumer API or documented affiliate integration beyond tracking links. Verizon publishes the richest public descriptions of outcome states (available / MDU details / not available / LTE fallback / notify-me), which is useful for UX copy but does not license automation. **Legal review questions:** (a) whether a CJ affiliate agreement (if it exists officially) permits pre-filled deep links; (b) treatment of Frontier-served addresses post-acquisition.

---

## 5. Summary matrix

| Provider                                                                                                                     | Transport (public docs)                                                                               | CAPTCHA / WAF observed                                                                                                               | Terms stance on automation                                                                                                                           | Fixtureable?                                                      | Verdict       |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------- |
| **Xfinity (Comcast Cable Communications, LLC)**                                                                              | Browser-only consumer flow; CJ affiliate program (links/assets only, no API)                          | Akamai (x-ak-cn, Bot Manager `_abck`/`bm_sz`); **403** on homepage & shop pages to non-browser clients; no CAPTCHA seen              | **Prohibits**: automated access "except through APIs…specifically provided"; personal/residential/non-commercial only; no framing/inline linking     | Low (client-rendered; shop pages blocked)                         | **link_only** |
| **AT&T (AT&T Inc.)**                                                                                                         | Browser-only consumer flow; Authorized Dealer contact form; business partner programs (not consumer)  | Akamai Bot Manager cookies on 200 responses; about.att.com legal/privacy pages 403; no CAPTCHA seen                                  | **Prohibits**: robots/spiders (§14.13), data mining (§14.22), commercial exploitation (§14.20), framing (§14.24); personal non-commercial (§6)       | Medium-low (SSR shell, dynamic results)                           | **link_only** |
| **Spectrum (Charter Communications, Inc. / Charter Communications Operating, LLC; parent to be renamed Cox Communications)** | Browser-only consumer flow; business/MDU Channel Partner Program; no residential API                  | **AkamaiGHost 403** + visitor-prioritization cookies on `/`, `/availability`, `/policies/*`; 8/11 fetches timed out; no CAPTCHA seen | **UNVERIFIED** — website Terms of Use never retrievable                                                                                              | High for static label pages; unknown/low for availability results | **link_only** |
| **Verizon (Verizon Communications, Inc.)**                                                                                   | Browser-only consumer flow; CJ affiliate (UNVERIFIED official page); enterprise partner programs only | Akamai Bot Manager cookies + `akamai-grn`; pages retrievable; qualification is a JS SPA; no CAPTCHA seen                             | **Prohibits**: any automated script/robot/spider; data-mining bots; "solely for your private and personal use"; commercial use "strictly prohibited" | Medium for landing/FAQ, low for result states                     | **link_only** |

### Cross-cutting items for qualified legal review

1. Every retrieved ToS (Xfinity, AT&T, Verizon) prohibits automated access and non-personal/commercial use; Spectrum's could not be read. A product that submits addresses to these flows on a user's behalf would need written permission or a partner agreement; technical feasibility is not authorization.
2. Whether deep-linking users to the official availability page (possibly with a ZIP-only parameter, if one exists — none confirmed) implicates the anti-framing / inline-linking clauses (Xfinity Visitor Agreement; AT&T §14.24; Verizon "frames").
3. Broadband Facts labels: AT&T publishes a machine-readable download page; Spectrum hosts static HTML/CSV labels on a separate host; Xfinity and Verizon gate labels behind an address entry. Republishing label data is a separate legal question (FCC-mandated disclosures vs. site ToS).
4. Entity churn: Charter→"Cox Communications" rename (≤1 yr from Aug 2026), Verizon/Frontier integration, AT&T/Lumen(Quantum Fiber) — re-verify entity names and terms URLs before any agreement is drafted.

---

## 6. Sources (all fetched 2026-09-02 unless noted; status in brackets)

**Xfinity / Comcast**

- https://www.xfinity.com/robots.txt [200]
- https://www.comcast.com/robots.txt [200]
- https://www.xfinity.com/ [403]
- https://www.xfinity.com/learn/internet-service [403 ×2]
- https://www.xfinity.com/learn/offers [403]
- https://www.xfinity.com/locations [404]
- https://www.xfinity.com/learn/moving [200]
- https://www.xfinity.com/support/articles/determining-serviceability [200, empty body]
- https://www.xfinity.com/broadband-labels [200]
- https://www.xfinity.com/terms/web [200]
- https://www.xfinity.com/corporate/legal/visitoragreement [200]
- https://www.xfinity.com/corporate/customers/policies/webservicesterms [404]
- https://www.xfinity.com/privacy/policy [403]
- https://assets.xfinity.com/assets/dotcom/privacy-center/PP_04232026.pdf [200, PDF]
- https://www.xfinity.com/hub/affiliate-program/working-with-xfinity [200]
- https://forums.xfinity.com/conversations/customer-service/moving-to-new-address-but-cant-select-unit-number/60e35ba10861702d9ce0a4cb [200]
- https://forums.xfinity.com/conversations/customer-service/unfortunately-xfinity-service-is-not-available-at-this-address-i-live-in-a-major-city-and-i-get-this-reply-when-im-trying-to-get-service/615e8bf9dc872674e0fc6155 [200]
- https://www.sec.gov/Archives/edgar/data/1166691/000095010326000079/dp239108_ex9901.htm [200] (Versant completion, 2026-01-05)
- https://www.sec.gov/Archives/edgar/data/1166691/000095010325015694/dp238252_ex9901.htm [200] (Versant board approval, 2025-12-03)
- https://www.cmcsa.com/news-releases/... and https://www.cmcsa.com/VERSANT-Spin-Transaction [403]
- https://corporate.comcast.com/press/releases/comcast-now-nations-largest-provider-of-gigabit-internet [search snippet; 2019]

**AT&T**

- https://www.att.com/robots.txt [200]
- https://www.att.com/internet/availability/ [200]
- https://www.att.com/internet/access/internet-air-available/ [200]
- https://www.att.com/cfd/internet/form/ [200]
- https://www.att.com/support/article/u-verse-high-speed-internet/KM1009644/ [200]
- https://www.att.com/support/article/my-account/000100570/ [200]
- https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/ [200]
- https://www.att.com/dapbbfacts [200]
- https://www.att.com/broadbandlabels/ [404]
- https://www.att.com/legal/terms.attWebsiteTermsOfUse.html [200]
- https://www.att.com/legal/terms.websiteTermsOfUse.html [200, "document does not exist"]
- https://www.att.com/legal/terms.HSIAAttTermsofService.html [200]
- https://about.att.com/privacy/ [403] ; https://about.att.com/privacy/privacy-notice.html [403]
- https://www.att.com/newdealer/contactus/ [200]
- https://www.business.att.com/industries/partner-solutions.html [search only]
- https://www.prnewswire.com/news-releases/americas-best-and-largest-network-just-got-larger-att-completes-acquisition-of-lumens-mass-markets-fiber-business-302676205.html [200]
- https://about.att.com/story/2026/att-lumen-deal-close.html [timeout]

**Spectrum / Charter**

- https://www.spectrum.com/robots.txt [timeout ×2]
- https://www.spectrum.net/robots.txt [200]
- https://www.spectrum.com/availability [timeout ×2; curl 403 AkamaiGHost]
- https://www.spectrum.com/address/localization [timeout]
- https://www.spectrum.com/internet [200]
- https://www.spectrum.com/resources/internet-wifi/what-internet-is-available-in-my-area [200]
- https://www.spectrum.com/policies/terms-of-use [timeout ×2; curl 403]
- https://www.spectrum.com/policies/terms-of-service [timeout]
- https://www.spectrum.com/policies/your-privacy-rights [timeout ×2] ; https://www.spectrum.com/policies/privacy-policy [timeout]
- https://www.spectrum.com/policies/broadband-labels [timeout] ; https://www.spectrum.com/policies/spectrum-broadband-disclosure [timeout]
- https://labels.bcl.spectrum.com/RESI-SIA4-A-NAT-EN.html [200]
- https://www.spectrum.net/policies/terms-of-use [200, cookie-wall shell only]
- https://partners.spectrum.com/ [timeout]
- https://corporate.charter.com/newsroom/charter-and-cox-communications-complete-transaction [200, content truncated by tool]
- https://corporate.charter.com/about-charter [200, content truncated by tool]
- https://www.kwch.com/2026/08/20/major-merger-involving-cox-communications-finalized/ [200]
- https://www.sec.gov/Archives/edgar/data/0001091667/000114036126033909/ef20080687_8k.htm [search snippet; closing 8-K, Aug 2026]
- https://www.sec.gov/Archives/edgar/data/1091667/000109166725000145/a073125chtr8-kexh991.htm [200; 2025-07-31]
- https://lasvegassun.com/... [402] ; https://www.fierce-network.com/... [403] ; variety.com / deadline.com [307 → tollbit gate; not followed]

**Verizon**

- https://www.verizon.com/robots.txt [200]
- https://fios.verizon.com/robots.txt [301 → https://www.verizon.com/home/]
- https://www.verizon.com/home/internet/fios-fastest-internet/availability/ [200]
- https://www.verizon.com/home/fios/availability/ [404]
- https://www.verizon.com/sales/home/addressSearch.html [200, JS shell]
- https://www.verizon.com/5g/home/ [200] ; https://www.verizon.com/5g/learn-5g-home-internet/ [200]
- https://www.verizon.com/support/5g-home-faqs/ [200] ; https://www.verizon.com/home/internet/faq/ [200]
- https://www.verizon.com/about/broadband-facts [200] ; https://www.verizon.com/broadband-facts/ [200, nav shell] ; https://www.verizon.com/support/important-plan-information/ [200]
- https://www.verizon.com/about/terms-conditions/terms-of-use [200]
- https://www.verizon.com/about/privacy/full-privacy-policy [200]
- https://www.verizon.com/about/news/introducing-frontier-verizon-company [200]
- Affiliate directories (non-official, UNVERIFIED): flexoffers.com, postaffiliatepro.com, uppromote.com

**Header observations (curl -I, 2026-09-02):** www.xfinity.com (403, `x-ak-cn`), www.att.com (200, `_abck`/`bm_sz`), www.spectrum.com (403, `server: AkamaiGHost`, `akavpau_Global`), www.verizon.com (200, `akamai-grn`, `_abck`/`bm_sz`). Cookie values were redacted and not retained.

---

# Part B — Ziply Fiber, Frontier, Cox, Google Fiber

Providers: Ziply Fiber, Frontier (Frontier, a Verizon Company), Cox Communications (now Charter/Spectrum), Google Fiber / GFiber (incl. GFiber Webpass).

Research date (all fetches): **2026-09-02**. Method: WebFetch/WebSearch of official pages plus read-only `curl` GET requests of public pages/robots.txt to observe HTTP headers and static markup. **No address was submitted to any form, no XHR/JSON endpoint was called or discovered, no CAPTCHA/WAF was bypassed, no login was performed.** Where a page blocked or did not render for a non-browser client, that observation is recorded as evidence.

Legend: `UNKNOWN` = not determinable from official public pages read; `UNVERIFIED` = reported by a source but not confirmed on an official page.

---

## 1. Ziply Fiber

### Identity

- Legal entity: **Northwest Fiber Holdco, LLC (d/b/a Ziply Fiber)**; wholly owned by **BCE Inc. (Bell Canada)** since **2025-08-01** (C$5.0B / US$3.65B cash plus ~C$2.6B net debt). Operates as a separate business unit headquartered in Kirkland, WA. Source: ziplyfiber.com press release, fetched 2026-09-02 — https://ziplyfiber.com/news/press-release/ziply-bce ; BCE release https://www.bce.ca/BCE-completes-acquisition-of-Ziply-Fiber-accelerating-its-fibre-growth-strategy
- Origin: formed 2020 from Frontier's Northwest operations (WA/OR/ID/MT). Legacy "FiOS TV Terms of Service (Oregon, Washington)" still hosted at /terms-of-service (last updated 2015-01-14).
- Aliases: "Ziply", "Ziply Fiber"; enterprise site enterprise.ziplyfiber.com; get.ziplyfiber.com (net neutrality page). No rebrand observed post-BCE.

### Official service / qualification URLs

- Homepage with inline address checker: https://ziplyfiber.com/ (form present in static HTML; see fields below). Button "CHECK ADDRESS"; Residential / Small Business toggle. Copy: "if fiber internet is available or coming soon to your address".
- Order/shop flow: **https://ziplyfiber.com/sales/** (`/sales` 301 → `/sales/`). This page is an Angular single-page app (bundles `runtime.*.js`, `polyfills.*.js`, `main.*.js`); static HTML text content is only "Ziply Fiber". Deep-link query parameters (ZIP-only or otherwise): **UNKNOWN** (none documented).
- Expansion / notify-me: https://ziplyfiber.com/new-fiber-locations (state sub-pages /Washington, /Oregon, /Idaho, /Montana; coverage map /new-fiber-locations/fiber-internet-coverage-map). Quote: "Sign up for notifications about fiber internet construction in your area and be the first to know when it's ready." Notify form collects name, address, email, phone.

### Markets & technologies (official)

- States: **Washington, Oregon, Idaho, Montana** (homepage + new-fiber-locations, 2026-09-02).
- Technologies: **Fiber** (tiers listed on homepage: 100/100, 300/300, Gig, 2 Gig, 5 Gig, 10 Gig, 50 Gig) and legacy **DSL** ("Internet Disclosures (DSL)" at /corporate/internet-disclosures). No cable or fixed wireless.

### Availability form inputs (from static markup of https://ziplyfiber.com/, 2026-09-02)

- `txtAddress` placeholder "Your address", attribute `autocomplete="smartystreets"` (indicates SmartyStreets address autocomplete).
- `txtUnit` placeholder **"Unit #"** — unit/apt field present.
- `zip` placeholder "Zip Code", `maxlength="5"`.
- No CAPTCHA/reCAPTCHA/Turnstile markers found in homepage markup.

### Documented outcomes

- "coming soon" outcome is documented on the homepage and new-fiber-locations page. Text for "couldn't find your address", "select your unit", or explicit "not available" outcomes: **UNKNOWN** (help center at https://ziplyfiber.com/helpcenter has no availability article; it only links back to /sales).
- Address-specific plans/prices returned in the flow: **UNKNOWN** from public docs (the /sales/ SPA is not statically readable). The homepage lists plan tiers generically.

### Broadband Facts labels

- Index page: **https://ziplyfiber.com/nutrition-labels** (linked from /corporate/policies as "Nutrition Labels"). Labels are client-loaded — static HTML shows only "Loading Nutrition Labels....". Whether labels are linked from plan cards in the order flow: **UNKNOWN**.

### Transport / partner programs

- No public developer, affiliate, or availability API found. Programs that exist: customer referral (https://ziplyfiber.com/referrals, $100 credit, valid through 2026-09-01 per help article), commercial agent program (https://enterprise.ziplyfiber.com/commercial-agents), wholesale (https://ziplyfiber.com/wholesale), Neighborly Partnerships (community build cost-share). None offers residential serviceability lookup.
- Public docs therefore show **consumer web flow only (browser-only)**.

### Cookies / session / CAPTCHA / WAF (observed headers, 2026-09-02)

- `server: cloudflare`, `cf-ray`, `cf-cache-status: DYNAMIC`; cookies `__cf_bm`, `__cflb` (Cloudflare bot management / load balancer). Sitecore CMS cookies `sxa_site`, `shell#lang`. Cloudflare Rocket Loader script on /sales/.
- All fetches returned HTTP 200 (no block encountered). CAPTCHA: none observed on homepage; /sales/ SPA behaviour UNKNOWN. Rate limits / timeouts: not documented.

### Fixture / parser-test feasibility

- Homepage form: static HTML → sanitized fixture easily committed.
- Result page: Angular SPA; a fixture would have to be a sanitized _rendered-DOM_ snapshot taken in a browser session by a human tester. JSON fixtures are out of scope under project rules. **Feasible but browser-dependent; medium effort.**

### Official fallback URL

- https://ziplyfiber.com/ (homepage checker) or https://ziplyfiber.com/sales/

### Terms / privacy / robots (reviewed 2026-09-02)

- Terms index: https://ziplyfiber.com/corporate/terms (no date shown; links Residential Subscriber Agreement, Ziply Fiber Services Agreement PDF v2025-05-20, etc.).
- **Website terms**: https://ziplyfiber.com/corporate/terms-conditions/website-visitors ("Terms and Conditions for Website Visitors"; no effective date). Quotes:
  - "You may use, copy and distribute the materials...for personal, noncommercial, informational purposes only."
  - "No material from this website...may be copied, reproduced, republished, uploaded, posted, transmitted, or distributed in any way."
  - "The use of any such material on any other website or networked computer environment is prohibited."
  - No explicit bot/scraper/crawler/automated-access clause found. Governing law not stated.
- Privacy: https://ziplyfiber.com/corporate/privacy-policy (no date shown; PDF copy at /-/media/Residential/corporate/policies/privacy-policy.pdf). Quote: "Ziply Fiber, or third-party analytic companies acting on Ziply Fiber's behalf, also may use cookies, web beacons, and other tracking mechanisms". "we currently do not respond to those [Do Not Track] signals."
- robots.txt https://ziplyfiber.com/robots.txt: `User-agent: *` disallows only `/~/media/residential/ziply-fiber/wholesale/` and `/-/media/residential/ziply-fiber/wholesale/`; sitemap declared. **/sales/ and homepage are NOT disallowed.**

### Verdict: **link_only** (candidate for approve_with_limits after legal review)

Rationale: no explicit anti-automation clause and robots.txt permits the paths, but the Website Visitor terms restrict use to "personal, noncommercial" purposes and prohibit use of materials "on any other website or networked computer environment" — displaying Ziply results inside ISP Search is arguably exactly that. Cloudflare bot management is in front of the site. Questions for qualified legal review: (1) does relaying a user-initiated availability check constitute "commercial use" / use "on any other website"; (2) does Cloudflare `__cf_bm` bot management signal an access-control measure under CFAA-style analysis; (3) whether BCE's policies now apply.

---

## 2. Frontier (Frontier Fiber / Frontier Internet) — "Frontier, a Verizon Company"

### Identity

- **Verizon Communications Inc. completed its acquisition of Frontier Communications Parent, Inc. on 2026-01-20** (all-cash, $38.50/share, ~$20B EV; merger agreement dated 2024-09-04). Sources: Verizon news "Introducing Frontier, a Verizon Company" https://www.verizon.com/about/news/feed/introducing-frontier-verizon-company (fetched 2026-09-02; quote: "By seamlessly integrating Frontier's lightning fast network with the award-winning Fios we instantly expand our reach to approximately 30 million fiber passings."); Verizon 8-K (SEC) via search.
- Brand status: frontier.com footer reads "© 2026 Verizon"; privacy page header "a Verizon Company"; privacy contact FTR-privacy@verizon.com. Official Frontier blog (2026-03-17) https://go.frontier.com/blog/frontier-verizon-2026-merger: "Frontier Fiber plans will stay the same"; bills and online accounts remain separate for now; plans will "eventually standardize across the entire Verizon territory".
- Product brands: **Frontier Fiber**, **Frontier Internet / High-Speed Internet** (DSL/copper), Frontier Fixed Wireless. Partner sites: agents.frontier.com (business agents), wholesale.frontier.com, go.frontier.com (Frontier marketing subdomain with 855- numbers).

### Official service / qualification URLs

- Address check page: **https://frontier.com/local** ("Frontier Address Check"; server-rendered; HTTP 200 to WebFetch and curl). State/city pages under /local/<state>/<city> ("Find out which internet options are available for your new home with our availability checker").
- Availability/order flow: **https://frontier.com/buy** ("Frontier Availability Check"). **Returned HTTP 403** to both WebFetch and a plain curl GET on 2026-09-02 (Akamai; see WAF). This is the URL the /local form's "Check Availability" CTA targets.
- Marketing availability page: https://go.frontier.com/availability (official subdomain).
- Deep-link query parameters (ZIP-only): **UNKNOWN** — none documented.

### Markets & technologies (official)

- States listed on https://frontier.com/local (2026-09-02): Alabama, Arizona, California, Connecticut, Florida, Georgia, Illinois, Indiana, Iowa, Michigan, Minnesota, Mississippi, Nebraska, Nevada, New Mexico, New York, North Carolina, North Dakota, Ohio, Pennsylvania, South Carolina, South Dakota, Tennessee, Texas, Utah, Virginia, West Virginia, Wisconsin (28 as listed on the page).
- Technologies per https://frontier.com/corporate/internet-disclosures/residential-internet (revised 06/2022): **Fiber** (500 Mbps–7 Gig), **DSL/copper** (1–115 Mbps), **Fixed wireless** (12–45 Mbps; "line-of-sight obstructions and adverse weather conditions"). Quote: "Not all service tiers are available in all areas and may not be available at your location." A "Satellite Fair Access Policy" PDF is listed on /corporate/policies (satellite resale: UNVERIFIED).

### Availability form inputs (static markup of https://frontier.com/local, 2026-09-02)

- `<form name="service-check-form" autocomplete="off">` with a single visible input `name="street-address"`, placeholder **"Enter your address"**, plus a hidden **honeypot** input (`fieldType: honeypot`) — an explicit anti-bot measure.
- No separate unit/apt or ZIP field on /local; validation string "Invalid Address". Unit handling inside /buy: **UNKNOWN** (403).
- No reCAPTCHA markers on /local; Akamai Bot Manager cookies set site-wide.

### Documented outcomes

- Help center (https://frontier.com/helpcenter) has no article describing "address not found", "select your unit", "not available yet / waitlist". **UNKNOWN.**
- Address-specific plans/prices in the flow: **UNKNOWN**. Website terms warn: "The prices, terms and conditions on this website are illustrative only... may not apply in every geographical area."

### Broadband Facts labels

- Index page: **https://frontier.com/consumerlabels** ("Broadband Consumer Labels"), linked from https://frontier.com/corporate/policies. The page is **client-rendered** (45 KB HTML, 22 scripts, no visible text/forms in static HTML), so the selection mechanism (plan/state/address) is UNKNOWN. Plan-card linking: UNKNOWN.

### Transport / partner programs

- **Business only**: Frontier Partner Program / Partner Portal https://agents.frontier.com/partner-portal (C2F/Salesforce; "self-service address validation, quoting and contract creation"; no API mentioned; "View lit buildings, nearby fiber locations and fiber proximity"). Wholesale resellers https://wholesale.frontier.com/segments/resellers.html.
- No residential affiliate/availability API found on official pages → **consumer web flow only (browser-only)**.

### Cookies / session / CAPTCHA / WAF (observed 2026-09-02)

- **Akamai** (`akamai-grn` header) with **Akamai Bot Manager** cookies `_abck`, `bm_sz`, `bm_s`, `bm_so`; Azure `ApplicationGatewayAffinity*` cookies; Sitecore CMS paths in robots.txt.
- **https://frontier.com/buy → HTTP 403** for non-browser clients (observed twice). Homepage and /local → 200.
- robots.txt names AI crawlers explicitly: `User-agent: OAI-SearchBot, GPTBot, OAI-AdsBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended` with the same disallow list as `*` (Sitecore/admin/wholesale/agent docs). **/buy and /local are NOT disallowed.**

### Fixture / parser-test feasibility

- /local form: static HTML → fixture trivial.
- /buy results: not observable without a real browser session that passes Akamai; a sanitized rendered-DOM fixture would have to be produced manually. **Low feasibility; brittle.**

### Official fallback URL

- https://frontier.com/local (or https://frontier.com/buy for users in a browser)

### Terms / privacy / robots (reviewed 2026-09-02)

- Terms index: https://frontier.com/corporate/terms (no date shown; links PDFs). Website terms PDF: **https://content.frontier.com/-/media/documents/corporate/terms/online-frontier-com.pdf** ("Terms and Conditions for Frontier.com"; footer code "(012026)", date otherwise not stated). Quotes:
  - "You may use, copy and distribute the materials found on this Frontier website for personal, noncommercial, informational purposes only."
  - "No material from this website or any other Frontier website may be copied, reproduced, republished, uploaded, posted, transmitted, or distributed in any way"
  - "the use of any such material on any other website or networked computer environment is prohibited."
  - No explicit bot/crawler/scraper clause. No governing-law or arbitration clause in this document.
- Privacy: https://frontier.com/corporate/privacy-policy (last updated **2024-08-08**; "a Verizon Company" header). Quote: "Frontier, or third-party analytic companies acting on Frontier's behalf, also may use cookies, web beacons, and other tracking mechanisms". California policy: /corporate/privacy-policy-california.
- robots.txt: https://frontier.com/robots.txt (see above). Sitemap https://frontier.com/sitemap.xml.

### Verdict: **link_only**

Rationale: the qualification endpoint (/buy) actively returns 403 to non-browser clients behind Akamai Bot Manager, the form carries a honeypot, and website terms restrict use to "personal, noncommercial" purposes and forbid use on "any other website or networked computer environment". Verizon integration is in flight (plans/website may change). Legal questions: same commercial-use question as Ziply; whether Verizon's website terms will supersede; whether the 403/Bot Manager constitutes a technical access restriction.

---

## 3. Cox Communications (→ Charter / Spectrum)

### Identity

- **Charter Communications, Inc. completed its acquisition of Cox Communications on 2026-08-20** (press release: https://corporate.charter.com/newsroom/charter-and-cox-communications-complete-transaction, dated 2026-08-20; headline notes Spectrum products "…in All Cox Markets Mid-September"). Cox Enterprises received ~33.6M Charter Holdings units and ~26% of Charter on an as-converted basis; ~$12B of Cox debt remains at Charter subsidiaries.
- Official FAQ https://corporate.charter.com/charter-cox-transaction (fetched 2026-09-02): "Within one year of closing, the parent Company will change its name to Cox Communications. The Spectrum brand will remain the consumer-facing name customers see on products, bills and service". Press coverage (UNVERIFIED on cox.com) states the Cox brand aligns to Spectrum on **2026-09-16**.
- Evidence of migration already live: `https://www.cox.com/aboutus/policies/online-privacy-policy.html` and `/annual-privacy-notice.html` **301 → https://www.spectrum.com/policies/privacy-policy**; `https://newsroom.cox.com/company-overview` **301 → https://corporate.charter.com/about-charter**.
- Aliases: Cox, Cox Communications, Cox Internet, Cox Business; Cox Enterprises (former parent, Atlanta); Spectrum (Charter brand).

### Official service / qualification URLs

- https://www.cox.com/ → 301 → **https://www.cox.com/residential/home.html** (homepage); **https://www.cox.com/residential/internet.html** (plans; title "Cox Internet Plans | Fiber-Powered Speeds from $30/mo"); service areas https://www.cox.com/local/residential/ → **https://www.cox.com/residential/local/services.html**; move/transfer https://www.cox.com/residential/move.html (existing customers, login).
- Every cox.com page fetched is an **Adobe AEM + React shell** (`/etc.clientlibs/cox-cms-react/...`; ~86–95 KB HTML with only the `<title>` as text). The availability form, its fields, and any shop/order URL are therefore **UNKNOWN from static reading**. robots.txt reveals shop paths `/residential-shop/customer-shop.html`, `/residential-shop/wls/order-cox-services.cox`, `/residential/special-offers/order-now.html` (all disallowed).
- Deep-link ZIP parameters: UNKNOWN.
- Cox Community forum (official forums.cox.com, thread dated 2020-11-13): moderator says "If the address isn't serviceable then you would need to email or call so a serviceability request can be submitted" (cox.help@cox.com).

### Markets & technologies

- Markets/states: **UNKNOWN from cox.com** (client-rendered). Charter states the combined Spectrum footprint covers **45 states**. Cox's own market list should be re-checked on spectrum.com after the mid-September cutover.
- Technologies (from official page titles found via search, bodies not readable): cable/**DOCSIS** and "fiber-powered" (https://www.cox.com/aboutus/policies/internet-service-disclosures.html), **Fixed Wireless Access** (https://www.cox.com/aboutus/policies/cox-fixed-wireless-access-service-disclosures.html). Details UNVERIFIED.

### Availability form inputs / outcomes / address-specific pricing

- **UNKNOWN** (no static markup or help-center text readable; the support article and move page are React shells). Not probed.

### Broadband Facts labels

- **https://www.cox.com/broadbandlabels → 301 → https://webcdn.cox.com/content/dam/cox/bbfl/prod/cox_upi_transactions.csv** (machine-readable CSV, ~1.09 MB, 31 columns, 1,746 data rows; columns include `unique_plan_id, provider_name, service_plan_name, tier_plan_name, connection_type, monthly_price, intro_rate, ..., typical_download_speed, typical_upload_speed, typical_latency, ..., load_date_time_est`). This is the FCC-style machine-readable label file and is the one Cox asset that is trivially fixtureable.
- Support article: https://www.cox.com/residential/support/understanding-the-broadband-facts-label.html (client-rendered). Plan-card linking: UNKNOWN.

### Transport / partner programs

- Business: Selling Partner, Referral Partner, Reseller programs (https://www.cox.com/business/programs/partner-programs.html), CAPS agent portal (https://caps.cox.com/). Residential: customer referral https://share.cox.com/. Digital-equity partner portal (newsroom 2024-10-07). **No residential availability API/affiliate integration documented** → browser-only; and the platform is migrating to Spectrum systems.

### Cookies / session / CAPTCHA / WAF (observed 2026-09-02)

- **Imperva/Incapsula** WAF (`x-cdn: Imperva`, `x-iinfo`, cookies `visid_incap_1334424`, `incap_ses_2100_1334424`, `nlbi_1334424`) in front of **CloudFront** (`via: ...cloudfront.net`, `x-amz-cf-*`); nginx on the apex redirect; cookies `cfuid`, `affinity`. CSP `frame-ancestors` restricts framing to cox.com/cox.net.
- All fetches returned 200 but with JS-only bodies; effectively unreadable without a browser. CAPTCHA: UNKNOWN. Spectrum privacy page returned **403** to curl and timed out via WebFetch (Spectrum-side WAF).
- robots.txt (https://www.cox.com/robots.txt): `Yeti/1.0` disallowed entirely; `*` disallows ~50 paths including **order/shop paths** `/residential-shop/customer-shop.html`, `/residential-shop/wls/order-cox-services.cox`, `/residential-shop/wls/myorders.cox`, `/residential/special-offers/order-now.html`, `/residential/search.html`, `/resaccount/`, `/cbaccount/`. Sitemaps hosted on globalsiteseo.com.

### Fixture / parser-test feasibility

- Availability/result pages: **not feasible** statically (React SPA behind Imperva; markup unknown). BBFL CSV: trivially fixtureable.

### Official fallback URL

- https://www.cox.com/residential/home.html (expect redirect to spectrum.com after brand cutover; UNVERIFIED)

### Terms / privacy / robots (reviewed 2026-09-02)

- Online Terms of Use: **https://www.cox.com/aboutus/policies/online-terms-of-use.html** — HTTP 200 but body is client-rendered; **clause text UNVERIFIED / could not be read**. Policies index https://www.cox.com/aboutus/references/policies.html returned an empty body. (Note only: the separate Cox Enterprises site's terms at https://www.coxenterprises.com/terms-of-use prohibit gathering content "by using any robot, rover, 'bot', spider, scraper, crawler" — different legal entity; not the ISP's terms.)
- Privacy: cox.com privacy URLs now redirect to **https://www.spectrum.com/policies/privacy-policy** (content not retrievable: 403/timeout). Older Cox PDF: https://www.cox.com/content/dam/cox/residential/flex/documents/legal/Cox-Online-Privacy-Policy-7-1-2020.pdf (2020; superseded).
- robots.txt: reviewed 2026-09-02; **shop/order paths disallowed** (see above).

### Verdict: **link_only** (re-evaluate as "Spectrum" after 2026-09-16)

Rationale: terms unreadable (material terms unclear), robots.txt disallows order/shop paths, Imperva WAF, fully client-rendered flow, and an active brand/platform migration to Spectrum within days. Automation is not authorizable on this evidence. Legal review questions: which terms (Cox vs. Spectrum/Charter) govern; Spectrum's website terms stance on automated access; whether cox.com will persist as a redirect.

---

## 4. Google Fiber → GFiber (incl. GFiber Webpass)

### Identity

- Google Fiber Inc. (Alphabet subsidiary). **Official rebrand to "GFiber" announced 2026-03-26** (blog: https://fiber.google.com/blog/2026/03/its-official-google-fiber-is-now.html; homepage: "It's official! Google Fiber is now GFiber–new name, same amazing internet experience").
- **Pending transaction**: on 2026-03-11 GFiber and Stonepeak "entered an agreement to combine GFiber with Astound Broadband" (official blog https://fiber.google.com/blog/2026/03/gfiber-and-stonepeaks-astound-to.html); Stonepeak majority, Alphabet minority; "expected to close in Q4 of this year" (2026). Not closed as of 2026-09-02. Brand/website implications: not stated.
- Webpass: Webpass, Inc. acquired by Google Fiber (2016 blog); now "GFiber Webpass" (point-to-point wireless for apartments/condos/businesses). Domains: fiber.google.com (many paths 301 → gfiber.com) and **gfiber.com** (primary).

### Official service / qualification URLs

- Homepage with inline address form: **https://gfiber.com/** (also https://fiber.google.com/, and https://fiber.google.com/fiber-internet-near-me/). City index is an in-page section: https://gfiber.com/#cities (/cities/ → 308 → /#cities).
- Webpass availability/sign-up: **https://gfiber.com/webpass/signup/** ("Check Availability | GFiber Webpass"); Webpass city pages e.g. https://gfiber.com/webpass/cities/seattle/; "Bring Webpass to my building": https://gfiber.com/webpass/bring-webpass-to-my-building/
- Deep-link ZIP parameters: UNKNOWN (none documented).

### Markets & technologies (official)

- States listed on gfiber.com (2026-09-02): Alabama, Arizona, California, Colorado, Florida, Georgia, Idaho, Illinois, Iowa, Kansas, Missouri, Nebraska, Nevada, North Carolina, South Carolina, Tennessee, Texas, Utah, Washington (19 names; the page copy says "20 states" — discrepancy noted). Metro-level status ("GFiber metro" vs "Coming soon") is shown on an interactive map; per-metro list UNKNOWN from static HTML.
- Webpass cities (sitemap-0.xml, 2026-09-02): Denver, San Francisco, San Diego, Chicago, Seattle, Miami, Oakland–East Bay.
- Technologies: **Fiber** (1 Gig "same price since 2012" through Edge 8 Gig; 20 Gig via GFiber Labs) and **fixed wireless (Webpass)** — "Built to serve the core needs of users in apartments, condos and smaller homes." Webpass plan shown: 1 Gig $70/mo.

### Availability form inputs (static markup of https://gfiber.com/, 2026-09-02)

- `name="street_address"` placeholder **"Enter your address"** (maxLength 46); a **"Unit #"** input rendered as an autocomplete combobox (`role="combobox" aria-autocomplete="list"` — suggests unit list selection); `name="zip_code"` placeholder **"ZIP"** (maxLength 10); hidden `token` and analytics fields.
- Google Maps/Places scripts referenced (address autocomplete) and **reCAPTCHA** references present in page markup (10+ "Captcha"/"reCAPTCHA" mentions).
- Webpass form (https://gfiber.com/webpass/signup/): `id="address-autocomplete"` placeholder "Enter your address", `id="door-ac"` (unit autocomplete), `id="zip"` (required); button "Check availability". Rails app (`server: nginx + Phusion Passenger`, cookie `.webpass_session`).

### Documented outcomes (official help center)

- https://gfiber.com/support/en/answer/1828/ "Sign Up for GFiber Internet Service": "Enter your address to see if GFiber is available."; then "choose an internet plan". Ineligibility reason: "If you rent, your property owner or manager hasn't signed an access agreement with GFiber yet".
- https://gfiber.com/support/en/answer/1974/ "Get GFiber in Your Building" (access agreements; residents invited by email after construction). https://gfiber.com/support/en/answer/1902/ (private roads / HOA).
- Older Google help (support.google.com/fiber/answer/2657216, now 301 → gfiber.com) described "sign up for email updates" when not available — current wording UNVERIFIED.
- "Couldn't find your address" / explicit "select your unit" text: UNKNOWN. Address-specific plans/prices: help article implies plan choice follows the check; pricing is uniform/national per Broadband Facts page ("The price you see on the Broadband Facts label is the price you pay").

### Broadband Facts labels

- **https://gfiber.com/broadband-labels/** (fiber.google.com path 301s here). Informational page with plan names (e.g., Edge 8 Gig) and a "Check availability" CTA; not a per-city index; no selector. Linked from the homepage footer ("Broadband Labels") and /legal/. Plan-card linking in the order flow: UNKNOWN.

### Transport / partner programs

- Property-manager programs (https://fiber.google.com/properties/multifamily/, /properties/commercial/), small-business tech partner page (/techpartner/), Webpass referral program. **No affiliate/availability API documented** → browser-only.

### Cookies / session / CAPTCHA / WAF (observed 2026-09-02)

- gfiber.com: `server: Google Frontend`, `via: 1.1 google`, HSTS preload, `frame-ancestors 'self'`; no session cookie on homepage GET. fiber.google.com: `server: sffe`, nonce-based CSP. Webpass: Rails session cookie.
- **reCAPTCHA on the availability form** (explicit anti-automation control). No 403s encountered on any GET.
- robots.txt: https://gfiber.com/robots.txt disallows `/*.rss`, `/blog/`, `/portal/`, `/request_new_activation/`, `/reset_city/` (plus full disallow for UAs `008` and `voltron`); https://fiber.google.com/robots.txt disallows only `/blog/search`. **Availability/Webpass signup paths NOT disallowed.**

### Fixture / parser-test feasibility

- Homepage and Webpass forms are server-rendered (React/MUI SSR) → static fixtures easy. Post-submit result markup: unobservable without passing reCAPTCHA; UNKNOWN. **Form fixtures yes; result fixtures no.**

### Official fallback URL

- https://gfiber.com/ (fiber) and https://gfiber.com/webpass/signup/ (Webpass)

### Terms / privacy / robots (reviewed 2026-09-02)

- Legal index: https://gfiber.com/legal/ (links Terms of Service, AUP, Privacy, Fee Schedule, Broadband Labels). **No website-specific terms of use** were found on gfiber.com; the Terms of Service documents govern subscribed services:
  - Residential ToS https://gfiber.com/legal/terms/residential/ (last modified **2026-05-05**): no bot/scraping clause; "You agree not to resell or repackage the Services".
  - Webpass ToS https://gfiber.com/webpass/policies/terms-of-service/ (effective **2025-05-22**): "alter, disable, interfere with, or circumvent any aspect of the Services, including but not limited to security features" (prohibited); commercial-server and resale restrictions.
- Google Terms of Service https://policies.google.com/terms (effective **2026-07-30**) — whether it governs gfiber.com is **UNKNOWN** (legal question). Relevant quote: "using automated means to access content from any of our services in violation of the machine-readable instructions" (prohibited); "spamming, hacking, or bypassing our systems or protective measures".
- Privacy: https://gfiber.com/legal/privacy/ ("GFiber Privacy Policy", last updated **2026-06-17**). Quote: "We and our affiliates and service providers use various technologies to collect and store information when you visit our websites".

### Verdict: **link_only**

Rationale: no textual prohibition on automated access in GFiber's own terms and robots.txt permits the paths, but the availability form is protected by **reCAPTCHA** — a protective measure that ISP Search must not bypass — and the Google ToS (if applicable) forbids "bypassing our systems or protective measures". Ownership change (Astound/Stonepeak, Q4 2026) may reset terms. Legal review questions: applicability of Google ToS to gfiber.com; whether a user-driven, in-browser (non-headless) flow could be acceptable; post-merger terms.

---

## Summary table

| Provider               | Transport (per public docs)                                                  | CAPTCHA / WAF observed                                                                     | Terms stance on automation                                                                                                                                    | Fixtureable?                                          | Verdict                                                         |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| Ziply Fiber (BCE)      | Consumer web only; no API; referral/agent/wholesale programs only            | Cloudflare bot mgmt (`__cf_bm`); no CAPTCHA seen; all 200                                  | No explicit bot clause; "personal, noncommercial" only; "any other website or networked computer environment is prohibited"                                   | Form: yes. Result: Angular SPA, browser snapshot only | **link_only** (approve_with_limits possible after legal review) |
| Frontier (Verizon)     | Consumer web only; business Partner Portal (no API)                          | **Akamai Bot Manager**; **/buy → HTTP 403**; honeypot field; robots names ClaudeBot/GPTBot | No explicit bot clause; "personal, noncommercial" only; same networked-environment prohibition                                                                | Form: yes. Result: no (403 to non-browser)            | **link_only**                                                   |
| Cox (Charter/Spectrum) | Consumer web only; business partner programs; platform migrating to Spectrum | **Imperva/Incapsula** + CloudFront; pages are JS shells; Spectrum privacy 403              | **UNVERIFIED** — Online Terms of Use body unreadable; robots disallows shop/order paths                                                                       | Result: no. BBFL CSV: yes                             | **link_only** (re-check as Spectrum after 2026-09-16)           |
| GFiber / Webpass       | Consumer web only; property-manager & referral programs; no API              | **reCAPTCHA** on form; Google Frontend; no blocks on GET                                   | GFiber ToS silent on bots; Google ToS (applicability unknown) bans automated access "in violation of machine-readable instructions" and bypassing protections | Form: yes. Result: no (behind reCAPTCHA)              | **link_only**                                                   |

Overall: none of the four providers publishes a residential availability API or affiliate integration tier; all four flows are browser-only. For each, the product should deep-link users to the official fallback URL and, where useful, surface the Broadband Facts assets (Cox CSV is machine-readable; GFiber/Ziply/Frontier label pages are client-rendered).

## Open questions requiring qualified legal review

1. Whether a user-initiated availability check relayed by ISP Search is "commercial use" or use "on any other website or networked computer environment" under Ziply's and Frontier's website terms.
2. Which terms govern cox.com/spectrum.com during and after the Charter brand cutover, and Spectrum's stance on automated access.
3. Whether Google's general Terms of Service apply to gfiber.com, and whether reCAPTCHA/Akamai/Imperva/Cloudflare bot controls constitute technical access restrictions that foreclose automation regardless of terms.
4. Post-transaction terms for Frontier (Verizon), Ziply (BCE), and GFiber (Stonepeak/Astound, expected Q4 2026).

## Sources (all fetched 2026-09-02)

Ziply Fiber

- https://ziplyfiber.com/ (homepage; form markup via curl)
- https://ziplyfiber.com/sales/ (SPA shell)
- https://ziplyfiber.com/new-fiber-locations
- https://ziplyfiber.com/helpcenter
- https://ziplyfiber.com/nutrition-labels
- https://ziplyfiber.com/corporate/terms
- https://ziplyfiber.com/corporate/terms-conditions/website-visitors
- https://ziplyfiber.com/corporate/privacy-policy
- https://ziplyfiber.com/corporate/policies
- https://ziplyfiber.com/terms-of-service (legacy FiOS TV terms)
- https://ziplyfiber.com/robots.txt
- https://ziplyfiber.com/news/press-release/ziply-bce
- https://www.bce.ca/BCE-completes-acquisition-of-Ziply-Fiber-accelerating-its-fibre-growth-strategy (via search)
- https://ziplyfiber.com/referrals ; https://enterprise.ziplyfiber.com/commercial-agents ; https://ziplyfiber.com/wholesale (via search)

Frontier

- https://frontier.com/ ; https://frontier.com/local (form markup via curl) ; https://frontier.com/buy (403)
- https://go.frontier.com/availability ; https://go.frontier.com/blog/frontier-verizon-2026-merger
- https://frontier.com/corporate/terms ; https://content.frontier.com/-/media/documents/corporate/terms/online-frontier-com.pdf
- https://frontier.com/corporate/privacy-policy ; https://frontier.com/corporate/policies
- https://frontier.com/corporate/internet-disclosures/residential-internet
- https://frontier.com/consumerlabels ; https://frontier.com/helpcenter
- https://frontier.com/robots.txt
- https://agents.frontier.com/partner-portal ; https://wholesale.frontier.com/segments/resellers.html (via search)
- https://www.verizon.com/about/news/feed/introducing-frontier-verizon-company ; https://www.verizon.com/about/news/feed/verizon-and-frontier-regulatory-approval (via search) ; https://www.verizon.com/about/news/verizon-to-acquire-frontier (via search)

Cox / Charter

- https://www.cox.com/ ; https://www.cox.com/residential/home.html ; https://www.cox.com/residential/internet.html ; https://www.cox.com/local/residential/ → /residential/local/services.html ; https://www.cox.com/residential/move.html ; https://www.cox.com/residential/support/move-or-transfer-your-cox-services.html
- https://www.cox.com/aboutus/policies/online-terms-of-use.html ; https://www.cox.com/aboutus/references/policies.html ; https://www.cox.com/aboutus/policies.html (404) ; https://www.cox.com/aboutus/policies/online-privacy-policy.html (301 → spectrum.com) ; https://www.spectrum.com/policies/privacy-policy (403/timeout)
- https://www.cox.com/aboutus/policies/internet-service-disclosures.html ; https://www.cox.com/aboutus/policies/cox-fixed-wireless-access-service-disclosures.html (via search)
- https://www.cox.com/residential/support/understanding-the-broadband-facts-label.html ; https://www.cox.com/broadbandlabels → https://webcdn.cox.com/content/dam/cox/bbfl/prod/cox_upi_transactions.csv
- https://www.cox.com/robots.txt
- https://forums.cox.com/conversations/internet/how-to-find-service-availability-at-as-specific-address-without-having-to-open-a-move-ticket/68750f3df7d738f198ad0bf7
- https://www.cox.com/business/programs/partner-programs.html ; https://caps.cox.com/ ; https://share.cox.com/ (via search)
- https://corporate.charter.com/newsroom/charter-and-cox-communications-complete-transaction ; https://corporate.charter.com/charter-cox-transaction ; https://newsroom.cox.com/company-overview (301 → corporate.charter.com/about-charter)
- https://www.coxenterprises.com/terms-of-use (Cox Enterprises, different entity; via search)

Google Fiber / GFiber

- https://fiber.google.com/ ; https://gfiber.com/ (form markup via curl) ; https://fiber.google.com/fiber-internet-near-me/ ; https://fiber.google.com/cities/ (→ /#cities)
- https://gfiber.com/webpass/signup/ (form markup via curl) ; https://gfiber.com/webpass/cities/seattle/ ; https://gfiber.com/sitemap-0.xml
- https://gfiber.com/support/en/answer/1828/ ; https://gfiber.com/support/en/answer/1974/ ; https://gfiber.com/support/en/answer/1902/ (via search) ; https://support.google.com/fiber/answer/2657216 (301)
- https://gfiber.com/broadband-labels/ ; https://gfiber.com/legal/ ; https://gfiber.com/legal/terms/residential/ ; https://gfiber.com/webpass/policies/terms-of-service/ ; https://gfiber.com/legal/privacy/
- https://policies.google.com/terms
- https://fiber.google.com/robots.txt ; https://gfiber.com/robots.txt
- https://fiber.google.com/blog/2026/03/gfiber-and-stonepeaks-astound-to.html ; https://fiber.google.com/blog/2026/03/its-official-google-fiber-is-now.html
- https://fiber.google.com/properties/multifamily/ ; https://fiber.google.com/properties/commercial/ ; https://fiber.google.com/techpartner/ (via search)

---

# Part C — Quantum Fiber / CenturyLink, Brightspeed, T-Mobile Home Internet, and the Broadband Facts label ecosystem

**Providers:** Quantum Fiber / CenturyLink (Lumen and AT&T consumer brands), Brightspeed, T-Mobile Home Internet
**Research date (all fetches):** 2026-09-02
**Method:** Public page reading only (WebFetch/WebSearch + plain `curl` GET of public URLs with a self-identifying research User-Agent). No addresses submitted, no XHR/JSON endpoints called, no CAPTCHA interaction, no logins, no proxies. Where a fetch was blocked (403/WAF/cert), the block itself is recorded as evidence.
**Labels:** `UNKNOWN` = not determinable from official public pages; `UNVERIFIED` = seen only in non-official or secondary sources, or inferred from page markup without exercising the flow.

---

## 1. Quantum Fiber (AT&T) and CenturyLink (Lumen)

### 1.1 Identity, ownership, and the 2025–2026 AT&T / Lumen split

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Evidence (URL, fetched 2026-09-02)                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lumen announced sale of its Mass Markets fiber-to-the-home business (incl. Quantum Fiber) to AT&T on **May 21, 2025**; "eleven states"; expected close 1H 2026.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | https://ir.lumen.com/news/news-details/2025/Lumen-Technologies-Advances-Enterprise-Market-Focus-with-Sale-of-Consumer-Fiber-to-the-Home-Business-to-ATT/default.aspx                                                                             |
| Sale **closed February 2, 2026**, $5.75B cash; ">1 million fiber customers" and ">4 million enabled fiber locations". Lumen "is retaining and caring for its copper-based consumer services". Lumen also retains fiber backbone, central offices, enterprise/wholesale fiber.                                                                                                                                                                                                                                                                                                                                                                                               | https://ir.lumen.com/news/news-details/2026/Lumen-Completes-Sale-of-Consumer-Fiber-to-the-Home-Business-to-ATT/default.aspx ; same text as SEC-hosted Ex. 99.1 https://www.sec.gov/Archives/edgar/data/18926/000119312526032635/d25850dex991.htm |
| The **eleven states are not enumerated** in either Lumen release fetched. AT&T's own release pages (`about.att.com/story/2025/lumen-mass-markets-fiber-business.html`, `about.att.com/story/2026/att-lumen-deal-close.html`) returned **HTTP 403 (Akamai)** to both fetchers. State list therefore **UNVERIFIED** from official sources in this pass.                                                                                                                                                                                                                                                                                                                       | about.att.com 403 observed via curl and WebFetch                                                                                                                                                                                                 |
| Quantum Fiber site now carries AT&T legal identity: footer "© 2026 AT&T Intellectual Property"; banner "Quantum Fiber is now part of the AT&T family!"; privacy links point to `about.att.com/privacy.html`; AUP is AT&T's.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | https://www.quantumfiber.com/att-offer.html ; https://www.quantumfiber.com/legal.html ; https://www.att.com/quantumfiber/                                                                                                                        |
| CenturyLink remains a Lumen tradename: "The term 'CenturyLink' is the tradename used to refer to the affiliates of Lumen Technologies, Inc." Footer "©2026 CenturyLink" with "About Lumen" link; privacy contact `Privacy@Lumen.com`.                                                                                                                                                                                                                                                                                                                                                                                                                                       | https://www.centurylink.com/aboutus/legal/website-user-agreement.html (Effective November 1, 2025) ; https://www.centurylink.com/aboutus/legal/privacy-notice.html (Updated February 10, 2026)                                                   |
| **Brand split as observable today:** Quantum Fiber = AT&T-owned FTTH (fiber + G.hn in MDUs: "All Quantum Fiber internet services are provided either by fiber or G.hn technology"). CenturyLink (Lumen) = retained copper/DSL consumer base, but centurylink.com still markets "CenturyLink Fiber Internet" ($50/mo, up to 940 Mbps) — consistent with Lumen keeping the fiber footprint outside the sold states (the "roughly 95% of Quantum Fiber" figure appears only in secondary reporting → **UNVERIFIED**). Quantum Fiber's shop page still carries legacy migration copy: "CenturyLink is transforming into Quantum Fiber! Moving your services to Quantum Fiber…". | https://www.quantumfiber.com/internet-service-disclosure.html ; https://www.centurylink.com/home/internet.html ; https://www.quantumfiber.com/shop                                                                                               |
| Practical consequence for ISP Search: a single address may need **two** checks — Quantum Fiber (AT&T) for fiber in the sold states, CenturyLink (Lumen) for copper/DSL and for fiber in retained states. Which brand "owns" a given address is not published; only the two web flows resolve it.                                                                                                                                                                                                                                                                                                                                                                            | inference from above                                                                                                                                                                                                                             |

### 1.2 Official service & qualification URLs

**Quantum Fiber**

- Check availability / shop (same page): `https://www.quantumfiber.com/shop` (also `/shop/`). Home page CTAs all point here. (fetched 2026-09-02)
- "Not yet available / notify me" landing: `https://www.quantumfiber.com/notifyme.html` — "We'll be in your neighborhood soon. Just click the 'Enter Your Address' button to check availability and reserve your spot".
- Apartments/MDU page: `https://www.quantumfiber.com/internet-for-apartments.html`.
- Query parameters for ZIP-only deep links: **UNKNOWN** (none documented on any official page; do not assume).

**CenturyLink**

- Marketing hub: `https://www.centurylink.com/home/internet.html` and `https://www.centurylink.com/fiber/fiber-in-my-area.html`.
- "Check Availability" CTA target (observed in homepage markup): `https://shop.centurylink.com/uas/` (with tracking param `?src=homepage_herocta`). Response carries `x-robots-tag: noindex`; page is a client-rendered SPA titled "New Customer Shopping" (Vite bundle `/uas/assets/index-*.js`, `assets.ctl.io` CHI design system).
- Site-wide "Set location by ZIP Code" widget on centurylink.com is a **localization** control ("Enter a valid 5-digit ZIP code"), not a serviceability check.
- `https://highspeed.centurylink.com/availability` — ZIP-only form, phone-order numbers, lists 16 states (AZ CO FL ID IA MN MT NE NV NM ND OR SD UT WA WY). The word "authorized" appears in the page; it reads like an authorized-retailer/marketing property. Official status **UNVERIFIED** — do not treat as the canonical flow.
- ZIP-only query parameters: **UNKNOWN**.

### 1.3 Markets and technologies (official pages)

- Quantum Fiber: fiber and G.hn ("technology used… will be based upon what is available in your geographic area"); tiers 200 Mbps–8 Gbps listed in the Internet Service Disclosure; "Limited availability in select areas". Sold-state list UNVERIFIED (see 1.1).
- CenturyLink: fiber (up to 940 Mbps marketed) plus copper DSL; state footprint per highspeed.centurylink.com (UNVERIFIED as official) = 16 western/central states.

### 1.4 Address & unit inputs (from page markup, not exercised)

- **Quantum Fiber `/shop`**: server-rendered Salesforce Commerce Cloud (Demandware) page. Visible labels: "Enter your address to check availability.", "My street address", "Select or enter unit". Hidden/structured fields in markup: `streetnumber`, `street`, `afstreetname`, `afstreetsuffix`, `zipcode`, `addressGoogleFormatted`, `addressId`, `addressKey`, unit select (`o2_units`, `o2UnitNumber`, `o2unitsKeyedIn`). The `addressGoogleFormatted` field suggests Google Places-style autocomplete (**UNVERIFIED**; no Maps script host was seen in static HTML). The form posts to an SFCC controller (`AddressChecker-GetServiceability`) — noted from the HTML `action` attribute only; **not called**.
- **CenturyLink `shop.centurylink.com/uas/`**: SPA; field inventory **UNKNOWN** without executing JS.

### 1.5 Outcome states described publicly

Quantum Fiber `/shop` template strings (static HTML, 2026-09-02):

- Available/pre-sale: "Fiber Internet is scheduled to be available at your address soon. To be one of the first customers to reserve your spot… select 'Purchase now'" / "Let me know".
- Ambiguous/existing service: "Our records show there may already be service at this address… click Change Address… If it is correct, call us at 833-250-6306".
- Unit prompt: "Select or enter unit" (unit-required state exists for MDUs; help page: Instant WiFi buildings are pre-wired).
- Rationale text: "We need your address to determine if we provide service to your exact location. Also, Internet speeds, pricing and services often differ from…" (address-specific plans/prices confirmed).
- Error: "Failed to Load… please review that all required fields are provided and resubmit".
- Not-available: routed to `notifyme.html` messaging ("We'll be in your neighborhood soon"). Exact copy for hard "no service" **UNKNOWN**.

CenturyLink: help center has no article describing check-availability outcomes; **UNKNOWN**.

### 1.6 Address-specific plans & prices in flow

Yes for Quantum Fiber (quoted above); Internet Service Disclosure: "Availability, features, rates, terms, and conditions may vary by location." CenturyLink: marketing says "Check internet availability at your address!" → plans shown post-qualification; specifics UNKNOWN.

### 1.7 Broadband Facts labels

- Quantum Fiber: explainer `https://www.quantumfiber.com/support/internet-essentials/basics/broadband-label.html` (labels shown "as you're ordering new service", emailed, and in account); catalog `https://broadbandlabel.quantumfiber.com/catalog` — an **Angular SPA ("BBL- Portal", `<app-root>`)**; `/robots.txt` on that host returns the SPA shell, not a robots file. Help page claims "machine-readable, CSV format" on the catalog page (CSV URL not visible in static HTML → UNVERIFIED).
- CenturyLink: explainer `https://www.centurylink.com/home/help/internet/broadband-label.html` (same wording, same "in this order" FCC field list); catalog `https://broadbandlabel.centurylink.com/catalog` (identical Angular shell).
- Linked from plan cards: UNKNOWN (shop flows are SPAs / post-qualification).

### 1.8 Transport / partner programs

- No public availability/serviceability API or developer program for either brand (searched quantumfiber.com, centurylink.com, lumen.com).
- AT&T Partner Exchange (business reseller) `https://www.business.att.com/industries/partner-solutions/att-partner-exchange.html`; AT&T "Refer a Business" `https://www.business.att.com/explore/referral.html`; Quantum Fiber "Connected Communities" (MDU property partners) `https://www.quantumfiber.com/connected-communities/connect-expert.html`. None describe an address-qualification integration for third-party comparison sites.
- Consumer affiliate listings exist on third-party networks (FlexOffers) — **not an official page; UNVERIFIED**. CenturyLink's own site mentions a "$100 Affiliate Referral Offer" and a customer referral program that excludes "partners/affiliates… third-party sellers, resellers".
- Conclusion: **consumer web flow only (browser-only)**.

### 1.9 Cookies, session, CAPTCHA, WAF (observed)

- `www.quantumfiber.com/shop`: `cf-ray`/`cf-cache-status` (**Cloudflare**), `_pxhd` cookie (**PerimeterX/HUMAN**), SFCC session cookies (`dwsid`, `dwanonymous_*`, `sid`, `cqcid`), Quantum Metric session cookies, `cache-control: no-store`. WebFetch (generic fetcher) received **403** on `/shop` while a curl GET with a research UA got 200 → bot filtering is active and UA/fingerprint-sensitive. No reCAPTCHA script in static HTML.
- `www.centurylink.com`: section.io + Varnish cache headers; no bot-manager cookies observed; WebFetch failed with "unable to verify the first certificate" (TLS chain issue for that client; curl OK).
- `shop.centurylink.com/uas/`: Varnish; `x-robots-tag: noindex`; `/robots.txt` → 404.
- Rate limits/timeouts: **UNKNOWN** (not tested).

### 1.10 Fixture / parser feasibility

- Quantum Fiber `/shop` initial page is server-rendered (54 KB) — a sanitized HTML fixture of the _form_ is committable. Result states are rendered after a POST to an SFCC controller; capturing a sanitized result fixture would require exercising the flow (out of scope) and is prohibited by the WUA (below). Label catalog is an SPA — no static fixture.
- CenturyLink `uas` is an SPA — no meaningful static fixture.

### 1.11 Official fallback URLs

- Quantum Fiber: `https://www.quantumfiber.com/shop`
- CenturyLink: `https://www.centurylink.com/home/internet.html` (→ `https://shop.centurylink.com/uas/`)

### 1.12 Terms, privacy, robots (review date 2026-09-02)

**Quantum Fiber**

- Legal index: `https://www.quantumfiber.com/legal.html`
- Website User Agreement (Effective September 1, 2024): `https://www.quantumfiber.com/website-user-agreement.html`
  - "uses any robot, spider, or other such programmatic or automatic device… to obtain information from a Quantum Fiber Website"
  - "systematically collects and uses any content including the use of any data mining, or similar data gathering and extraction methods"
  - "limited, non-sublicensable right to access the Quantum Fiber Website… for your personal, non-commercial use"
- Privacy: `https://about.att.com/privacy.html` (AT&T; **403 Akamai** to our fetchers — content not reviewed)
- AUP: `https://www.att.com/legal/terms.aup.html` — "using manual or automated means to avoid any use limitations placed on the IP Services"
- robots.txt `https://www.quantumfiber.com/robots.txt`: `User-agent: *` / `Allow: /`, **no Disallow**; sitemaps listed. Shop path not disallowed.

**CenturyLink**

- Legal index: `https://www.centurylink.com/aboutus/legal.html`
- Website User Agreement (Effective November 1, 2025): `https://www.centurylink.com/aboutus/legal/website-user-agreement.html`
  - "uses any artificial intelligence, robot, spider, or other such programmatic or automatic device… to obtain information from CenturyLink or a CenturyLink Website"
  - "systematically collects and uses any content including the use of any data mining, or similar data gathering and extraction methods"
  - "personal, non-commercial use"
- Privacy Notice (Updated February 10, 2026): `https://www.centurylink.com/aboutus/legal/privacy-notice.html`
- AUP (redirects to Lumen): `https://www.lumen.com/en-us/about/legal/acceptable-use-policy.html`
- robots.txt `https://www.centurylink.com/robots.txt` (last-modified 2026-07-17): Disallow `*/popups/*`, `*/common/*`, `/local/hidden/*`, `/business/login/*`, `/disclosures/*`, `/help/privacy/*`. Availability/shop paths not disallowed (shop is a separate host with no robots file).

### 1.13 Verdict

**Quantum Fiber: `link_only`.** Website User Agreement expressly bars robots/automatic devices and systematic collection, and limits use to personal, non-commercial; Cloudflare + PerimeterX in front of an SFCC flow; AT&T privacy page unreadable to fetchers. No approved integration tier.
**CenturyLink: `link_only`.** Same clause family (adds "artificial intelligence"); SPA shop; brand/footprint in flux after the AT&T sale.
Legal review questions: (a) whether a user-initiated, single-shot, non-cached browser session run on the user's behalf falls within "personal, non-commercial use" when operated by a commercial product; (b) whether AT&T's website terms (not yet reviewed — 403) now govern quantumfiber.com in addition to the 2024 WUA; (c) whether CenturyLink's AI clause reaches agentic browser tooling.

---

## 2. Brightspeed

### 2.1 Identity

- Legal entity on all pages: "©2026 Brightspeed Purchasing, LLC" (footer of brightspeed.com, WUA, privacy notice). Parent/holding structure (Apollo-affiliated Connect Holding) is not stated on fetched official pages → **UNVERIFIED** here.
- Footprint: `/local/` coverage map lists 20 states: Alabama, Arkansas, Georgia, Indiana, Illinois, Kansas, Louisiana, Michigan, Missouri, Mississippi, New Jersey, North Carolina, Ohio, Oklahoma, Pennsylvania, South Carolina, Tennessee, Texas, Virginia, Wisconsin. `https://www.brightspeed.com/local/` (2026-09-02)
- Marketing references "Former CenturyLink customers" / "Former Quantum Fiber customers" (legacy Lumen ILEC territories). No 2025–2026 rebrand observed.

### 2.2 Official service & qualification URLs

- Marketing: `https://www.brightspeed.com/` and `https://www.brightspeed.com/internet/`; fiber: `https://www.brightspeed.com/brightspeed-fiber-internet/`.
- **Check availability / shop:** `https://shop.brightspeed.com/uas/` (title "Brightspeed - Check Availability"). Help article deep-links `https://shop.brightspeed.com/uas/?fiberlandingimpression=true` (a tracking flag, not an address/ZIP parameter). ZIP-only parameters: **UNKNOWN**.
- SEO availability pages exist (`/availability/sitemap-index.xml` in robots.txt; `/local/<state>` pages).

### 2.3 Technologies

Fiber (2 Gig, 1 Gig, 500, 200 Mbps; labels up to 8 Gbps) and copper DSL ("Brightspeed Internet: up to 20 Mbps"; label CSV covers copper 1.5–140 Mbps). "Limited availability in select areas."

### 2.4 Address & unit inputs

`shop.brightspeed.com/uas/` is a **client-rendered SPA** (`index.bundle.js`, Dynatrace RUM, GTM; ~80 characters of static text). Field inventory (street/unit/ZIP/autocomplete) **UNKNOWN** without executing JS. Marketing page shows "Enter your address to unlock the best deals".

### 2.5 Outcome states (help center)

- "Can I get fiber internet in an apartment or condo?": availability depends on "whether fiber internet service is available in your area and whether your building is wired for fiber". `https://www.brightspeed.com/help/internet/fiber/can-i-get-fiber-internet-in-an-apartment-or-condo/`
- "How can I get fiber internet": "Enter your address on an ISP's website to verify…"; "Fiber isn't available in my area. What now?" section. `https://www.brightspeed.com/help/internet/fiber/how-to-get-fiber-internet/`
- Unified Service Disclosure: "Service may not be available in all areas or at the rates or speeds generally marketed, and the speed(s) available at your location are identified during the ordering process." (search snippet from brightspeed.com; page itself not fetched → UNVERIFIED wording)
- Explicit unit-required / ambiguous-address copy: **UNKNOWN**.

### 2.6 Address-specific plans & prices

Yes — "speed(s) available at your location are identified during the ordering process"; marketing "Check for Deals at My Home".

### 2.7 Broadband Facts labels

- Explainer: `https://www.brightspeed.com/help/broadband-label/` (six-element description).
- **Machine-readable CSV (static, verified 200):** `https://www.brightspeed.com/content/dam/brightspeed/images/broadband-label/updated-broadband-label/brightspeed-broadband-labels-01-09-2026.csv` — `text/csv`, 41,609 bytes, Last-Modified 2026-03-06.
- Business labels as PDFs under `/content/dam/brightspeed/ew/documents/fcc_labels/` and index `https://www.brightspeed.com/business-solutions/legal-resources/fcc-broadband-fact-labels/`.
- Linked from plan cards: UNKNOWN (shop is SPA).

### 2.8 Transport / partner programs

- Residential referral program `https://refer.brightspeed.com/` (customer-to-customer rewards).
- Business Channel Partner program `https://www.brightspeed.com/ew/partner/channel-partner-program/`; business referral campaign pages.
- No public serviceability API or developer program found. **Consumer web flow only (browser-only).**

### 2.9 Cookies, CAPTCHA, WAF (observed)

- `shop.brightspeed.com`: `via: 1.1 google` (Google Cloud load balancer), `x-cache-*` headers, Dynatrace; `/robots.txt` → **403 `AccessDenied` XML** (cloud-storage style error, i.e., no robots file served).
- Marketing page `/internet/` states: "This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply." reCAPTCHA presence inside the SPA bundle not inspected.
- No Akamai/Cloudflare/PerimeterX indicators on www or shop hosts. Rate limits/timeouts: UNKNOWN.

### 2.10 Fixture / parser feasibility

Low: qualification UI is an SPA; no static HTML result markup. The label **CSV is a good committable fixture** (static file).

### 2.11 Official fallback URL

`https://shop.brightspeed.com/uas/` (or `https://www.brightspeed.com/internet/`).

### 2.12 Terms, privacy, robots (review date 2026-09-02)

- Legal hub: `https://www.brightspeed.com/aboutus/legal` → consumer `https://www.brightspeed.com/aboutus/legal/consumer/legal-notices/`.
- Website User Agreement: `https://www.brightspeed.com/aboutus/legal/consumer/website-user-agreement/` — **no robot/spider/scraper/automated-access clause found** in the page text; effective date not shown (**UNKNOWN**). Relevant clause: "No material from this website may be copied, reproduced, republished, uploaded, posted, transmitted, or distributed in any way."
- Terms and Conditions: `https://www.brightspeed.com/aboutus/legal/consumer/terms-and-conditions/` (no automation clause found).
- Acceptable Use Policy: `https://www.brightspeed.com/aboutus/legal/consumer/legal-notices/acceptable-use-policy/` (service AUP; no scraping clause found).
- Privacy Notice (Effective July 1, 2026): `https://www.brightspeed.com/privacy-notice/`; cookie notice `https://www.brightspeed.com/aboutus/legal/consumer/privacy-notice/brightspeed-cookie-notice/`.
- robots.txt `https://www.brightspeed.com/robots.txt`: Disallow `/login/`, `/ew/business/login/`, `/search`, `/campaign/`; Googlebot/AdsBot fully allowed; sitemaps incl. `/availability/sitemap-index.xml`. Availability/shop paths not disallowed (shop host serves no robots file).

### 2.13 Verdict

**`link_only`** (closest to approve_with_limits of the three, but material terms are unclear). Rationale: the WUA is silent on automated access but broadly prohibits copying "in any way"; the qualification flow is an unfixtureable SPA reportedly behind reCAPTCHA; no integration program. Legal review questions: (a) whether rendering serviceability results inside ISP Search constitutes "copying/republishing" under the WUA; (b) confirm the WUA's effective date/version; (c) whether Brightspeed will grant written permission or a partner feed (business channel team exists).

---

## 3. T-Mobile Home Internet (5G Home Internet, Lite, AWAY, Home Internet Backup)

### 3.1 Identity

- Copyright string observed on home-internet pages: "© 2022 T-Mobile USA, Inc." (`https://www.t-mobile.com/home-internet`). Parent T-Mobile US, Inc. (Deutsche Telekom majority) — UNVERIFIED from fetched pages.
- Brand aliases: T-Mobile Home Internet, 5G Home Internet, Rely/Amplified/All-In Internet (plan names in FAQ), Home Internet Lite, AWAY, Home Internet Backup, Small Business Internet, T-Mobile Fiber (separate product/host `fiber.t-mobile.com`). No 2025–2026 rebrand of the Home Internet brand observed.

### 3.2 Official service & qualification URLs

- Product hub: `https://www.t-mobile.com/home-internet` (`/isp` redirects here).
- **Check eligibility:** `https://www.t-mobile.com/home-internet/eligibility`
- Plans (post-eligibility landing): `https://www.t-mobile.com/home-internet/plans`
- Waitlist pages: `/home-internet/eligibility/waitlist`, `/home-internet/eligibility/waitlist-sign-up`, `/home-internet/eligibility/5g-waitlist-sign-up`, confirmation `/home-internet/eligibility/waitlist-confirmation`
- Backup: `https://www.t-mobile.com/home-internet/plans/5g-backup-internet-options`; AWAY: `https://www.t-mobile.com/home-internet/internet/away-plan`; Fiber availability: `https://www.t-mobile.com/home-internet/fiber/availability` (→ `fiber.t-mobile.com/check-address`).
- ZIP-only query parameters: **UNKNOWN**. The AWAY page shows "Showing pricing for zipcode … Pricing varies by location, check availability at your address for the most accurate plan pricing" (ZIP is used for display pricing; parameter name not documented).

### 3.3 Markets and technologies

Fixed wireless (5G/4G LTE) nationwide where capacity permits; "Coverage not available in some areas"; "Not available in all areas." Separate fiber product in select markets.

### 3.4 Address & unit inputs (from page markup, not exercised)

Eligibility form ("HINT Availability Search" / `universalEligibilityChecker`): address input (aria-label "ADDRESS INPUT FIELD", placeholder "Enter your address"; validation "Please enter your address", "Please choose an address from the list" → **autocomplete suggestion list, 8 results** `data-upf-address-count="8"`), **unit field** (placeholder "unit #", aria-label "UNIT FIELD INPUT", error "Please enter unit field"), business-address interstitial ("This appears to be a business address"), and Google **reCAPTCHA** (`https://www.google.com/recaptcha/api.js`). Same component on Backup page ("Address should select from dropdown").

### 3.5 Outcome states — and why coverage ≠ eligibility

Routing attributes on the eligibility component (static HTML, 2026-09-02):

- eligible → `/home-internet/plans` (headline "5G Home Internet is available at your address!")
- ineligible → `/home-internet/eligibility/waitlist-sign-up`
- **capped** (capacity-limited) → `/home-internet/eligibility/5g-waitlist-sign-up`
- waitlist → `/home-internet/eligibility/waitlist`
- AWAY page: "You are not eligible for Away Plans. Navigate to not available page."

Official wording on capacity-based, per-address eligibility (FAQ `https://www.t-mobile.com/home-internet/faq`):

- "Eligibility is determined by the home service address. Address eligibility is based off network capacity, which is always expanding, but can also change as more customers join T-Mobile."
- "Rely… Amplified… All-In Internet must have a home service address that is eligible for unlimited service."
- "Home Internet Lite must have a service address eligible for Lite plans." Support: "For addresses that aren't yet eligible for our unlimited… service, our Home Internet Lite data bucketed plans start at 100GB." (`https://www.t-mobile.com/support/home-internet/t-mobile-internet-lite`)
- "AWAY customers must have an eligible physical address to get started. Once activated, AWAY plans may be used nationwide…"
- Waiting-list state: "You're on the Waiting List" message; existing-account invitations "tied to a specific" location.
- Eligibility page FAQ: eligibility "depends on factors like local network capacity, signal strength, building materials, and certain multi-dwelling unit restrictions. We're always working to expand coverage, so check availability again later." Search snippet (t-mobile.com): "Availability can vary by address, even on the same street."
- Therefore a positive result on the coverage map (`https://www.t-mobile.com/coverage/coverage-map`) does **not** imply Home Internet eligibility; only the per-address eligibility check does, and the answer can change over time (capacity).

**Home Internet Backup** (`/plans/5g-backup-internet-options`): "No voice line required… $20/month with AutoPay"; legal footer for the bill-credit promo: "Qualifying credit, postpaid voice line, and new Home Internet Backup line required. Home Internet Backup not available in all areas." Address check uses the same eligibility component.

### 3.6 Address-specific plans & prices

Yes: eligibility result gates plan set (unlimited vs Lite vs AWAY), and pricing is ZIP/location-dependent ("Pricing varies by location…"). Labels page: "some plans… may require an eligibility check".

### 3.7 Broadband Facts labels

- Overview: `https://www.t-mobile.com/landing-pages/broadband-facts/overview` (brand selector; note the page currently contains lorem-ipsum placeholder text "Bacon ipsum dolor amet…" — observed 2026-09-02).
- Full consumer label page: `https://www.t-mobile.com/content/digx/tmobile/us/en/landing-pages/broadband-facts/t-mobile-fcc-broadband-facts.html` — ~6.9 MB HTML containing **847 label blocks** with FCC headings ("Broadband Facts", "Monthly Price", "Additional Charges", "Typical Download Speed", "Data Included", "Unique plan identifier", "Mobile Broadband Consumer Disclosure") in consistent classes (`tdds-broadband-facts__divider`, `broadbandFacts--headline-container`).
- **Machine-readable export (XLSX):** `https://www.t-mobile.com/content/dam/digx/broadband-labels/broadbandFactsLabels.xlsx` ("Broadband plan label data is available to export for active plans.")
- Policy page: `https://www.t-mobile.com/responsibility/consumer-info/policies/internet-service` ("You can find these labels where you shop for your plans, including on our plans page, on the phone, or at a retail store").

### 3.8 Transport / partner programs

- T-Mobile for Business Partner Program (resellers/agents of wireless & wireline): `https://www.t-mobile.com/business/partner-recruitment`, portal `https://businesspartners.t-mobile.com/` (Angular SPA).
- DevEdge developer platform `https://devedge.t-mobile.com/` (network APIs; SPA; no documented Home Internet eligibility API found → **UNKNOWN**; AUP at `devedge.t-mobile.com/terms-and-conditions/acceptable-use-policy`).
- Consumer affiliate program exists only via third-party networks (FlexOffers etc.) — not an official page (**UNVERIFIED**), and affiliates get links, not data.
- Conclusion: **consumer web flow only (browser-only)**; a partner-program conversation is the only plausible approved tier.

### 3.9 Cookies, session, CAPTCHA, WAF (observed)

- **Akamai** edge (`akamai-grn`, `akamai-cache-status`, `x-akamai-transformed`), **Akamai Bot Manager** cookies (`_abck`, `bm_sz`), phased-release cookie `akacd_www_t_mobile_com_phased_release_non_shared`, **Queue-it** connector (`x-queueit-connector: akamai`), CSP `frame-ancestors` limited to t-mobile.com.
- WebFetch (generic fetcher) received **403 on every t-mobile.com URL**; curl with a research UA got 200 → UA/fingerprint-based blocking.
- reCAPTCHA loaded on the eligibility form.
- Rate limits/timeouts: UNKNOWN (not tested).

### 3.10 Fixture / parser feasibility

Eligibility form is server-rendered AEM markup (fixture of the _form_ possible), but results are produced client-side after reCAPTCHA-protected calls; no static result markup → result fixtures not obtainable without exercising the flow (out of scope and barred by TOU). The label HTML page and XLSX are static and fixtureable.

### 3.11 Official fallback URL

`https://www.t-mobile.com/home-internet/eligibility`

### 3.12 Terms, privacy, robots (review date 2026-09-02)

- Website Terms of Use (Effective August 18, 2026): `https://www.t-mobile.com/responsibility/consumer-info/policies/terms-of-use`
  - "access, monitor, or copy any content or information on the Site using any robot, spider, scraper, artificial intelligence tool, data-mining tool, or other automated means or any manual process"
  - "Your use of the Site is limited to non-commercial, personal use only."
- Privacy Notice (Last updated June 26, 2026): `https://www.t-mobile.com/privacy-center/privacy-notices/t-mobile-privacy-notice`
- Service T&Cs: `https://www.t-mobile.com/responsibility/legal/terms-and-conditions`
- robots.txt `https://www.t-mobile.com/robots.txt` (last-modified 2026-04-24): AI crawlers incl. `anthropic-ai`, `ClaudeBot`, `Claude-User`, `GPTBot` etc. disallowed from `/community`; Baiduspider/YandexBot fully disallowed; `User-agent: *` disallows `/content/` (except `/content/dam/`), `/*.pdf`, `/account/`, `/buy`, `/checkout`, `/commerce`, `/purchase`, `/pre-screen`, `/search*`, `/my-account/` and similar. **`/home-internet/eligibility` is not disallowed.** Note: the big label HTML lives under `/content/digx/...`, which _is_ disallowed for crawlers.

### 3.13 Verdict

**`link_only`.** TOU expressly prohibits robots/scrapers/AI tools and even "any manual process" for copying, restricts to non-commercial personal use; Akamai Bot Manager + Queue-it + reCAPTCHA on the form; eligibility is capacity-based and time-varying, so cached results would be misleading anyway. Legal review questions: (a) whether user-initiated agentic browsing on the user's own behalf is "automated means" under the TOU; (b) whether the partner program can cover a comparison tool; (c) label reuse under robots `/content/` disallow vs. the FCC point-of-sale disclosure purpose.

---

## 4. Broadband Facts label ecosystem check

### 4.1 FCC sources and current rule status

- `https://www.fcc.gov/broadbandlabels` and `https://www.fcc.gov/consumers/guides/broadband-labels`: **HTTP 403 (AkamaiGHost)** to both fetchers on 2026-09-02; the FCC machine-readable spec PDF (`/sites/default/files/broadband-label-machine-readable-file-data-specifications.pdf`) also 403. Facts below are from eCFR and docs.fcc.gov instead.
- **47 CFR § 8.1 (eCFR, current as fetched 2026-09-02)** `https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-8/subpart-A/section-8.1`: labels must be "prominently displayed, publicly available, and easily accessible to consumers… at the point of sale" in the prescribed "[Fixed or Mobile] Broadband Consumer Disclosure" format; point of sale includes "a provider's website"; (a)(3) still reads: label content "must be displayed… in a machine-readable format… separately in a spreadsheet file format… via a dedicated uniform resource locator (URL) that contains all of their labels."
- **FCC 26-48 Report and Order** (adopted July 22, 2026 / released July 23, 2026 per FCC fact sheet DOC-422742A1) `https://docs.fcc.gov/public/attachments/FCC-26-48A1.pdf`: "We eliminate the requirement that providers make the contents of labels available separately in a machine readable spreadsheet file format hosted at a dedicated URL". It also removes the label template from the CFR (delegated to CGB via Public Notice), drops the two-year archive rule and the ACP line, and updates the template URL to fcc.gov/broadbandlabels. **Effective date:** §8.1(a) amendments "will not become effective until the Office of Management and Budget completes review" (PRA), to be announced by Public Notice; §8.1(b) 30 days after Federal Register publication. As of 2026-09-02 the eCFR text still contains (a)(3), so machine-readable files remain formally required until that notice — but providers can be expected to stop maintaining them.
- Implication for ISP Search: the point-of-sale HTML label survives; CSV/XLSX indexes are a wasting asset. Plan on HTML-label parsing and treat any CSV/XLSX as an optional accelerator.

### 4.2 Where providers host labels (fetched 2026-09-02)

| Provider             | Label page                                                                                                                                         | Machine-readable file today                                                              | Rendering                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Quantum Fiber (AT&T) | `https://broadbandlabel.quantumfiber.com/catalog`                                                                                                  | CSV claimed on help page; link not visible in static HTML (UNVERIFIED)                   | Angular SPA "BBL- Portal"                        |
| CenturyLink (Lumen)  | `https://broadbandlabel.centurylink.com/catalog`                                                                                                   | CSV claimed; same                                                                        | Angular SPA (identical shell)                    |
| Brightspeed          | `https://www.brightspeed.com/help/broadband-label/`                                                                                                | **Yes — static CSV** `…/brightspeed-broadband-labels-01-09-2026.csv` (text/csv, 41.6 KB) | Static AEM page + CSV                            |
| T-Mobile             | `…/landing-pages/broadband-facts/overview` → `…/t-mobile-fcc-broadband-facts.html`                                                                 | **Yes — XLSX** `…/broadband-labels/broadbandFactsLabels.xlsx`                            | Server-rendered AEM HTML, 847 labels in one page |
| AT&T                 | `https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/` ("Download Broadband Facts for any of our current AT&T plans")       | Download link not present in static HTML (client-rendered) → UNVERIFIED format           | SPA-ish; Akamai Bot Manager cookies              |
| Verizon              | `https://www.verizon.com/about/broadband-facts` → `https://www.verizon.com/broadband-facts/consumer/`                                              | None visible (SPA) → UNKNOWN                                                             | Client-rendered app                              |
| Xfinity/Comcast      | `https://www.xfinity.com/broadband-labels` ("Enter an address to get started"); support article `…/support/articles/broadband-mobile-facts-labels` | Mobile labels file mentioned in support article (search snippet; UNVERIFIED)             | **Address-gated** SPA                            |
| Spectrum/Charter     | `https://www.spectrum.net/support/internet/spectrum-broadband-labels`                                                                              | UNKNOWN                                                                                  | SPA on S3/CloudFront (≈250 chars static text)    |

No provider publishes a JSON index; the only machine-readable artifacts found are CSV (Brightspeed) and XLSX (T-Mobile), plus SPA-embedded catalogs (Quantum Fiber/CenturyLink) whose CSV links were not observable statically. No cross-provider FCC index of provider label URLs was reachable (fcc.gov 403).

### 4.3 Does label HTML follow the FCC template closely enough for a deterministic parser?

- The FCC prescribes a _visual_ template (title "Broadband Facts", provider/plan header, fixed/mobile designation, Monthly Price with intro-rate flags, Additional Charges & Terms, Discounts & Bundles, Speeds Provided with Plan (typical download/upload/latency), Data Included, Network Management/Privacy links, Customer Support, FCC URL, Unique Plan Identifier). It does **not** prescribe DOM structure, so markup varies by provider.
- Observed: T-Mobile's page uses consistent headings and class names across all 847 labels ("Monthly Price" ×1719 incl. duplicates, "Typical Download Speed" ×847, "Unique plan identifier" ×847) — a per-provider deterministic parser keyed on heading text is plausible. Brightspeed's explainer mirrors the six FCC sections in prose; its labels live in the CSV and (presumably) in the shop flow. Quantum Fiber/CenturyLink/Verizon/AT&T/Spectrum render labels client-side, so a static-HTML parser needs a rendered DOM snapshot.
- Recommendation: build parsers keyed on the FCC section titles and the **Unique Plan Identifier** (stable join key), one adapter per provider, with fixtures from the static pages that exist (T-Mobile HTML/XLSX, Brightspeed CSV). Expect drift once FCC 26-48 takes effect (template edits: fee simplification, ACP line removal, links/icons allowed at point of sale).

---

## 5. Summary table

| Provider               | Transport                                                                                                     | CAPTCHA / WAF                                                               | Terms stance                                                                                           | Fixtureable                                     | Verdict       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------- |
| Quantum Fiber (AT&T)   | Consumer web flow only (SFCC `/shop`); no API/partner tier for qualification                                  | Cloudflare + PerimeterX; generic fetcher 403; no reCAPTCHA seen             | WUA (eff. 2024-09-01) bars robots/automatic devices, data mining; personal non-commercial only         | Form HTML yes; results no; label catalog SPA no | **link_only** |
| CenturyLink (Lumen)    | Consumer web flow only (`shop.centurylink.com/uas/` SPA)                                                      | No bot-manager seen; section.io/Varnish; WebFetch TLS-chain failure         | WUA (eff. 2025-11-01) bars AI/robots/spiders, data mining; personal non-commercial only                | No (SPA)                                        | **link_only** |
| Brightspeed            | Consumer web flow only (`shop.brightspeed.com/uas/` SPA); business channel program exists                     | reCAPTCHA notice on marketing page; GCP LB; no Akamai/CF seen               | WUA silent on bots; "No material… may be copied… in any way"; date UNKNOWN                             | Qualification no (SPA); label CSV yes           | **link_only** |
| T-Mobile Home Internet | Consumer web flow only (AEM eligibility form); business partner program; DevEdge has no eligibility API found | Akamai Bot Manager + Queue-it + reCAPTCHA; generic fetcher 403 on all pages | TOU (eff. 2026-08-18) bars robots/scrapers/AI tools/"any manual process"; non-commercial personal only | Form HTML yes; results no; labels HTML/XLSX yes | **link_only** |

Questions needing qualified legal review (all providers): scope of "personal, non-commercial use" for a consumer-facing commercial tool acting on a user's instruction; whether user-driven agentic browsing is "automated means"; enforceability of browsewrap website terms against a user-initiated session; reuse of Broadband Facts label content (point-of-sale disclosure) vs. robots/TOU restrictions after FCC 26-48.

---

## 6. Sources (all fetched 2026-09-02)

Quantum Fiber / AT&T

- https://www.quantumfiber.com/ ; https://www.quantumfiber.com/shop ; https://www.quantumfiber.com/notifyme.html ; https://www.quantumfiber.com/internet-for-apartments.html ; https://www.quantumfiber.com/att-offer.html
- https://www.quantumfiber.com/legal.html ; https://www.quantumfiber.com/website-user-agreement.html ; https://www.quantumfiber.com/internet-service-disclosure.html
- https://www.quantumfiber.com/support/internet-essentials/basics/broadband-label.html ; https://broadbandlabel.quantumfiber.com/catalog
- https://www.quantumfiber.com/robots.txt ; https://broadbandlabel.quantumfiber.com/robots.txt (returns SPA HTML)
- https://about.att.com/privacy.html (403) ; https://about.att.com/story/2025/lumen-mass-markets-fiber-business.html (403) ; https://about.att.com/story/2026/att-lumen-deal-close.html (403)
- https://www.att.com/legal/terms.aup.html ; https://www.att.com/quantumfiber/ ; https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/
- https://www.business.att.com/industries/partner-solutions/att-partner-exchange.html ; https://www.business.att.com/explore/referral.html ; https://www.quantumfiber.com/connected-communities/connect-expert.html (search results; not individually fetched)

Lumen / CenturyLink

- https://ir.lumen.com/news/news-details/2025/Lumen-Technologies-Advances-Enterprise-Market-Focus-with-Sale-of-Consumer-Fiber-to-the-Home-Business-to-ATT/default.aspx
- https://ir.lumen.com/news/news-details/2026/Lumen-Completes-Sale-of-Consumer-Fiber-to-the-Home-Business-to-ATT/default.aspx ; https://www.sec.gov/Archives/edgar/data/18926/000119312526032635/d25850dex991.htm
- https://www.centurylink.com/ ; https://www.centurylink.com/home/internet.html ; https://www.centurylink.com/fiber/fiber-in-my-area.html ; https://shop.centurylink.com/uas/ ; https://highspeed.centurylink.com/availability
- https://www.centurylink.com/aboutus/legal.html ; https://www.centurylink.com/aboutus/legal/website-user-agreement.html ; https://www.centurylink.com/aboutus/legal/privacy-notice.html ; https://www.centurylink.com/aboutus/legal/internet-subscriber-agreement.html ; https://www.lumen.com/en-us/about/legal/acceptable-use-policy.html
- https://www.centurylink.com/home/help/internet/broadband-label.html ; https://broadbandlabel.centurylink.com/catalog
- https://www.centurylink.com/robots.txt ; https://shop.centurylink.com/robots.txt (404)

Brightspeed

- https://www.brightspeed.com/ ; https://www.brightspeed.com/internet/ ; https://www.brightspeed.com/local/ ; https://shop.brightspeed.com/uas/ ; https://shop.brightspeed.com/robots.txt (403 AccessDenied)
- https://www.brightspeed.com/aboutus/legal ; https://www.brightspeed.com/aboutus/legal/consumer/website-user-agreement/ ; https://www.brightspeed.com/aboutus/legal/consumer/terms-and-conditions/ ; https://www.brightspeed.com/aboutus/legal/consumer/legal-notices/acceptable-use-policy/ ; https://www.brightspeed.com/privacy-notice/
- https://www.brightspeed.com/help/broadband-label/ ; https://www.brightspeed.com/content/dam/brightspeed/images/broadband-label/updated-broadband-label/brightspeed-broadband-labels-01-09-2026.csv ; https://www.brightspeed.com/business-solutions/legal-resources/fcc-broadband-fact-labels/
- https://www.brightspeed.com/help/internet/fiber/how-to-get-fiber-internet/ ; https://www.brightspeed.com/help/internet/fiber/can-i-get-fiber-internet-in-an-apartment-or-condo/
- https://refer.brightspeed.com/ ; https://www.brightspeed.com/ew/partner/channel-partner-program/ (search results)
- https://www.brightspeed.com/robots.txt

T-Mobile

- https://www.t-mobile.com/home-internet ; https://www.t-mobile.com/home-internet/eligibility ; https://www.t-mobile.com/home-internet/faq ; https://www.t-mobile.com/home-internet/plans ; https://www.t-mobile.com/home-internet/plans/5g-backup-internet-options ; https://www.t-mobile.com/home-internet/internet/away-plan ; https://www.t-mobile.com/home-internet/fiber/availability ; https://www.t-mobile.com/support/home-internet/t-mobile-internet-lite ; https://www.t-mobile.com/home-internet/eligibility/waitlist-sign-up
- https://www.t-mobile.com/responsibility/consumer-info/policies/terms-of-use ; https://www.t-mobile.com/privacy-center/privacy-notices/t-mobile-privacy-notice ; https://www.t-mobile.com/responsibility/consumer-info/policies/internet-service
- https://www.t-mobile.com/landing-pages/broadband-facts/overview ; https://www.t-mobile.com/content/digx/tmobile/us/en/landing-pages/broadband-facts/t-mobile-fcc-broadband-facts.html ; https://www.t-mobile.com/content/dam/digx/broadband-labels/broadbandFactsLabels.xlsx ; https://www.t-mobile.com/news/community/new-broadband-labels-everything-you-need-to-know
- https://www.t-mobile.com/business/partner-recruitment ; https://businesspartners.t-mobile.com/ ; https://devedge.t-mobile.com/documentation/api-products/home-api-products
- https://www.t-mobile.com/robots.txt

FCC and other providers

- https://www.fcc.gov/broadbandlabels (403) ; https://www.fcc.gov/consumers/guides/broadband-labels (403) ; https://www.fcc.gov/sites/default/files/broadband-label-machine-readable-file-data-specifications.pdf (403)
- https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-8/subpart-A/section-8.1
- https://docs.fcc.gov/public/attachments/FCC-26-48A1.pdf ; https://docs.fcc.gov/public/attachments/DOC-422742A1.pdf
- https://www.verizon.com/about/broadband-facts ; https://www.verizon.com/broadband-facts/consumer/ ; https://www.xfinity.com/broadband-labels ; https://www.spectrum.net/support/internet/spectrum-broadband-labels
