# ADR-004: Provider integration hierarchy and enabled-provider decisions

- **Status:** accepted
- **Date:** 2026-09-02
- **Owner:** Oliver Dougherty (maintainer)
- **Linear:** PLA-346, PLA-347
- **Review trigger:** qualified legal review of any provider's terms; a partner/API agreement; a
  change in a provider's terms, robots.txt, or bot controls; a corporate transaction (Charter →
  "Cox Communications" rename, Verizon/Frontier, AT&T/Quantum Fiber, BCE/Ziply, Stonepeak/GFiber);
  quarterly per the source review calendar.

## Context

Eleven providers were evaluated from official public pages, terms, privacy policies, robots.txt,
and passive fetch observations on 2026-09-02, without submitting an address, calling any
undocumented endpoint, or touching any CAPTCHA or bot control. The complete per-provider evidence
is in [`docs/sources/provider-feasibility-matrix.md`](../sources/provider-feasibility-matrix.md);
the terms/robots/verdict table with review dates is in
[`docs/sources/provider-terms-review.md`](../sources/provider-terms-review.md).

Cross-cutting findings:

- No provider documents a residential serviceability API, affiliate data feed, or partner
  integration tier for address qualification. Affiliate programs (where they exist) supply links
  and creative only.
- Xfinity, AT&T, Verizon, Quantum Fiber, CenturyLink, and T-Mobile terms expressly prohibit
  automated access and limit use to personal, non-commercial purposes. Ziply, Frontier, Brightspeed,
  and GFiber have no explicit bot clause but limit use to personal, noncommercial purposes and/or
  prohibit reuse "on any other website or networked computer environment". Spectrum's and Cox's
  terms could not be retrieved (Akamai/Imperva), so they are treated as unclear.
- Bot controls observed: Akamai Bot Manager (Xfinity, AT&T, Spectrum, Verizon, Frontier,
  T-Mobile), Imperva (Cox), Cloudflare (Ziply; with PerimeterX at Quantum Fiber), reCAPTCHA
  (GFiber, T-Mobile; Brightspeed notice), Queue-it (T-Mobile). Several hosts return 403 to
  non-browser clients.
- Qualification flows are client-rendered SPAs almost everywhere; result-page fixtures are not
  obtainable statically. Machine-readable Broadband Facts assets exist for Brightspeed (CSV),
  T-Mobile (XLSX + server-rendered HTML), Cox (CSV), and AT&T (download page, client-rendered).

## Decision

### Hierarchy (unchanged from the planning document, now binding)

1. Official partner/provider API or feed with explicit permission.
2. Documented public consumer API whose terms and technical contract permit the use.
3. Provider-owned browser flow automated only after per-provider qualified review, with
   conservative rate limits, isolated contexts, no session persistence, and a kill switch.
4. User-directed official link with candidate evidence and no automated verification.

Prohibited regardless of tier: CAPTCHA solving or bypass, proxy rotation, fingerprint spoofing,
defeating rate limits or WAFs, automating authenticated customer accounts, committing cookies,
sessions, tokens, HARs, or unredacted responses. Technical feasibility is never authorization.

### Per-provider decisions (review date 2026-09-02)

| Provider                             | Verdict     | Tier | Reason in one line                                                                                                                             |
| ------------------------------------ | ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Xfinity (Comcast)                    | `link_only` | 4    | Terms bar automated access except via provided APIs; personal/non-commercial only; 403 to non-browser clients                                  |
| AT&T Internet / Fiber / Internet Air | `link_only` | 4    | Terms §14.13/§14.22/§14.20 bar robots, data mining, commercial exploitation; Akamai                                                            |
| Spectrum (Charter)                   | `link_only` | 4    | Terms unreadable (403/timeouts); unclear material terms force link-only                                                                        |
| Verizon Fios / 5G Home               | `link_only` | 4    | Terms bar any automated script; commercial use prohibited; SPA behind Akamai                                                                   |
| Ziply Fiber                          | `link_only` | 4    | No bot clause, robots permits `/sales/`, but personal/noncommercial-only and "other networked environment" clause need review; Cloudflare; SPA |
| Frontier (Verizon)                   | `link_only` | 4    | Personal/noncommercial-only terms; `/buy` returns 403; honeypot field                                                                          |
| Cox (Charter/Spectrum)               | `link_only` | 4    | Terms unreadable; robots disallows shop paths; brand migrating to Spectrum                                                                     |
| GFiber / Webpass                     | `link_only` | 4    | reCAPTCHA on the availability form (automation would require bypass); Google ToS applicability unknown                                         |
| Quantum Fiber (AT&T)                 | `link_only` | 4    | Website User Agreement bars robots and systematic collection; Cloudflare + PerimeterX                                                          |
| CenturyLink (Lumen)                  | `link_only` | 4    | Agreement bars AI/robots/spiders; SPA shop; footprint in flux                                                                                  |
| Brightspeed                          | `link_only` | 4    | Terms silent on bots but prohibit copying "in any way"; SPA; reCAPTCHA notice                                                                  |
| T-Mobile Home Internet               | `link_only` | 4    | Terms bar robots/scrapers/AI tools and "any manual process"; Akamai + Queue-it + reCAPTCHA; capacity-based eligibility                         |

