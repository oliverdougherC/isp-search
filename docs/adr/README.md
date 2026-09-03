# Architecture decision records

ADRs record decisions that constrain implementation. Each has context, decision, alternatives,
evidence with official sources, consequences, owner, review trigger, and unresolved risks. Use
[`ADR-000-template.md`](ADR-000-template.md).

| ADR                                                          | Title                                                                 | Status                             | Linear           |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------- | ---------------- |
| [ADR-001](ADR-001-launch-boundary-and-completeness-claim.md) | V1 launch boundary and completeness claim                             | accepted (markets proposed)        | PLA-348          |
| [ADR-002](ADR-002-address-resolver-and-unit-strategy.md)     | Address resolver and unit strategy                                    | accepted (live validation blocked) | PLA-345          |
| [ADR-003](ADR-003-candidate-discovery-source.md)             | Candidate-discovery source and licensing/terms basis                  | accepted                           | PLA-344          |
| [ADR-004](ADR-004-provider-integration-hierarchy.md)         | Provider integration hierarchy and enabled-provider decisions         | accepted (no live adapter)         | PLA-346, PLA-347 |
| [ADR-005](ADR-005-truth-and-confidence-model.md)             | Truth and confidence model                                            | accepted                           | PLA-351          |
| [ADR-006](ADR-006-job-queue-pg-boss.md)                      | PostgreSQL-backed job queue (pg-boss)                                 | accepted                           | PLA-355          |
| [ADR-007](ADR-007-retention-and-redaction.md)                | Address, evidence, fixture, and observability retention and redaction | accepted                           | PLA-349, PLA-351 |
| ADR-008                                                      | Deployment topology                                                   | not started                        | PLA-395          |

The M0 gate result is in [`docs/sources/m0-go-no-go.md`](../sources/m0-go-no-go.md).
