# M0 feasibility gate: go / no-go

- **Date:** 2026-09-02
- **Linear:** PLA-351 (epic PLA-338)
- **Result: `go with constrained launch`**

## What the gate decided

| Question                                             | Decision                                                                                                                                                              | ADR                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Launch boundary and completeness claim               | Bounded launch markets (Route C); exact completeness copy fixed; no "all ISPs" claims                                                                                 | ADR-001               |
| Address resolver and unit strategy                   | Smarty primary, Census corroboration, Google backup (phase 2); unit is application-owned and always preserved                                                         | ADR-002               |
| Candidate-discovery source                           | Versioned launch registry + BDC area summaries + FCC map deep link; undocumented map endpoints prohibited; Route A/B graduation criteria recorded                     | ADR-003               |
| Provider integration hierarchy and enabled providers | Hierarchy binding; all 11 providers `link_only`; no live adapter approved; Ziply Fiber and Brightspeed are the first candidates for legal review and partner outreach | ADR-004               |
| Truth and confidence model                           | Confirmed and implemented in `packages/domain` with tests                                                                                                             | ADR-005               |
| Retention and redaction                              | Ceilings, HMAC identity, redaction, fixture rules; corpus policy                                                                                                      | ADR-007               |
| Metrics, SLO hypotheses, release evidence            | Defined                                                                                                                                                               | `metrics-and-slos.md` |

## Why "constrained" rather than "go"

1. No lawful exact nationwide candidate source exists today.
2. No provider is approved for automated qualification; every evaluated provider's terms either
   prohibit automation, restrict use to personal/non-commercial purposes, or could not be read.
3. No consented live-address corpus exists, so no live validation of the resolver or any provider
   flow has been performed.

## Why not "no-go"

The product's honest form, candidate discovery with area-level evidence, official links, and
(in M3) Broadband Facts label data, is buildable now, useful, and does not depend on any gated
item. The domain model already represents it correctly (`likely_available` / `unknown`), and every
gated capability has a documented path and review trigger.

## What Round 2 may build

- **May begin:** PLA-360, PLA-361, PLA-362, PLA-363 (Smarty adapter behind the contract; live
  calls only once a corpus exists), PLA-364, PLA-365 (registry-based discovery), PLA-366,
  PLA-367, PLA-368, PLA-369, PLA-370, PLA-371. Label ingestion groundwork (PLA-375/379) may start
  from the public static assets (Brightspeed CSV, T-Mobile HTML/XLSX).
- **Remains blocked:** PLA-376, PLA-377, PLA-378 (live adapters) until ADR-004 is amended after
  qualified legal review or a partner agreement; PLA-349 corpus creation is a maintainer action;
  any Route A/B work until licenses/terms are obtained.

## Maintainer decisions required

1. Confirm or replace the proposed launch markets in ADR-001 based on where consented test
   addresses can be sourced.
2. Commission qualified legal review of the questions listed in ADR-004 (priority: Ziply Fiber,
   Brightspeed) and of the Fabric/TrueVerra and CostQuest terms in ADR-003.
3. Decide whether to open partner outreach with Ziply Fiber and Brightspeed.
4. Provision the secret store for the consented corpus (PLA-349).
5. Request Smarty tier quotes before any resolver contract (ADR-002).