**No live adapter is approved.** The adapter registry rejects live tiers unless explicitly
allowed (`createAdapterRegistry`), and every provider can be downgraded by configuration
(`docs/runbooks/provider-disable.md`).

### First adapter candidates (recommended, not implemented)

The two providers to pursue first, in order, if the maintainer wants live qualification in M3:

1. **Ziply Fiber** — the only provider with no explicit automation clause _and_ no hard block
   observed on the flow. Path: (a) qualified legal review of the "personal, noncommercial" and
   "other networked computer environment" clauses as applied to a user-initiated, single-shot,
   uncached check; (b) partner outreach for an official route (tier 1) before any tier-3 work.
2. **Brightspeed** — terms silent on automation; static Broadband Facts CSV; but the shop flow is
   an SPA with a reCAPTCHA notice, so tier 3 is only possible if the flow proves CAPTCHA-free for
   ordinary sessions. Path: legal review of the "copied ... in any way" clause; partner outreach.

Third adapter or fallback: **robust link-only fallback for all others** (already the default).

In parallel and independent of qualification automation, M3 should implement Broadband Facts
label ingestion from the assets that exist (Brightspeed CSV, T-Mobile HTML/XLSX, AT&T download
page once verified, Cox/Spectrum CSV) under PLA-375/PLA-379, treating machine-readable files as a
disappearing input (FCC 26-48).

### Recorded policy per provider

For each provider the terms review records: terms URL and date, privacy URL, robots.txt review
date and notable disallows, approved tier (4), permitted retention (none: no automated retrieval
occurs at tier 4), required attribution (nominative use of the brand name and a link to the
official page), rate/concurrency policy (n/a at tier 4; to be set per adapter if a tier changes),
official fallback URL, and open legal questions.

## Alternatives considered

- Approving Ziply Fiber or Brightspeed as `approve_with_limits` now: rejected; material terms are
  unclear and the rule is to escalate rather than invent a legal conclusion.
- Broad tier-3 automation on the theory that user-initiated checks are "personal use": rejected
  pending qualified review; several providers prohibit it explicitly.
- Treating robots.txt permissiveness as authorization: rejected; robots.txt is an operational
  signal only.

## Evidence and official sources

All URLs, quotes (≤25 words), status codes, and fetch dates are in the provider matrix and the
terms review. Corporate facts: Charter–Cox closed 2026-08-19/20; Verizon–Frontier closed
2026-01-20; AT&T–Lumen Mass Markets fiber closed 2026-02-02; BCE–Ziply closed 2025-08-01;
Comcast–Versant separation 2026-01-02; GFiber rebrand 2026-03-26 with a pending Stonepeak/Astound
transaction (Q4 2026).

## Consequences

- The M3 adapter gate cannot be met without at least one legal review outcome or partner
  agreement; PLA-376/377 remain blocked and `status:compliance-gated`.
- M2 proceeds with deterministic reference adapters and link-only providers, which is fully
  supported by the domain model (`likely_available` / `unknown`).
- Provider identity churn must be data (provider directory with validity dates), not copy.

## Unresolved risks (for qualified legal review)

1. Whether a user-initiated, single-shot, uncached serviceability check run on the user's behalf
   by a commercial product is "personal, non-commercial use" under each provider's terms.
2. Which terms govern cox.com/spectrum.com during and after the brand cutover, and Spectrum's
   stance on automated access (never retrieved).
3. Whether Google's general Terms of Service apply to gfiber.com.
4. Whether deep-linking to official availability pages implicates anti-framing/inline-linking
   clauses (Xfinity, AT&T §14.24, Verizon).
5. Whether republishing Broadband Facts label data (an FCC-mandated disclosure) is constrained by
   site terms.
6. Post-transaction terms for Frontier, Ziply, Quantum Fiber, and GFiber.
